"""
Capability Map par véhicule — Phase 2 multi-énergie.

Règles:
- Les capacités sont détectées PAR VÉHICULE via tracker/sensor/list + tracker/readings/list,
  jamais déduites de fuel_type, du modèle de traceur ou du nom du véhicule.
- Détection sur input_name Navixy vérifié (whitelist) — jamais sur le libellé seul.
- Les sensors ambigus (avl_io_*, obd_absolute_load_value, customs) restent 'unverified'.
- EV: familles préparées dans le schéma mais AUCUN input EV vérifié à ce jour → toujours UNAVAILABLE.
- Fraîcheur: une valeur est AVAILABLE si son update_time date de moins de FRESH_HOURS (48h),
  sinon STALE (dernière donnée connue, jamais présentée comme temps réel). Jamais convertie en 0.
"""
import asyncio
import re
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Request, HTTPException

logger = logging.getLogger(__name__)

FRESH_HOURS = 48
SCAN_TTL_SECONDS = 6 * 3600  # capacités re-scannées au plus toutes les 6h (changent rarement)

# Seuil métier "carburant faible" (%) — constante centralisée (validée utilisateur, choix 1a).
# Utilisée par la Vue générale ; exposée dans la réponse /vehicles/capabilities pour le frontend.
FUEL_LOW_THRESHOLD_PCT = 20

# input_name Navixy vérifié → (clé capability, unité, unité_vérifiée)
KNOWN_INPUTS = {
    "obd_fuel": ("fuel_level", "%", True),
    "obd_consumption": ("fuel_consumption_obd", None, False),  # unité NON confirmée — pas de L/100km
    "obd_mileage": ("odometer_obd", "km", True),
}

# Familles EV préparées — aucun input Navixy vérifié à ce jour (liste volontairement vide)
EV_KEYS = ("ev_soc", "ev_range", "ev_energy_consumed", "ev_kwh_per_100km",
           "ev_charging_state", "ev_charging_power", "ev_energy_charged")
EV_VERIFIED_INPUTS = {}  # à compléter uniquement après validation sur véhicule réel

AMBIGUOUS_INPUTS = ("obd_absolute_load_value",)  # charge MOTEUR OBD, pas batterie
MOTOR_VALUES = ("diesel", "petrol", "hybrid", "phev", "electric", "unknown")
VIN_RE = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$")
DTC_RE = re.compile(r"^[PBCU][0-9][0-9A-F]{3}$", re.I)


def _now():
    return datetime.now(timezone.utc)


