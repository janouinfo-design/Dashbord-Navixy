"""LOGITRAK — Phase 2.1 tests: must_change_password, refresh rotation, impersonation strict/expiry, audit."""
import os
import time
import hashlib
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

# ---------- Config ----------
frontend_env = dotenv_values("/app/frontend/.env")
backend_env = dotenv_values("/app/backend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
MONGO_URL = backend_env.get("MONGO_URL") or os.environ.get("MONGO_URL")
DB_NAME = backend_env.get("DB_NAME") or os.environ.get("DB_NAME")

SUPER = ("admin@logitrak.ch", "LT!u4qv8ibtN21iOHDz")
BETA_ADMIN = ("admin@test-beta.local", "Beta2026!admin")
ALPHA_ADMIN = ("admin@test-alpha.local", "Alpha2026!admin")


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed {email}: {r.status_code} {r.text[:200]}"
    return s, r


@pytest.fixture(scope="module")
def super_sess():
    s, _ = _login(*SUPER)
    return s


@pytest.fixture(scope="module")
def beta_id(super_sess):
    r = super_sess.get(f"{BASE_URL}/api/admin/overview", timeout=30)
    assert r.status_code == 200
    for c in r.json()["clients"]:
        if c["tenant"] == "test-beta":
            return c["id"]
    pytest.fail("test-beta client not found")


# ============================================================
#  MUST_CHANGE_PASSWORD flow
# ============================================================
class TestMustChangePassword:
    """1st login forces password change; /api/* blocked with 403 PASSWORD_CHANGE_REQUIRED except /api/auth/*."""

    email = f"TEST_phase21_{int(time.time())}@test-beta.local"

    @pytest.fixture(scope="class")
    def created_user(self, super_sess, beta_id):
        payload = {"email": self.email, "first_name": "T", "last_name": "P21", "role": "MANAGER"}
        r = super_sess.post(f"{BASE_URL}/api/admin/clients/{beta_id}/users", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        user_id = data["user"]["id"]
        temp = data["temp_password"]
        yield {"id": user_id, "email": self.email, "temp": temp}
        # cleanup: disable
        super_sess.put(f"{BASE_URL}/api/admin/users/{user_id}", json={"is_active": False}, timeout=20)

    def test_1_login_ok_flags_must_change(self, created_user):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": created_user["email"], "password": created_user["temp"]}, timeout=20)
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["must_change_password"] is True
        # cache session for next tests
        created_user["session"] = s

    def test_2_api_blocked_with_password_change_required(self, created_user):
        s = created_user["session"]
        r = s.get(f"{BASE_URL}/api/flows", timeout=15)
        assert r.status_code == 403
        assert r.json().get("detail") == "PASSWORD_CHANGE_REQUIRED"

    def test_3_change_wrong_current_401(self, created_user):
        s = created_user["session"]
        r = s.post(f"{BASE_URL}/api/auth/change-password",
                   json={"current_password": "wrong-xxx", "new_password": "NewValidPwd123!"}, timeout=15)
        assert r.status_code == 401

    def test_4_change_too_short_400(self, created_user):
        s = created_user["session"]
        r = s.post(f"{BASE_URL}/api/auth/change-password",
                   json={"current_password": created_user["temp"], "new_password": "short"}, timeout=15)
        assert r.status_code == 400

    def test_5_change_same_as_current_400(self, created_user):
        s = created_user["session"]
        r = s.post(f"{BASE_URL}/api/auth/change-password",
                   json={"current_password": created_user["temp"], "new_password": created_user["temp"]}, timeout=15)
        assert r.status_code == 400

    def test_6_change_success(self, created_user):
        s = created_user["session"]
        new_pw = "NewValidPwd123!Phase21"
        r = s.post(f"{BASE_URL}/api/auth/change-password",
                   json={"current_password": created_user["temp"], "new_password": new_pw}, timeout=15)
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["must_change_password"] is False
        created_user["new_pw"] = new_pw

    def test_7_api_now_accessible(self, created_user):
        s = created_user["session"]
        r = s.get(f"{BASE_URL}/api/flows", timeout=15)
        assert r.status_code == 200

    def test_8_old_temp_password_rejected(self, created_user):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": created_user["email"], "password": created_user["temp"]}, timeout=15)
        assert r.status_code == 401

    def test_9_login_with_new_password_ok(self, created_user):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": created_user["email"], "password": created_user["new_pw"]}, timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["must_change_password"] is False


# ============================================================
#  Refresh rotation + reuse detection + logout
# ============================================================
class TestRefreshRotation:
    """Refresh returns new cookie; replaying old refresh revokes all sessions."""

    def test_rotation_and_replay_revocation(self):
        # Use ALPHA_ADMIN (must_change already false) so we don't lockout SUPER
        s1 = requests.Session()
        r = s1.post(f"{BASE_URL}/api/auth/login",
                    json={"email": ALPHA_ADMIN[0], "password": ALPHA_ADMIN[1]}, timeout=15)
        assert r.status_code == 200
        r1 = s1.cookies.get("refresh_token")
        assert r1

        # First refresh with s1
        r_ref = s1.post(f"{BASE_URL}/api/auth/refresh", timeout=15)
        assert r_ref.status_code == 200
        r2 = s1.cookies.get("refresh_token")
        assert r2 and r2 != r1

        # Replay R1 in a new session (cookies isolated)
        s_old = requests.Session()
        s_old.cookies.set("refresh_token", r1, domain=requests.utils.urlparse(BASE_URL).hostname)
        r_replay = s_old.post(f"{BASE_URL}/api/auth/refresh", timeout=15)
        assert r_replay.status_code == 401

        # Now R2 must also be revoked (global revocation on reuse)
        s_new = requests.Session()
        s_new.cookies.set("refresh_token", r2, domain=requests.utils.urlparse(BASE_URL).hostname)
        r_r2 = s_new.post(f"{BASE_URL}/api/auth/refresh", timeout=15)
        assert r_r2.status_code == 401, f"R2 should be revoked after reuse detection, got {r_r2.status_code}"

        # Re-login OK
        s2 = requests.Session()
        r = s2.post(f"{BASE_URL}/api/auth/login",
                    json={"email": ALPHA_ADMIN[0], "password": ALPHA_ADMIN[1]}, timeout=15)
        assert r.status_code == 200

    def test_sessions_store_only_hash(self, mongo):
        # Any session doc must have token_hash sha256 (64 hex), never raw token
        for sess in mongo.sessions.find({}, {"_id": 0}).limit(50):
            assert "token_hash" in sess
            assert len(sess["token_hash"]) == 64
            assert all(c in "0123456789abcdef" for c in sess["token_hash"])
            assert "token" not in sess
            assert "refresh_token" not in sess

    def test_logout_revokes_refresh(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": ALPHA_ADMIN[0], "password": ALPHA_ADMIN[1]}, timeout=15)
        assert r.status_code == 200
        old_refresh = s.cookies.get("refresh_token")
        assert old_refresh
        r_out = s.post(f"{BASE_URL}/api/auth/logout", timeout=15)
        assert r_out.status_code == 200
        # Try using the old refresh
        s2 = requests.Session()
        s2.cookies.set("refresh_token", old_refresh, domain=requests.utils.urlparse(BASE_URL).hostname)
        r_ref = s2.post(f"{BASE_URL}/api/auth/refresh", timeout=15)
        assert r_ref.status_code == 401


# ============================================================
#  Impersonation strict + expiration
# ============================================================
class TestImpersonation:
    """Header X-Act-As-Tenant requires an OPEN impersonation_log for that tenant."""

    def test_1_header_without_session_403_invalid(self, super_sess):
        # Ensure no open session first
        super_sess.post(f"{BASE_URL}/api/admin/impersonation/end",
                        json={"log_id": "none"}, timeout=15)
        # Actually close any leftover
        # (end takes log_id; there might not be one — we rely on start below closing all)
        r = super_sess.get(f"{BASE_URL}/api/tenant/context",
                           headers={"X-Act-As-Tenant": "test-beta"}, timeout=15)
        # Must be 403 IMPERSONATION_INVALID
        assert r.status_code == 403
        assert r.json().get("detail") == "IMPERSONATION_INVALID"

    def test_2_start_then_beta_ok(self, super_sess):
        r_start = super_sess.post(f"{BASE_URL}/api/admin/impersonation/start",
                                  json={"tenant": "test-beta"}, timeout=15)
        assert r_start.status_code == 200
        log_id = r_start.json()["log_id"]

        r = super_sess.get(f"{BASE_URL}/api/tenant/context",
                           headers={"X-Act-As-Tenant": "test-beta"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        # tenant/context returns the tenant it's currently acting as
        assert data.get("tenant") == "test-beta" or data.get("current_tenant") == "test-beta" \
               or "test-beta" in str(data)
        return log_id

    def test_3_cross_tenant_header_denied(self, super_sess):
        # Open session is for test-beta; using another tenant header must fail
        r = super_sess.get(f"{BASE_URL}/api/tenant/context",
                           headers={"X-Act-As-Tenant": "test-alpha"}, timeout=15)
        assert r.status_code == 403
        assert r.json().get("detail") == "IMPERSONATION_INVALID"

    def test_4_end_then_header_denied(self, super_sess, mongo):
        # Find the open log
        log = mongo.impersonation_logs.find_one({"tenant": "test-beta", "ended_at": None})
        assert log
        r_end = super_sess.post(f"{BASE_URL}/api/admin/impersonation/end",
                                json={"log_id": log["id"]}, timeout=15)
        assert r_end.status_code == 200
        r = super_sess.get(f"{BASE_URL}/api/tenant/context",
                           headers={"X-Act-As-Tenant": "test-beta"}, timeout=15)
        assert r.status_code == 403

    def test_5_manager_role_header_ignored(self, mongo):
        # MANAGER beta with header test-alpha must stay on its own tenant (header silently ignored for non-SUPER)
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": "mgr21@test-beta.local", "password": "MonNouveauMdp21!"}, timeout=15)
        assert r.status_code == 200, r.text
        r_ctx = s.get(f"{BASE_URL}/api/tenant/context",
                      headers={"X-Act-As-Tenant": "test-alpha"}, timeout=15)
        assert r_ctx.status_code == 200, r_ctx.text
        assert r_ctx.json()["tenant"] == "test-beta"

    def test_6_expiration_60min(self, super_sess, mongo):
        # Start a fresh impersonation
        r_start = super_sess.post(f"{BASE_URL}/api/admin/impersonation/start",
                                  json={"tenant": "test-beta"}, timeout=15)
        assert r_start.status_code == 200
        log_id = r_start.json()["log_id"]

        # Age started_at by 61 minutes in Mongo
        old = (datetime.now(timezone.utc) - timedelta(minutes=61)).isoformat()
        mongo.impersonation_logs.update_one({"id": log_id}, {"$set": {"started_at": old}})

        r = super_sess.get(f"{BASE_URL}/api/tenant/context",
                           headers={"X-Act-As-Tenant": "test-beta"}, timeout=15)
        assert r.status_code == 403
        assert r.json().get("detail") == "IMPERSONATION_EXPIRED"

        # The log should now be closed with expired=true
        log = mongo.impersonation_logs.find_one({"id": log_id})
        assert log.get("expired") is True
        assert log.get("ended_at") is not None

        # Audit IMPERSONATION_EXPIRED present
        aud = mongo.audit_log.find_one({"action": "IMPERSONATION_EXPIRED", "tenant": "test-beta"},
                                       sort=[("at", -1)])
        assert aud is not None


# ============================================================
#  Audit log integrity
# ============================================================
class TestAuditLog:
    """Audit contains expected actions and never leaks secrets."""

    SECRET_KEYS = {"password", "password_hash", "jwt", "token", "refresh", "navixy_hash", "secret"}

    def test_actions_present(self, mongo):
        actions = set(mongo.audit_log.distinct("action"))
        for expected in ("LOGIN_SUCCESS", "PASSWORD_CHANGED",
                         "IMPERSONATION_STARTED", "IMPERSONATION_ENDED", "IMPERSONATION_EXPIRED"):
            assert expected in actions, f"Missing audit action {expected} in {actions}"

    def test_no_secret_leak(self, mongo):
        for doc in mongo.audit_log.find({}, {"_id": 0}).limit(500):
            for k, v in doc.items():
                assert k.lower() not in self.SECRET_KEYS, f"Audit contains secret key {k}"
                if isinstance(v, str):
                    # heuristic: bcrypt/jwt/hex hash chunks
                    assert not v.startswith("$2b$"), f"bcrypt hash leaked: {doc}"
                    assert not (v.count(".") == 2 and len(v) > 60 and v.split(".")[0].startswith("ey")), \
                        f"JWT leaked in audit: {doc}"
