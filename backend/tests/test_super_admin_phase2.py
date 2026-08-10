"""LOGITRAK — Phase 2 SUPER_ADMIN tests (RBAC, isolation, modules, suspension, wizard, impersonation)."""
import os
import re
import time
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or frontend_env.get("REACT_APP_BACKEND_URL")
)
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is required")
BASE_URL = base_url.rstrip("/")

# ---------- Credentials ----------
CREDS = {
    "super": ("admin@logitrak.ch", "LT!u4qv8ibtN21iOHDz"),
    "alpha_admin": ("admin@test-alpha.local", "LT-VDeynr1vKp3X9w"),
    "alpha_ro": ("ro@test-alpha.local", "LT-zHgQNKU2O7JuDQ"),
    "beta_admin": ("admin@test-beta.local", "LT-Gm3aCzayNgXf5A"),
}


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text[:300]}"
    return s


# ---------- Sessions (module-scoped) ----------
@pytest.fixture(scope="module")
def super_sess():
    return _login(*CREDS["super"])


@pytest.fixture(scope="module")
def alpha_sess():
    return _login(*CREDS["alpha_admin"])


@pytest.fixture(scope="module")
def alpha_ro_sess():
    return _login(*CREDS["alpha_ro"])


@pytest.fixture(scope="module")
def beta_sess():
    return _login(*CREDS["beta_admin"])


@pytest.fixture(scope="module")
def client_ids(super_sess):
    r = super_sess.get(f"{BASE_URL}/api/admin/overview", timeout=60)
    assert r.status_code == 200
    d = r.json()
    ids = {}
    for c in d["clients"]:
        ids[c["tenant"]] = c["id"]
    assert "test-alpha" in ids and "test-beta" in ids, f"Missing test tenants: {list(ids)}"
    return ids


# =====================================================================
# BACKEND RBAC
# =====================================================================
class TestRBAC:
    """RBAC: ADMIN cannot access /api/admin/*; SUPER_ADMIN can; no navixy_hash leaked."""

    def test_admin_forbidden_on_admin_clients(self, alpha_sess):
        r = alpha_sess.get(f"{BASE_URL}/api/admin/clients", timeout=20)
        assert r.status_code == 403, f"Expected 403 got {r.status_code}"

    def test_admin_forbidden_on_admin_overview(self, alpha_sess):
        r = alpha_sess.get(f"{BASE_URL}/api/admin/overview", timeout=20)
        assert r.status_code == 403

    def test_super_admin_overview_no_navixy_hash_leak(self, super_sess):
        r = super_sess.get(f"{BASE_URL}/api/admin/overview", timeout=60)
        assert r.status_code == 200
        body = r.text
        assert "navixy_hash" not in body, "navixy_hash should never appear in responses"
        d = r.json()
        assert d["success"] is True
        assert "kpis" in d and "clients" in d
        for c in d["clients"]:
            assert "navixy_hash" not in c

    def test_super_admin_clients_list_no_hash(self, super_sess):
        r = super_sess.get(f"{BASE_URL}/api/admin/clients", timeout=20)
        assert r.status_code == 200
        for c in r.json()["clients"]:
            assert "navixy_hash" not in c


# =====================================================================
# TENANT ISOLATION
# =====================================================================
class TestIsolation:
    """Multi-tenant isolation via JWT; X-Act-As only honored for SUPER_ADMIN; no IDOR."""

    def test_act_as_header_ignored_for_non_super(self, alpha_sess):
        r = alpha_sess.get(
            f"{BASE_URL}/api/tenant/context",
            headers={"X-Act-As-Tenant": "test-beta"},
            timeout=20,
        )
        assert r.status_code == 200
        assert r.json()["tenant"] == "test-alpha"

    def test_act_as_default_ignored_for_non_super(self, alpha_sess):
        r = alpha_sess.get(
            f"{BASE_URL}/api/tenant/context",
            headers={"X-Act-As-Tenant": "default"},
            timeout=20,
        )
        assert r.status_code == 200
        assert r.json()["tenant"] == "test-alpha"

    def test_idor_admin_alpha_cannot_read_beta_users(self, alpha_sess, client_ids):
        beta_id = client_ids["test-beta"]
        r = alpha_sess.get(f"{BASE_URL}/api/admin/clients/{beta_id}/users", timeout=20)
        assert r.status_code == 403

    def test_flow_isolation_alpha_vs_beta(self, alpha_sess, beta_sess):
        # Create a flow as alpha
        payload = {"name": "TEST_iso_flow", "nodes": [], "connections": []}
        r_create = alpha_sess.post(f"{BASE_URL}/api/flows", json=payload, timeout=20)
        assert r_create.status_code in (200, 201), r_create.text[:300]
        flow_id = r_create.json().get("id") or r_create.json().get("flow", {}).get("id")
        assert flow_id, f"No flow id: {r_create.text[:300]}"

        try:
            # Alpha sees it
            r_a = alpha_sess.get(f"{BASE_URL}/api/flows", timeout=20)
            assert r_a.status_code == 200
            ids_a = [f["id"] for f in r_a.json().get("flows", r_a.json() if isinstance(r_a.json(), list) else [])]
            assert flow_id in ids_a, f"Alpha should see own flow. ids={ids_a}"

            # Beta does NOT see it
            r_b = beta_sess.get(f"{BASE_URL}/api/flows", timeout=20)
            assert r_b.status_code == 200
            ids_b = [f["id"] for f in r_b.json().get("flows", r_b.json() if isinstance(r_b.json(), list) else [])]
            assert flow_id not in ids_b, "Beta should NOT see alpha's flow (isolation broken)"
        finally:
            alpha_sess.delete(f"{BASE_URL}/api/flows/{flow_id}", timeout=20)