def _parse_ts(ts):
    if not ts:
        return None
    try:
        return datetime.strptime(str(ts), "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _status(update_time):
    dt = _parse_ts(update_time)
    if dt is None:
        return "UNAVAILABLE"
    return "AVAILABLE" if _now() - dt <= timedelta(hours=FRESH_HOURS) else "STALE"


def _val(value, unit, unit_verified, source, update_time):
    return {"value": value, "unit": unit, "unit_verified": unit_verified,
            "source": source, "update_time": update_time, "status": _status(update_time)}


def _normalize_motor(override, navixy_fuel):
    if override in MOTOR_VALUES and override != "unknown":
        return override, "logitrak_override"
    nf = (navixy_fuel or "").strip().lower()
    if nf in ("diesel", "petrol", "electric", "hybrid", "phev"):
        return nf, "navixy_garage"
    if nf == "gasoline":
        return "petrol", "navixy_garage"
    return "unknown", "none"


def create_capabilities_router(db, navixy, cache, get_tenant_context):
    router = APIRouter(prefix="/vehicles")
    col = db.vehicle_capabilities

    async def _scan(navixy_hash: str, tenant: str) -> dict:
        tk = await navixy.get_trackers(navixy_hash)
        if not tk.get("success"):
            return {"success": False, "error": "Échec récupération trackers"}
        trackers = tk.get("list", [])
        tids = [t["id"] for t in trackers]

        garage_by_tid = {}
        vg = await navixy.get_vehicles(navixy_hash)
        if vg.get("success"):
            for v in vg.get("list", []):
                if v.get("tracker_id"):
                    garage_by_tid[v["tracker_id"]] = v

        admin_by_tid = {}
        async for d in db.vehicle_admin.find({"tenant": tenant}, {"_id": 0, "tracker_id": 1, "general": 1}):
            admin_by_tid[d["tracker_id"]] = d.get("general") or {}

        pairs = await navixy.get_readings_and_sensors_batch(tids, navixy_hash)

        records = {}
        partial = False
        for t in trackers:
            tid = t["id"]
            gv = garage_by_tid.get(tid) or {}
            override = (admin_by_tid.get(tid) or {}).get("motorisation")
            motor, motor_source = _normalize_motor(override, gv.get("fuel_type"))

            rec = {
                "tracker_id": tid,
                "label": t.get("label"),
                "reg_number": gv.get("reg_number") or None,
                "device_model": t.get("source", {}).get("model"),
                "motorisation": {"normalized": motor, "source": motor_source,
                                 "navixy_fuel_type": gv.get("fuel_type"), "override": override},
                "capabilities": {},
                "unverified_sensors": [],
                "vin": None, "dtc": None,
                "scan_status": "ok",
            }
            # GPS/compteurs — familles toujours évaluées
            caps = rec["capabilities"]
            caps["gps"] = {"available": True, "source": "tracker/list"}
            for k in EV_KEYS:
                caps[k] = {"available": False, "status": "UNAVAILABLE",
                           "note": "Aucun paramètre EV vérifié remonté par ce véhicule"}

            pair = pairs.get(tid)
            if pair is None:
                rec["scan_status"] = "error"
                partial = True
                records[str(tid)] = rec
                continue
            readings, sensors = pair

            input_by_sensor_id = {}
            for s in (sensors.get("list") if sensors.get("success") else []) or []:
                inp = s.get("input_name")
                if s.get("id"):
                    input_by_sensor_id[s["id"]] = {"input": inp, "name": s.get("name")}
                if inp and inp not in KNOWN_INPUTS and inp not in EV_VERIFIED_INPUTS and \
                   (inp in AMBIGUOUS_INPUTS or inp.startswith("avl_io_")):
                    rec["unverified_sensors"].append({"name": s.get("name"), "input": inp,
                                                      "reason": "provenance/signification non confirmée"})

            if readings.get("success"):
                for i in (readings.get("inputs") or []):
                    meta = input_by_sensor_id.get(i.get("sensor_id")) or {}
                    inp = meta.get("input")
                    if inp in KNOWN_INPUTS:
                        key, unit, verified = KNOWN_INPUTS[inp]
                        ts = i.get("update_time") or i.get("updated")
                        caps[key] = {"available": True,
                                     **_val(i.get("value"), unit, verified, inp, ts)}
                for c in (readings.get("counters") or []):
                    ctype = c.get("type")
                    if ctype in ("odometer", "engine_hours"):
                        ts = c.get("update_time") or c.get("updated")
                        v = c.get("value")
                        caps[ctype] = {"available": v is not None,
                                       **_val(round(v, 1) if isinstance(v, (int, float)) else v,
                                              "km" if ctype == "odometer" else "h", True, f"counter[{ctype}]", ts)}
                # states non labellisés: VIN et DTC identifiés par FORMAT + recoupement
                dtc_codes, vin_obd, vin_ts, dtc_ts = [], None, None, None
                for s in (readings.get("states") or []):
                    sval = s.get("value")
                    ts = s.get("update_time") or s.get("updated")
                    if isinstance(sval, str):
                        if VIN_RE.match(sval):
                            vin_obd, vin_ts = sval, ts
                        elif DTC_RE.match(sval.strip()):
                            dtc_codes.append(sval.strip().upper())
                            dtc_ts = ts
                garage_vin = (gv.get("vin") or "").strip() or None
                if vin_obd or garage_vin:
                    rec["vin"] = {"obd": vin_obd, "garage": garage_vin,
                                  "conflict": bool(vin_obd and garage_vin and vin_obd != garage_vin),
                                  "obd_update_time": vin_ts,
                                  "obd_status": _status(vin_ts) if vin_obd else "UNAVAILABLE"}
                if dtc_codes:
                    rec["dtc"] = {"codes": sorted(set(dtc_codes)), "source": "obd_dtc (state)",
                                  "update_time": dtc_ts, "status": _status(dtc_ts)}
                caps["dtc"] = {"available": bool(dtc_codes)}
                caps["vin_obd"] = {"available": bool(vin_obd)}
            else:
                rec["scan_status"] = "error"
                partial = True

            # garantir la présence des clés thermiques même si absentes
            for key in ("fuel_level", "fuel_consumption_obd", "odometer", "engine_hours"):
                caps.setdefault(key, {"available": False, "status": "UNAVAILABLE"})
            records[str(tid)] = rec

        return {"success": True, "tenant": tenant, "records": records, "partial": partial,
                "scanned_at": _now().isoformat(),
                "fuel_low_threshold_pct": FUEL_LOW_THRESHOLD_PCT,
                "freshness_rule": f"AVAILABLE si update_time < {FRESH_HOURS}h, sinon STALE"}

    async def _get_map(navixy_hash: str, tenant: str, refresh: bool) -> dict:
        if not refresh:
            cached, hit, _ = cache.get(tenant, "capabilities")
            if hit:
                return cached
            doc = await col.find_one({"tenant": tenant}, {"_id": 0})
            if doc:
                age = (_now() - datetime.fromisoformat(doc["scanned_at"])).total_seconds()
                if age < SCAN_TTL_SECONDS:
                    cache.set(tenant, "capabilities", doc)
                    return doc
        result = await _scan(navixy_hash, tenant)
        if result.get("success"):
            await col.update_one({"tenant": tenant}, {"$set": result}, upsert=True)
            cache.set(tenant, "capabilities", result)
        return result

    @router.get("/capabilities")
    async def all_capabilities(request: Request, refresh: bool = False):
        h, tenant = await get_tenant_context(request)
        data = await _get_map(h, tenant, refresh)
        if data.get("success"):
            data["fuel_low_threshold_pct"] = FUEL_LOW_THRESHOLD_PCT
        return data

    @router.get("/{tracker_id}/capabilities")
    async def one_capability(tracker_id: int, request: Request):
        h, tenant = await get_tenant_context(request)
        data = await _get_map(h, tenant, False)
        rec = (data.get("records") or {}).get(str(tracker_id))
        if not rec:
            raise HTTPException(404, "Véhicule inconnu pour ce client")
        return {"success": True, "scanned_at": data.get("scanned_at"), "record": rec}

    return router
