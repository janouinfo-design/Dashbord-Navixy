"""Backend tests — Phase 2 multi-energy Capability Map."""
import os
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

SUPER = {"email": "admin@logitrak.ch", "password": "LT!u4qv8ibtN21iOHDz"}
BETA = {"email": "admin@test-beta.local", "password": "Beta2026!admin"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def super_admin():
    return _login(SUPER)


@pytest.fixture(scope="module")
def beta_admin():
    return _login(BETA)


@pytest.fixture(scope="module")
def flex_impersonation(super_admin):
    r = super_admin.post(f"{BASE_URL}/api/admin/impersonation/start", json={"tenant": "flex"}, timeout=30)
    assert r.status_code == 200, r.text
    log_id = r.json()["log_id"]
    yield log_id
    super_admin.post(f"{BASE_URL}/api/admin/impersonation/end", json={"log_id": log_id}, timeout=30)


# --- Techlift (default tenant) capabilities ---
class TestCapabilitiesTechlift:
    def test_techlift_37_records(self, super_admin):
        r = super_admin.get(f"{BASE_URL}/api/vehicles/capabilities", timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True
        assert d["tenant"] == "default"
        assert len(d["records"]) == 37

    def test_techlift_capability_counts(self, super_admin):
        d = super_admin.get(f"{BASE_URL}/api/vehicles/capabilities", timeout=60).json()
        recs = d["records"]
        gps = sum(1 for r in recs.values() if r["capabilities"].get("gps", {}).get("available"))
        od = sum(1 for r in recs.values() if r["capabilities"].get("odometer", {}).get("available"))
        eh = sum(1 for r in recs.values() if r["capabilities"].get("engine_hours", {}).get("available"))
        fl = sum(1 for r in recs.values() if r["capabilities"].get("fuel_level", {}).get("available"))
        vin = sum(1 for r in recs.values() if r["capabilities"].get("vin_obd", {}).get("available"))
        assert gps == 37
        assert 30 <= od <= 36
        assert 24 <= eh <= 30
        assert 1 <= fl <= 6
        assert 2 <= vin <= 8

    def test_techlift_value_schema(self, super_admin):
        d = super_admin.get(f"{BASE_URL}/api/vehicles/capabilities", timeout=60).json()
        for rec in d["records"].values():
            for key in ("fuel_level", "odometer", "engine_hours", "fuel_consumption_obd"):
                cap = rec["capabilities"].get(key)
                assert cap is not None
                assert "available" in cap
                if cap["available"]:
                    for req in ("value", "unit", "source", "update_time", "status"):
                        assert req in cap, f"{key} missing {req}"
                    assert cap["status"] in ("AVAILABLE", "STALE", "UNAVAILABLE")

    def test_ev_keys_always_unavailable_techlift(self, super_admin):
        d = super_admin.get(f"{BASE_URL}/api/vehicles/capabilities", timeout=60).json()
        ev = ("ev_soc", "ev_range", "ev_energy_consumed", "ev_kwh_per_100km",
              "ev_charging_state", "ev_charging_power", "ev_energy_charged")
        for rec in d["records"].values():
            for k in ev:
                cap = rec["capabilities"].get(k)
                assert cap is not None
                assert cap["available"] is False
                assert cap["status"] == "UNAVAILABLE"

    def test_individual_tracker_ok_and_404(self, super_admin):
        d = super_admin.get(f"{BASE_URL}/api/vehicles/capabilities", timeout=60).json()
        tid = int(next(iter(d["records"].keys())))
        r = super_admin.get(f"{BASE_URL}/api/vehicles/{tid}/capabilities", timeout=30)
        assert r.status_code == 200
        assert r.json()["success"] is True
        assert r.json()["record"]["tracker_id"] == tid
        r404 = super_admin.get(f"{BASE_URL}/api/vehicles/99999999/capabilities", timeout=30)
        assert r404.status_code == 404

    def test_cache_fast_second_call(self, super_admin):
        import time
        super_admin.get(f"{BASE_URL}/api/vehicles/capabilities", timeout=60)
        t0 = time.time()
        r = super_admin.get(f"{BASE_URL}/api/vehicles/capabilities", timeout=30)
        dt = time.time() - t0
        assert r.status_code == 200
        assert dt < 2.0, f"cache slow: {dt}s"


# --- FlexMobil capabilities via impersonation ---
class TestCapabilitiesFlex:
    def test_flex_52_records(self, super_admin, flex_impersonation):
        r = super_admin.get(f"{BASE_URL}/api/vehicles/capabilities",
                            headers={"X-Act-As-Tenant": "flex"}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True
        assert d["tenant"] == "flex"
        assert len(d["records"]) == 52

    def test_flex_zoe_unknown_no_ev(self, super_admin, flex_impersonation):
        d = super_admin.get(f"{BASE_URL}/api/vehicles/capabilities",
                            headers={"X-Act-As-Tenant": "flex"}, timeout=60).json()
        zoe = d["records"]["3467705"]
        assert zoe["motorisation"]["normalized"] == "unknown"
        assert zoe["motorisation"]["source"] == "none"
        assert zoe["capabilities"]["fuel_level"]["available"] is False
        for k in ("ev_soc", "ev_range", "ev_energy_consumed", "ev_kwh_per_100km",
                  "ev_charging_state", "ev_charging_power", "ev_energy_charged"):
            cap = zoe["capabilities"][k]
            assert cap["available"] is False
            assert cap["status"] == "UNAVAILABLE"

    def test_flex_prius_dtc_stale_vin(self, super_admin, flex_impersonation):
        d = super_admin.get(f"{BASE_URL}/api/vehicles/capabilities",
                            headers={"X-Act-As-Tenant": "flex"}, timeout=60).json()
        prius = d["records"]["3467697"]
        assert prius["dtc"] is not None
        assert "P0A80" in prius["dtc"]["codes"]
        assert prius["dtc"]["status"] == "STALE"
        assert prius["dtc"]["update_time"].startswith("2026-06-05")
        assert prius["vin"] is not None
        assert prius["vin"]["obd"] and prius["vin"]["garage"]
        assert prius["vin"]["conflict"] is False

    def test_flex_porto_fuel_available(self, super_admin, flex_impersonation):
        d = super_admin.get(f"{BASE_URL}/api/vehicles/capabilities",
                            headers={"X-Act-As-Tenant": "flex"}, timeout=60).json()
        fl = d["records"]["3467691"]["capabilities"]["fuel_level"]
        assert fl["available"] is True
        assert fl["unit"] == "%"
        assert fl["status"] == "AVAILABLE"
        assert 0 <= fl["value"] <= 100  # donnée réelle vivante — seule la plage physique est garantie

    def test_flex_tigizirt_unverified(self, super_admin, flex_impersonation):
        d = super_admin.get(f"{BASE_URL}/api/vehicles/capabilities",
                            headers={"X-Act-As-Tenant": "flex"}, timeout=60).json()
        tig = d["records"]["3467715"]
        inputs = {s["input"] for s in tig["unverified_sensors"]}
        assert "avl_io_49" in inputs
        assert "obd_absolute_load_value" in inputs
        assert tig["capabilities"]["ev_range"]["available"] is False


# --- Multi-tenant isolation ---
class TestMultiTenantIsolation:
    def test_beta_hash_fake_returns_clean_error(self, beta_admin):
        r = beta_admin.get(f"{BASE_URL}/api/vehicles/capabilities", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is False
        assert "Échec" in d["error"] or "chec" in d["error"]
        assert "records" not in d or not d.get("records")

    def test_beta_cannot_impersonate_via_header(self, beta_admin):
        r = beta_admin.get(f"{BASE_URL}/api/vehicles/capabilities",
                           headers={"X-Act-As-Tenant": "flex"}, timeout=30)
        d = r.json()
        # Header must be ignored, still test-beta context => same clean error
        assert d.get("success") is False
        assert not d.get("records")


# --- Fleet stats: data_status + no silent zeros ---
class TestFleetStats:
    def test_data_status_present(self, super_admin):
        r = super_admin.get(
            f"{BASE_URL}/api/fleet/stats?from_date=2026-07-01&to_date=2026-07-31", timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert "data_status" in d
        for k in ("mileage", "odometer", "engine_hours"):
            assert k in d["data_status"]
            assert d["data_status"][k] == "ok"

    def test_vehicles_have_fuel_type_no_silent_zero(self, super_admin):
        d = super_admin.get(
            f"{BASE_URL}/api/fleet/stats?from_date=2026-07-01&to_date=2026-07-31", timeout=60).json()
        for v in d["vehicles"]:
            assert "fuel_type" in v
        null_od = sum(1 for v in d["vehicles"] if v.get("total_odometer") is None)
        assert null_od >= 3

    def test_efficiency_data_status(self, super_admin):
        r = super_admin.get(
            f"{BASE_URL}/api/fleet/efficiency?from_date=2026-07-01&to_date=2026-07-31", timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert "data_status" in d


# --- Exports ---
class TestExports:
    def test_pdf(self, super_admin):
        r = super_admin.get(
            f"{BASE_URL}/api/export/pdf?from_date=2026-07-01&to_date=2026-07-31", timeout=90)
        assert r.status_code == 200
        assert r.content[:5] == b"%PDF-"

    def test_csv(self, super_admin):
        r = super_admin.get(
            f"{BASE_URL}/api/export/fleet-stats?from_date=2026-07-01&to_date=2026-07-31", timeout=60)
        assert r.status_code == 200
        assert "Véhicule" in r.text or "Vehicule" in r.text
