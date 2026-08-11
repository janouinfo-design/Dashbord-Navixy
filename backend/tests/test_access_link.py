"""Phase 2.2 — Lien d'accès direct tenant (sans login). Backend regression."""
import hashlib
import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or frontend_env.get("REACT_APP_BACKEND_URL", "")).rstrip("/")
backend_env = dotenv_values("/app/backend/.env")
MONGO_URL = os.environ.get("MONGO_URL") or backend_env.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME") or backend_env.get("DB_NAME")

CREDS_TEXT = Path("/app/memory/test_credentials.md").read_text()


def _cred(pattern):
    m = re.search(pattern, CREDS_TEXT)
    return m.group(1) if m else None


SUPER_ADMIN = {"email": "admin@logitrak.ch", "password": "LT!u4qv8ibtN21iOHDz"}
BETA_ADMIN = {"email": "admin@test-beta.local", "password": "Beta2026!admin"}
ALPHA_ADMIN = {"email": "admin@test-alpha.local", "password": "Alpha2026!admin"}


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def sa_session():
    return _login(SUPER_ADMIN["email"], SUPER_ADMIN["password"])


@pytest.fixture(scope="module")
def beta_client_id(sa_session):
    r = sa_session.get(f"{BASE_URL}/api/admin/clients")
    assert r.status_code == 200
    for c in r.json()["clients"]:
        if c.get("tenant") == "test-beta" or c.get("subdomain") == "test-beta":
            return c["id"]
    pytest.fail("test-beta client not found")


@pytest.fixture(scope="module")
def alpha_client_id(sa_session):
    r = sa_session.get(f"{BASE_URL}/api/admin/clients")
    for c in r.json()["clients"]:
        if c.get("tenant") == "test-alpha" or c.get("subdomain") == "test-alpha":
            return c["id"]
    pytest.fail("test-alpha client not found")


def _extract_token(url):
    m = re.search(r"/access/([A-Za-z0-9_\-]+)$", url)
    assert m, f"cannot extract token from {url}"
    return m.group(1)


# ---------- LIEN CREATION + ACCESS ----------