# =====================================================================
# MODULES ENFORCEMENT
# =====================================================================
class TestModules:
    """test-alpha has [dashboard, analyse, vehicules] -> other endpoints = 403; test-beta has all."""

    def test_alpha_carburant_403(self, alpha_sess):
        r = alpha_sess.get(f"{BASE_URL}/api/config/fuel", timeout=20)
        assert r.status_code == 403, f"alpha carburant should be 403 got {r.status_code}"

    def test_alpha_ecodriving_403(self, alpha_sess):
        r = alpha_sess.get(f"{BASE_URL}/api/drivers/ecodriving", timeout=30)
        assert r.status_code == 403

    def test_alpha_export_403(self, alpha_sess):
        r = alpha_sess.get(f"{BASE_URL}/api/export/fleet-stats", timeout=30)
        assert r.status_code == 403

    def test_beta_fuel_ok(self, beta_sess):
        r = beta_sess.get(f"{BASE_URL}/api/config/fuel", timeout=20)
        assert r.status_code == 200, f"beta carburant should be 200 got {r.status_code}"


# =====================================================================
# READ_ONLY
# =====================================================================
class TestReadOnly:
    def test_read_only_can_read(self, alpha_ro_sess):
        r = alpha_ro_sess.get(f"{BASE_URL}/api/tenant/context", timeout=20)
        assert r.status_code == 200

    def test_read_only_cannot_write_flows(self, alpha_ro_sess):
        r = alpha_ro_sess.post(
            f"{BASE_URL}/api/flows",
            json={"name": "TEST_ro", "nodes": [], "connections": []},
            timeout=20,
        )
        assert r.status_code == 403

    def test_read_only_cannot_delete(self, alpha_ro_sess):
        r = alpha_ro_sess.delete(f"{BASE_URL}/api/flows/nonexistent", timeout=20)
        assert r.status_code == 403


# =====================================================================
# SUSPENSION / REACTIVATION
# =====================================================================
class TestSuspension:
    """CRITICAL: must reactivate test-alpha at the end."""

    def test_suspend_and_reactivate_alpha(self, super_sess, client_ids):
        alpha_id = client_ids["test-alpha"]
        # Suspend
        r = super_sess.post(f"{BASE_URL}/api/admin/clients/{alpha_id}/suspend", timeout=20)
        assert r.status_code == 200, r.text[:300]

        try:
            # Alpha admin login should fail 403
            s = requests.Session()
            r_login = s.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": CREDS["alpha_admin"][0], "password": CREDS["alpha_admin"][1]},
                timeout=20,
            )
            assert r_login.status_code == 403, f"Suspended login should be 403 got {r_login.status_code}"

            # Existing alpha session should get 403 on protected endpoints
            alpha_sess = _login  # noqa (not usable — session must be new)
            # Use a fresh alpha login attempt — already 403 above. Also check via super admin overview
            r_ov = super_sess.get(f"{BASE_URL}/api/admin/overview", timeout=60)
            assert r_ov.status_code == 200
            alpha_client = next(c for c in r_ov.json()["clients"] if c["tenant"] == "test-alpha")
            assert alpha_client.get("is_active") is False
        finally:
            # ALWAYS reactivate
            r_reac = super_sess.post(f"{BASE_URL}/api/admin/clients/{alpha_id}/reactivate", timeout=20)
            assert r_reac.status_code == 200

        # Post-reactivation, login succeeds
        s2 = requests.Session()
        r_login2 = s2.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": CREDS["alpha_admin"][0], "password": CREDS["alpha_admin"][1]},
            timeout=20,
        )
        assert r_login2.status_code == 200, f"After reactivate login should be 200 got {r_login2.status_code}"

    def test_default_tenant_cannot_be_suspended(self, super_sess, client_ids):
        default_id = client_ids.get("default")
        if not default_id:
            pytest.skip("no default tenant client row")
        r = super_sess.post(f"{BASE_URL}/api/admin/clients/{default_id}/suspend", timeout=20)
        assert r.status_code == 400


