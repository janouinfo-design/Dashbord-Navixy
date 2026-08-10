"""
Backend tests for the bidirectional garage sync (iteration_14).
Endpoints under /api/vehicles/admin/navixy-garage.

IMPORTANT: The garage is a real client GPS account — any modification MUST be
reverted to its original value at the end of the test.
"""
import io
import os
import struct
import zlib

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

AUDI_TRACKER_ID = 781479
AUDI_VEHICLE_ID = 164367

# ---------------- Original snapshot (kept for restoration) ----------------
ORIGINAL = {
    "label": "Audi A3 2018",
    "model": "Audi A3 2018",
    "reg_number": "VD 602 548",
    "color": "Noir",
    "manufacture_year": 2018,
    "vin": "",
    "liability_insurance_policy_number": "2291765 0 7101",
    "liability_insurance_valid_till": "2025-12-31",
}


def _make_tiny_png() -> bytes:
    """Return a valid 2x2 PNG (blue) as bytes — pure stdlib."""
    def chunk(t, data):
        return (struct.pack(">I", len(data)) + t + data +
                struct.pack(">I", zlib.crc32(t + data) & 0xffffffff))
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", 2, 2, 8, 2, 0, 0, 0)  # 2x2 RGB
    raw = b"\x00" + b"\x00\x00\xff" * 2 + b"\x00" + b"\x00\x00\xff" * 2
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


class TestGarageList:
    def test_garage_list_structure(self):
        r = requests.get(f"{BASE_URL}/api/vehicles/admin/navixy-garage", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert isinstance(d["linked"], dict)
        assert isinstance(d["unlinked"], list)
        # 3 expected linked tracker_ids
        for tid in ("781479", "3076994", "3131157"):
            assert tid in d["linked"], f"missing tracker {tid} in linked"
        # ≈ 5 unlinked
        assert 3 <= len(d["unlinked"]) <= 10, f"unlinked count unusual: {len(d['unlinked'])}"

    def test_audi_fields(self):
        d = requests.get(f"{BASE_URL}/api/vehicles/admin/navixy-garage", timeout=30).json()
        a = d["linked"]["781479"]
        assert a["vehicle_id"] == AUDI_VEHICLE_ID
        assert a["label"] == ORIGINAL["label"]
        assert a["reg_number"] == ORIGINAL["reg_number"]
        assert a["manufacture_year"] == ORIGINAL["manufacture_year"]
        assert a["color"] == ORIGINAL["color"]
        assert a["liability_insurance_policy_number"] == ORIGINAL["liability_insurance_policy_number"]
        assert a["liability_insurance_valid_till"] == ORIGINAL["liability_insurance_valid_till"]
        # avatar URL points to Navixy static (only allowed occurrence)
        assert a["avatar_url"] and a["avatar_url"].startswith("https://api.navixy.com/v2/static/vehicle/avatars/")


class TestGaragePush:
    def test_push_color_and_restore(self):
        # PUSH test value
        r = requests.put(
            f"{BASE_URL}/api/vehicles/admin/navixy-garage/{AUDI_VEHICLE_ID}",
            json={"data": {"color": "Noir test"}}, timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert d["vehicle"]["color"] == "Noir test"

        # Re-GET verifies persistence at real garage
        g = requests.get(f"{BASE_URL}/api/vehicles/admin/navixy-garage", timeout=30).json()
        assert g["linked"]["781479"]["color"] == "Noir test"

        # MANDATORY RESTORE
        r2 = requests.put(
            f"{BASE_URL}/api/vehicles/admin/navixy-garage/{AUDI_VEHICLE_ID}",
            json={"data": {"color": ORIGINAL["color"]}}, timeout=30,
        )
        assert r2.status_code == 200
        assert r2.json()["vehicle"]["color"] == ORIGINAL["color"]

    def test_empty_manufacture_year_does_not_crash(self):
        # empty year should be accepted (nulled) — must not 500
        r = requests.put(
            f"{BASE_URL}/api/vehicles/admin/navixy-garage/{AUDI_VEHICLE_ID}",
            json={"data": {"manufacture_year": ""}}, timeout=30,
        )
        assert r.status_code == 200, r.text
        # RESTORE to original year
        r2 = requests.put(
            f"{BASE_URL}/api/vehicles/admin/navixy-garage/{AUDI_VEHICLE_ID}",
            json={"data": {"manufacture_year": ORIGINAL["manufacture_year"]}}, timeout=30,
        )
        assert r2.status_code == 200
        assert r2.json()["vehicle"]["manufacture_year"] == ORIGINAL["manufacture_year"]

    def test_unknown_vehicle_id_returns_404(self):
        r = requests.put(
            f"{BASE_URL}/api/vehicles/admin/navixy-garage/999999",
            json={"data": {"color": "X"}}, timeout=30,
        )
        assert r.status_code == 404, r.text


class TestGaragePhoto:
    def test_upload_photo_returns_avatar_url_and_image(self):
        png = _make_tiny_png()
        files = {"file": ("test_avatar.png", io.BytesIO(png), "image/png")}
        r = requests.post(
            f"{BASE_URL}/api/vehicles/admin/navixy-garage/{AUDI_VEHICLE_ID}/photo",
            files=files, timeout=60,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert d.get("avatar_file_name")
        assert d.get("avatar_url", "").startswith("https://api.navixy.com/v2/static/vehicle/avatars/")

        img = requests.get(d["avatar_url"], timeout=30)
        assert img.status_code == 200
        assert img.headers.get("content-type", "").startswith("image/")