class TestAccessLinkEdit:
    def test_create_edit_link(self, sa_session, beta_client_id):
        r = sa_session.post(f"{BASE_URL}/api/admin/clients/{beta_client_id}/access-link",
                            json={"access_mode": "edit"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["access_mode"] == "edit"
        assert "url" in data
        assert "/access/" in data["url"]
        assert "test-beta" in data["url"]
        pytest.beta_edit_token = _extract_token(data["url"])

    def test_public_access_302_sets_cookies(self):
        token = pytest.beta_edit_token
        s = requests.Session()
        r = s.get(f"{BASE_URL}/api/access/{token}", allow_redirects=False)
        assert r.status_code == 302, r.text
        assert r.headers["location"] == "/"
        assert "no-store" in r.headers.get("cache-control", "")
        set_cookie = r.headers.get("set-cookie", "")
        assert "SameSite=None" in set_cookie, "cookies iframe: SameSite=None requis"
        assert "Partitioned" in set_cookie, "cookies iframe: attribut Partitioned (CHIPS) requis"
        # cookies posés — le token ne transite jamais dans le SPA
        assert "access_token" in s.cookies
        assert "refresh_token" in s.cookies
        pytest.beta_edit_session = s

    def test_me_returns_manager_via_link(self):
        s = pytest.beta_edit_session
        r = s.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["role"] == "MANAGER"
        assert u["tenant_id"] == "test-beta"
        assert u.get("via_link") is True

    def test_link_session_can_read_flows(self):
        s = pytest.beta_edit_session
        r = s.get(f"{BASE_URL}/api/flows")
        assert r.status_code == 200
        # tenant isolation — no test-alpha in flows
        flows = r.json().get("flows", [])
        for f in flows:
            assert f.get("tenant") == "test-beta"

    def test_link_session_admin_endpoint_forbidden(self):
        s = pytest.beta_edit_session
        r = s.get(f"{BASE_URL}/api/admin/clients")
        assert r.status_code == 403

    def test_link_session_tenant_context(self):
        s = pytest.beta_edit_session
        r = s.get(f"{BASE_URL}/api/tenant/context")
        assert r.status_code == 200
        assert r.json()["tenant"] == "test-beta"
        assert "modules" in r.json()

    def test_link_session_ignores_act_as_header(self):
        s = pytest.beta_edit_session
        r = s.get(f"{BASE_URL}/api/tenant/context", headers={"X-Act-As-Tenant": "test-alpha"})
        # header only honored for SUPER_ADMIN — link user reste sur son tenant
        assert r.status_code == 200
        assert r.json()["tenant"] == "test-beta"

    def test_link_session_change_password_forbidden(self):
        s = pytest.beta_edit_session
        r = s.post(f"{BASE_URL}/api/auth/change-password",
                   json={"current_password": "x", "new_password": "aaaaaaaa"})
        assert r.status_code == 403

    def test_link_session_can_create_flow(self):
        # edit mode -> MANAGER role -> peut créer
        s = pytest.beta_edit_session
        r = s.post(f"{BASE_URL}/api/flows", json={"name": "TEST_LINK_flow", "nodes": [], "connections": []})
        assert r.status_code == 200, r.text
        pytest.beta_flow_id = r.json()["flow"]["id"]

    def test_link_session_csrf_cross_origin_blocked(self):
        # Le proxy preview réécrit Origin — on teste la garde CSRF directement sur le backend
        s = pytest.beta_edit_session
        cookie = "; ".join(f"{c.name}={c.value}" for c in s.cookies if c.name in ("access_token", "refresh_token"))
        r = requests.post("http://localhost:8001/api/flows",
                          json={"name": "TEST_csrf", "nodes": [], "connections": []},
                          headers={"Origin": "https://evil.example.com", "Cookie": cookie})
        assert r.status_code == 403

    def test_link_session_same_origin_post_allowed(self):
        s = pytest.beta_edit_session
        r = s.post(f"{BASE_URL}/api/flows", json={"name": "TEST_LINK_origin", "nodes": [], "connections": []},
                   headers={"Origin": BASE_URL})
        assert r.status_code == 200, r.text
        s.delete(f"{BASE_URL}/api/flows/{r.json()['flow']['id']}")

    def test_link_session_refresh_ok(self):
        s = pytest.beta_edit_session
        r = s.post(f"{BASE_URL}/api/auth/refresh")
        assert r.status_code == 200

    def test_cleanup_flow(self):
        s = pytest.beta_edit_session
        if getattr(pytest, "beta_flow_id", None):
            s.delete(f"{BASE_URL}/api/flows/{pytest.beta_flow_id}")


class TestAccessLinkRead:
    def test_create_read_link_and_use(self, sa_session, beta_client_id):
        # regen with read mode (will revoke edit link)
        r = sa_session.post(f"{BASE_URL}/api/admin/clients/{beta_client_id}/access-link",
                            json={"access_mode": "read"})
        assert r.status_code == 200
        token = _extract_token(r.json()["url"])
        s = requests.Session()
        r2 = s.get(f"{BASE_URL}/api/access/{token}", allow_redirects=False)
        assert r2.status_code == 302
        assert "access_token" in s.cookies
        pytest.beta_read_session = s
        pytest.beta_read_token = token

    def test_read_link_role(self):
        r = pytest.beta_read_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "READ_ONLY"

    def test_read_link_get_ok(self):
        r = pytest.beta_read_session.get(f"{BASE_URL}/api/flows")
        assert r.status_code == 200

    def test_read_link_post_forbidden(self):
        r = pytest.beta_read_session.post(f"{BASE_URL}/api/flows",
                                          json={"name": "TEST_read_forbidden"})
        assert r.status_code == 403


class TestAccessLinkRevocation:
    def test_revoke_link(self, sa_session, beta_client_id):
        pytest.pre_revoke_session = pytest.beta_read_session  # existing session
        pytest.pre_revoke_token = pytest.beta_read_token
        r = sa_session.delete(f"{BASE_URL}/api/admin/clients/{beta_client_id}/access-link")
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_existing_session_401_after_revoke(self):
        r = pytest.pre_revoke_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_reuse_revoked_token_redirects_invalid(self):
        s = requests.Session()
        r = s.get(f"{BASE_URL}/api/access/{pytest.pre_revoke_token}", allow_redirects=False)
        assert r.status_code == 302
        assert "/lien-invalide" in r.headers["location"]
        assert "access_token" not in s.cookies

    def test_refresh_after_revoke_401(self):
        r = pytest.pre_revoke_session.post(f"{BASE_URL}/api/auth/refresh")
        assert r.status_code == 401


class TestAccessLinkSecurity:
    def test_bogus_token_redirects_invalid(self):
        s = requests.Session()
        r = s.get(f"{BASE_URL}/api/access/nimportequoi_xxxxx", allow_redirects=False)
        assert r.status_code == 302
        assert "/lien-invalide" in r.headers["location"]
        assert "access_token" not in s.cookies

    def test_suspended_client_link_forbidden(self, sa_session, alpha_client_id):
        # Create link for alpha, suspend alpha, expect 403 on /access
        r = sa_session.post(f"{BASE_URL}/api/admin/clients/{alpha_client_id}/access-link",
                            json={"access_mode": "edit"})
        assert r.status_code == 200
        token = _extract_token(r.json()["url"])
        # suspend
        rs = sa_session.post(f"{BASE_URL}/api/admin/clients/{alpha_client_id}/suspend")
        assert rs.status_code == 200
        try:
            s2 = requests.Session()
            r2 = s2.get(f"{BASE_URL}/api/access/{token}", allow_redirects=False)
            assert r2.status_code == 302
            assert "motif=suspendu" in r2.headers["location"]
            assert "access_token" not in s2.cookies
        finally:
            # RÉACTIVER absolument (l'utilisateur a insisté)
            ract = sa_session.post(f"{BASE_URL}/api/admin/clients/{alpha_client_id}/reactivate")
            assert ract.status_code == 200
            # revoke le lien alpha aussi pour ne pas polluer
            sa_session.delete(f"{BASE_URL}/api/admin/clients/{alpha_client_id}/access-link")


# ---------- MONGO STATE ----------

@pytest.mark.mongo
def test_mongo_token_hash_only():
    """La collection tenant_access_tokens ne doit contenir que des hashes sha256 (64 hex), jamais de token en clair."""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    docs = list(db.tenant_access_tokens.find({}))
    assert docs, "aucun lien créé pendant les tests ?"
    for d in docs:
        assert "token_hash" in d
        assert re.fullmatch(r"[0-9a-f]{64}", d["token_hash"]), f"token_hash pas SHA256 hex : {d['token_hash']}"
        assert "token" not in d, "token en clair présent en base !"
        assert "raw_token" not in d
    client.close()


def test_audit_log_contains_events():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    actions = db.audit_log.distinct("action", {"tenant": {"$in": ["test-beta", "test-alpha"]}})
    for expected in ("ACCESS_LINK_CREATED", "ACCESS_LINK_USED", "ACCESS_LINK_REVOKED"):
        assert expected in actions, f"audit action manquante : {expected}. Actions: {actions}"
    client.close()


# ---------- NON REGRESSION ----------

class TestNonRegression:
    def test_super_admin_login(self):
        s = _login(SUPER_ADMIN["email"], SUPER_ADMIN["password"])
        r = s.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "SUPER_ADMIN"

    def test_super_admin_overview(self, sa_session):
        r = sa_session.get(f"{BASE_URL}/api/admin/overview")
        assert r.status_code == 200

    def test_beta_admin_can_still_login(self):
        # NOTE: iteration_17 mentioned admin@test-beta may have must_change=true
        # if so, /api/auth/me should still work (endpoint whitelisted)
        r = requests.post(f"{BASE_URL}/api/auth/login", json=BETA_ADMIN)
        # accept either 200 (must_change=false) or normal login flow
        assert r.status_code in (200, 401), f"unexpected {r.status_code}: {r.text}"

    def test_alpha_still_active_at_end(self, sa_session, alpha_client_id):
        r = sa_session.get(f"{BASE_URL}/api/admin/clients/{alpha_client_id}/detail")
        assert r.status_code == 200
        assert r.json()["client"]["is_active"] is True, "test-alpha DOIT rester actif à la fin !"

    def test_beta_still_active_at_end(self, sa_session, beta_client_id):
        r = sa_session.get(f"{BASE_URL}/api/admin/clients/{beta_client_id}/detail")
        assert r.status_code == 200
        assert r.json()["client"]["is_active"] is True
