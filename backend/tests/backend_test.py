"""
Backend tests for Navixy Fleet Analytics Engine v1.0.0
Verifies real Navixy data, audit trails, null fields, and fuel config.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://iot-navixy-logic.preview.emergentagent.com').rstrip('/')
TIMEOUT = 90


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module", autouse=True)
def reset_fuel_config():
    """Reset tenant fuel_config in mongo before/after module run."""
    try:
        from pymongo import MongoClient
        mc = MongoClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
        db = mc[os.environ.get('DB_NAME', 'test_database')]
        db.tenant_config.delete_many({"tenant": "default"})
        mc.close()
    except Exception as e:
        print(f"reset_fuel_config warning: {e}")
    yield
    try:
        from pymongo import MongoClient
        mc = MongoClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
        db = mc[os.environ.get('DB_NAME', 'test_database')]
        db.tenant_config.delete_many({"tenant": "default"})
        mc.close()
    except Exception:
        pass


# ---------- Root / Engine version ----------
def test_root_engine_version(api):
    r = api.get(f"{BASE_URL}/api/", timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert data.get("engine_version") == "1.0.0"


# ---------- Fleet stats ----------
def test_fleet_stats_audit_and_real_data(api):
    r = api.get(f"{BASE_URL}/api/fleet/stats",
                params={"from_date": "2026-07-15", "to_date": "2026-07-22"},
                timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "_audit" in data, "Missing _audit object"
    audit = data["_audit"]
    assert audit.get("engine_version") == "1.0.0"
    assert "navixy_calls" in audit
    assert "data_quality" in audit
    assert "vehicles" in data
    assert isinstance(data["vehicles"], list)


# ---------- Trends ----------
def test_trends_real_and_null_fields(api):
    r = api.get(f"{BASE_URL}/api/analytics/trends", params={"period": "week"}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "_audit" in data
    # Must have daily entries with distance & active_vehicles real
    daily = data.get("daily") or data.get("trends") or []
    assert isinstance(daily, list) and len(daily) > 0, f"No daily data: {data}"
    sample = daily[0]
    assert "total_distance" in sample or "distance" in sample
    assert "active_vehicles" in sample
    # Ensured null fields (API uses total_ prefix for time fields)
    null_keys = ("avg_efficiency", "total_driving_time", "total_idle_time", "speed_violations")
    for key in null_keys:
        assert sample.get(key) is None, f"{key} should be null, got {sample.get(key)}"


# ---------- Vehicle comparison ----------
def test_vehicle_comparison(api):
    r = api.get(f"{BASE_URL}/api/analytics/vehicle-comparison", timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "_audit" in data
    vehicles = data.get("vehicles", [])
    assert len(vehicles) > 0
    v = vehicles[0]
    assert "utilization_score" in v
    assert "total_distance_week" in v
    for key in ("fuel_efficiency", "idle_percentage", "violations_count"):
        assert v.get(key) is None, f"{key} should be null, got {v.get(key)}"


# ---------- Fleet efficiency ----------
def test_fleet_efficiency(api):
    r = api.get(f"{BASE_URL}/api/fleet/efficiency",
                params={"date": "2026-07-22", "period": "week"}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "_audit" in data
    vehicles = data.get("vehicles", [])
    assert len(vehicles) > 0
    v = vehicles[0]
    assert "utilization_pct" in v
    for key in ("driving_time", "idle_time", "stopped_time"):
        assert v.get(key) is None, f"{key} should be null, got {v.get(key)}"


# ---------- Fuel config ----------
def test_fuel_config_default(api):
    r = api.get(f"{BASE_URL}/api/config/fuel", timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    data = r.json()
    cfg = data.get("fuel_config", {})
    assert cfg.get("default_fuel_price") == 2.0
    assert cfg.get("default_consumption_rate") is None


def test_fuel_config_put_and_fleet_stats_have_fuel(api):
    # Set consumption rate
    r = api.put(f"{BASE_URL}/api/config/fuel", json={"default_consumption_rate": 8.5}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    cfg = r.json().get("fuel_config", {})
    assert cfg.get("default_consumption_rate") == 8.5

    # Re-fetch fleet stats - fuel fields should now appear
    r2 = api.get(f"{BASE_URL}/api/fleet/stats",
                 params={"from_date": "2026-07-15", "to_date": "2026-07-22"},
                 timeout=TIMEOUT)
    assert r2.status_code == 200
    data = r2.json()
    vehicles = data.get("vehicles", [])
    assert len(vehicles) > 0
    # At least one vehicle with distance should have fuel calc
    has_fuel = any(
        v.get("fuel_used_liters") is not None and v.get("fuel_cost_chf") is not None
        for v in vehicles
    )
    assert has_fuel, "No vehicles have fuel_used_liters/fuel_cost_chf after configuring rate"


def test_fuel_config_reset_null(api):
    """PUT with explicit null should clear the consumption rate."""
    r = api.put(f"{BASE_URL}/api/config/fuel", json={"default_consumption_rate": None}, timeout=TIMEOUT)
    assert r.status_code == 200
    cfg = r.json().get("fuel_config", {})
    assert cfg.get("default_consumption_rate") is None, f"Expected null, got {cfg.get('default_consumption_rate')}"

    # Subsequent fleet/stats should NOT have fuel fields (or they should be null)
    r2 = api.get(f"{BASE_URL}/api/fleet/stats",
                 params={"from_date": "2026-07-15", "to_date": "2026-07-22"},
                 timeout=TIMEOUT)
    assert r2.status_code == 200
    vehicles = r2.json().get("vehicles", [])
    for v in vehicles:
        assert v.get("fuel_used_liters") in (None, 0, 0.0) or v.get("fuel_cost_chf") is None, \
            f"Expected fuel fields to be cleared for vehicle {v.get('label')}"


# ---------- Audit compare ----------
def test_audit_compare(api):
    r = api.get(f"{BASE_URL}/api/audit/compare",
                params={"from_date": "2026-07-22", "to_date": "2026-07-22"},
                timeout=180)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("success") is True
    assert "total_vehicles" in data
    assert "mismatches" in data
    assert "vehicles" in data
    assert isinstance(data["vehicles"], list)
    assert len(data["vehicles"]) > 0
    v = data["vehicles"][0]
    assert "navixy_raw" in v
    assert "engine_computed" in v
    assert "validation" in v
    val = v["validation"]
    for k in ("mileage", "odometer", "engine_hours", "all_match"):
        assert k in val
    assert "raw_navixy_calls" in data


# ---------- PDF export ----------
def test_export_pdf(api):
    r = api.get(f"{BASE_URL}/api/export/pdf",
                params={"from_date": "2026-07-15", "to_date": "2026-07-22"},
                timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    assert r.headers.get("content-type", "").startswith("application/pdf")
    # Verify it's a valid PDF (starts with %PDF-)
    content = r.content
    assert content[:4] == b"%PDF", f"Not a valid PDF, got: {content[:10]}"
    assert len(content) > 500, f"PDF too small: {len(content)} bytes"


# ---------- Idle by group ----------
def test_idle_by_group(api):
    r = api.get(f"{BASE_URL}/api/fleet/idle-by-group", timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "_audit" in data


# ---------- Driver report ----------
def test_driver_report(api):
    r = api.get(f"{BASE_URL}/api/reports/driver",
                params={"from_date": "2026-07-15", "to_date": "2026-07-22"},
                timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "_audit" in data
    drivers = data.get("drivers", [])
    assert isinstance(drivers, list)
