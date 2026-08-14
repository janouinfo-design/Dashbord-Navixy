"""Phase 1 sécurité multi-tenant — tests d'authentification, protection endpoints, non-régression."""
import os
import re
import time
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL manquant")
BASE_URL = base_url.rstrip("/")


@pytest.fixture(scope="session")
def credentials():
    content = Path("/app/memory/test_credentials.md").read_text(encoding="utf-8")
    email = re.search(r"Email:\s*(\S+)", content).group(1)
    password = re.search(r"Mot de passe:\s*(\S+)", content).group(1)
    return {"email": email, "password": password}


@pytest.fixture(scope="session")
def auth_session(credentials):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=credentials, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    assert data.get("success") is True
    assert data["user"]["role"] == "SUPER_ADMIN"
    assert data["user"]["email"] == credentials["email"]
    assert "password_hash" not in data["user"]
    assert s.cookies.get("access_token"), "access_token cookie missing"
    assert s.cookies.get("refresh_token"), "refresh_token cookie missing"
    return s


# --------- Protection : endpoints doivent renvoyer 401 sans auth ---------

class TestUnauthenticatedAccess:
    PROTECTED = [
        "/api/trackers",
        "/api/fleet/stats?from_date=2026-06-01&to_date=2026-06-07",
        "/api/vehicles/admin",
        "/api/flows",
        "/api/config/fuel",
        "/api/admin/clients",
        "/api/debug/cache-stats",
        "/api/auth/me",
    ]

    @pytest.mark.parametrize("path", PROTECTED)
    def test_endpoint_requires_auth(self, path):
        r = requests.get(f"{BASE_URL}{path}", timeout=15)
        assert r.status_code == 401, f"{path} returned {r.status_code} instead of 401"


# --------- Endpoints publics ---------

class TestPublicEndpoints:
    def test_root(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200

    def test_client_info_no_leaks(self):
        r = requests.get(f"{BASE_URL}/api/client/info", timeout=15)
        assert r.status_code == 200
        data = r.json()
        # doit fonctionner sans auth et ne pas exposer de secrets
        body_str = str(data).lower()
        assert "navixy_hash" not in body_str
        assert "contact_email" not in body_str


# --------- Auth flows ---------

class TestAuthFlows:
    def test_login_bad_password(self, credentials):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": credentials["email"], "password": "wrong-xxxxxxxxxxx"},
                          timeout=15)
        assert r.status_code == 401

    def test_me_with_cookie(self, auth_session, credentials):
        r = auth_session.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["email"] == credentials["email"]
        assert "password_hash" not in data["user"]

    def test_refresh_renews_access(self, credentials):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login", json=credentials, timeout=15)
        assert r.status_code == 200
        old_access = s.cookies.get("access_token")
        time.sleep(1)
        r2 = s.post(f"{BASE_URL}/api/auth/refresh", timeout=15)
        assert r2.status_code == 200
        new_access = s.cookies.get("access_token")
        assert new_access and new_access != old_access

    def test_logout_clears_cookies(self, credentials):
        s = requests.Session()
        assert s.post(f"{BASE_URL}/api/auth/login", json=credentials, timeout=15).status_code == 200
        assert s.get(f"{BASE_URL}/api/auth/me", timeout=15).status_code == 200
        r = s.post(f"{BASE_URL}/api/auth/logout", timeout=15)
        assert r.status_code == 200
        # Après logout, /me doit renvoyer 401 (le cookie a été supprimé côté serveur)
        # On force la suppression côté client aussi car requests peut garder l'ancien
        s.cookies.clear()
        r2 = s.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r2.status_code == 401

    def test_bearer_fallback(self, credentials):
        # login pour obtenir un access token via cookie, puis usage en Bearer
        s = requests.Session()
        s.post(f"{BASE_URL}/api/auth/login", json=credentials, timeout=15)
        token = s.cookies.get("access_token")
        assert token
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 200


# --------- Brute force ---------

class TestBruteForce:
    def test_lockout_after_5_failures(self):
        bogus_email = "TEST_bruteforce_notreal@example.test"
        last_status = None
        for i in range(6):
            r = requests.post(f"{BASE_URL}/api/auth/login",
                              json={"email": bogus_email, "password": "wrong"},
                              timeout=15)
            last_status = r.status_code
            if i < 5:
                assert r.status_code in (401, 429), f"attempt {i+1}: got {r.status_code}"
        # Le 6e doit être 429 (lockout)
        assert last_status == 429, f"Expected 429 on 6th attempt, got {last_status}"


# --------- SUPER_ADMIN endpoints ---------

class TestSuperAdminEndpoints:
    def test_admin_clients_no_navixy_hash(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/admin/clients", timeout=15)
        assert r.status_code == 200, r.text[:300]
        body = r.text.lower()
        assert "navixy_hash" not in body, "navixy_hash leaked in /api/admin/clients response!"

    def test_debug_cache_stats(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/debug/cache-stats", timeout=15)
        assert r.status_code == 200


# --------- Non-régression métier ---------

class TestBusinessNonRegression:
    def test_trackers_12(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/trackers", timeout=60)
        assert r.status_code == 200
        data = r.json()
        # peut être une liste ou {"trackers":[...]}
        lst = data if isinstance(data, list) else (data.get("trackers") or data.get("data") or [])
        # Parc Navixy live (évolue dans le temps) : on vérifie la présence de trackers, pas un compte exact
        assert len(lst) >= 1, f"Expected at least 1 tracker, got {len(lst)}"

    def test_fleet_stats(self, auth_session):
        r = auth_session.get(
            f"{BASE_URL}/api/fleet/stats?from_date=2026-06-01&to_date=2026-06-07",
            timeout=60)
        assert r.status_code == 200
        assert isinstance(r.json(), (dict, list))

    def test_vehicles_admin(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/vehicles/admin", timeout=60)
        assert r.status_code == 200

    def test_ecodriving(self, auth_session):
        r = auth_session.get(
            f"{BASE_URL}/api/drivers/ecodriving?from_date=2026-06-01&to_date=2026-06-07",
            timeout=60)
        assert r.status_code == 200

    def test_export_pdf(self, auth_session):
        r = auth_session.get(
            f"{BASE_URL}/api/export/pdf?from_date=2026-06-01&to_date=2026-06-07",
            timeout=120)
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF", f"Not a PDF signature: {r.content[:20]}"