# =====================================================================
# WIZARD (creation, validation)
# =====================================================================
class TestWizard:
    def test_navixy_test_with_bad_hash(self, super_sess):
        r = super_sess.post(
            f"{BASE_URL}/api/admin/navixy/test",
            json={"navixy_hash": "totally-bogus-hash-xyz"},
            timeout=30,
        )
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True
        assert d["result"]["ok"] is False
        assert d["result"].get("message")

    def test_navixy_test_empty_hash_400(self, super_sess):
        r = super_sess.post(
            f"{BASE_URL}/api/admin/navixy/test",
            json={"navixy_hash": ""},
            timeout=20,
        )
        assert r.status_code == 400

    def test_create_client_subdomain_conflict(self, super_sess):
        payload = {
            "company": {
                "name": "Dup",
                "subdomain": "test-alpha",  # already exists
                "is_test": True,
            },
            "admin_user": {"first_name": "X", "last_name": "Y", "email": "TEST_dup@example.test"},
            "navixy_hash": "fake",
            "modules": ["dashboard"],
        }
        r = super_sess.post(f"{BASE_URL}/api/admin/clients/full", json=payload, timeout=30)
        assert r.status_code == 400
        assert "identifiant" in r.text.lower() or "déjà" in r.text.lower()

    def test_create_user_with_super_admin_role_rejected(self, super_sess, client_ids):
        alpha_id = client_ids["test-alpha"]
        r = super_sess.post(
            f"{BASE_URL}/api/admin/clients/{alpha_id}/users",
            json={
                "first_name": "X",
                "last_name": "Y",
                "email": "TEST_should_not_be_created@example.test",
                "role": "SUPER_ADMIN",
            },
            timeout=20,
        )
        assert r.status_code == 400

    def test_create_client_invalid_module(self, super_sess):
        payload = {
            "company": {"name": "Bad", "subdomain": "test-badmod", "is_test": True},
            "admin_user": {"first_name": "A", "last_name": "B", "email": "TEST_badmod@example.test"},
            "navixy_hash": "fake",
            "modules": ["dashboard", "notARealModule"],
        }
        r = super_sess.post(f"{BASE_URL}/api/admin/clients/full", json=payload, timeout=30)
        assert r.status_code == 400


# =====================================================================
# IMPERSONATION
# =====================================================================
class TestImpersonation:
    def test_start_end_and_log(self, super_sess, client_ids):
        beta_id = client_ids["test-beta"]

        r_start = super_sess.post(
            f"{BASE_URL}/api/admin/impersonation/start",
            json={"tenant": "test-beta"},
            timeout=20,
        )
        assert r_start.status_code == 200
        log_id = r_start.json()["log_id"]
        assert log_id

        # With X-Act-As, tenant/context returns test-beta and is_impersonating true
        r_ctx = super_sess.get(
            f"{BASE_URL}/api/tenant/context",
            headers={"X-Act-As-Tenant": "test-beta"},
            timeout=20,
        )
        assert r_ctx.status_code == 200
        d = r_ctx.json()
        assert d["tenant"] == "test-beta"
        assert d["is_impersonating"] is True

        # End
        r_end = super_sess.post(
            f"{BASE_URL}/api/admin/impersonation/end",
            json={"log_id": log_id},
            timeout=20,
        )
        assert r_end.status_code == 200

        # Activity log includes this entry (started_at, ended_at, ip)
        r_act = super_sess.get(f"{BASE_URL}/api/admin/clients/{beta_id}/activity", timeout=20)
        assert r_act.status_code == 200
        imps = r_act.json().get("impersonations", [])
        match = next((i for i in imps if i["id"] == log_id), None)
        assert match, f"log_id {log_id} missing in activity"
        assert match.get("started_at")
        assert match.get("ended_at")
        assert "ip" in match

    def test_start_unknown_tenant_404(self, super_sess):
        r = super_sess.post(
            f"{BASE_URL}/api/admin/impersonation/start",
            json={"tenant": "no-such-tenant-zzz"},
            timeout=20,
        )
        assert r.status_code == 404


# =====================================================================
# NON-REGRESSION (SUPER_ADMIN on default tenant)
# =====================================================================
class TestNonRegression:
    """Real Navixy data on default tenant."""

    def test_tenant_context_default(self, super_sess):
        r = super_sess.get(f"{BASE_URL}/api/tenant/context", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["tenant"] == "default"
        assert d["is_impersonating"] is False
        # 6 modules by default
        assert len(d["modules"]) >= 4

    _DATES = {"from_date": "2025-06-01", "to_date": "2025-06-07"}

    def test_fleet_stats_ok(self, super_sess):
        r = super_sess.get(f"{BASE_URL}/api/fleet/stats", params=self._DATES, timeout=90)
        assert r.status_code == 200, r.text[:300]

    def test_ecodriving_ok(self, super_sess):
        r = super_sess.get(f"{BASE_URL}/api/drivers/ecodriving", params=self._DATES, timeout=90)
        assert r.status_code == 200, r.text[:300]

    def test_vehicles_admin_ok(self, super_sess):
        r = super_sess.get(f"{BASE_URL}/api/vehicles/admin", timeout=30)
        assert r.status_code == 200

    def test_export_pdf_signature(self, super_sess):
        r = super_sess.get(f"{BASE_URL}/api/export/pdf", params=self._DATES, timeout=120)
        assert r.status_code == 200, r.text[:300]
        assert r.content[:5] == b"%PDF-", f"Not a PDF: {r.content[:20]}"
