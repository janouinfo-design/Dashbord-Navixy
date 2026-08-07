"""
Eco-driving engine — LOGITRAK plugin 46 ("Rapport sur la qualité de conduite").

RULES
1. Score = LOGITRAK native rating (0-100 raw + stars display), shown as-is. No conversion invented.
2. Attribution driver <- vehicle ONLY via LOGITRAK employee.tracker_id assignment.
   Vehicles without an assigned driver keep their events at vehicle level (unassigned_vehicles).
3. Every value traceable: data -> LOGITRAK endpoint -> method -> period.
4. No arbitrary categories/thresholds. Stars come from LOGITRAK's own rating string.
"""
import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional

from analytics_engine import AuditBuilder

logger = logging.getLogger(__name__)

PLUGIN_DRIVE_QUALITY = 46
REPORT_POLL_MAX = 45


def _classify_event(label: str) -> str:
    l = (label or '').lower()
    if 'frein' in l or 'brak' in l:
        return 'braking'
    if 'acc' in l:
        return 'acceleration'
    if 'virage' in l or 'turn' in l or 'tournant' in l:
        return 'turning'
    return 'other'


def _per_100km(count, dist):
    if not dist or dist <= 0:
        return None
    return round(count / dist * 100, 2)


def _parse_vehicle_sheet(sheet: dict) -> Optional[dict]:
    """Extract daily penalties + individual events from a per-vehicle sheet."""
    secs = sheet.get('sections', [])
    if not secs or secs[0].get('type') == 'text':
        return None
    out = {"daily": [], "eco_events": [], "idling_events": [], "speeding_events": []}
    for sec in secs:
        stype = sec.get('type')
        if stype == 'stacked_bar_chart':
            for pt in sec.get('data', []):
                bars = pt.get('bars', {})
                out['daily'].append({
                    "label": pt.get('x', {}).get('v'),
                    "ts": pt.get('x', {}).get('raw'),
                    "speeding": round(bars.get('speeding', {}).get('raw', 0) or 0, 2),
                    "harsh_driving": round(bars.get('harsh_driving', {}).get('raw', 0) or 0, 2),
                    "idling": round(bars.get('idling', {}).get('raw', 0) or 0, 2),
                })
        elif stype == 'table':
            fields = [c.get('field') for c in sec.get('columns', [])]
            for grp in sec.get('data', []):
                day_header = grp.get('header') or ''
                day_label = day_header.split(' : ')[0].strip()
                for r in grp.get('rows', []):
                    addr = r.get('event_address', {}) or {}
                    loc = addr.get('location') or {}
                    ev = {
                        "day": day_label,
                        "time": (r.get('start_time') or {}).get('v'),
                        "ts": (r.get('start_time') or {}).get('raw'),
                        "address": addr.get('v'),
                        "lat": loc.get('lat'),
                        "lng": loc.get('lng'),
                        "penalty": (r.get('penalty') or {}).get('raw'),
                    }
                    if 'event' in fields:
                        raw_type = (r.get('event') or {}).get('v')
                        ev['type'] = raw_type
                        ev['category'] = _classify_event(raw_type)
                        out['eco_events'].append(ev)
                    elif 'duration' in fields:
                        ev['duration_sec'] = (r.get('duration') or {}).get('raw')
                        out['idling_events'].append(ev)
                    else:
                        ev['extra'] = {f: (r.get(f) or {}).get('v') for f in fields
                                       if f not in ('start_time', 'event_address', 'penalty')}
                        out['speeding_events'].append(ev)
    return out


def _parse_summary_rows(report: dict) -> List[dict]:
    """Summary sheet table: stable fields name/rating/mileage/penalties_number/avg_penalty."""
    rows = []
    for sheet in report.get('sheets', []):
        if sheet.get('entity_ids'):
            continue
        for sec in sheet.get('sections', []):
            if sec.get('type') == 'table':
                for grp in sec.get('data', []):
                    rows.extend(grp.get('rows', []))
        break
    return rows


def _track_duration_sec(track: dict) -> float:
    try:
        start = datetime.strptime(track['start_date'], '%Y-%m-%d %H:%M:%S')
        end = datetime.strptime(track['end_date'], '%Y-%m-%d %H:%M:%S')
        return max(0, (end - start).total_seconds())
    except (KeyError, ValueError):
        return 0


SOURCES = [
    {"data": "Score éco (notation + étoiles)", "source": "report/tracker/generate plugin 46 — Rapport sur la qualité de conduite",
     "method": "Notation native LOGITRAK 0–100 affichée telle quelle (aucune conversion appliquée)",
     "attribution": "Véhicule → conducteur via affectation LOGITRAK (employee.tracker_id)"},
    {"data": "Pénalités par type (freinage, accélération, virage, ralenti, excès de vitesse)", "source": "Plugin 46, feuille véhicule (tables + graphique quotidien)",
     "method": "Événements individuels LOGITRAK avec date, adresse, coordonnées et pénalité",
     "attribution": "Même règle — événements des véhicules sans conducteur assigné NON attribués"},
    {"data": "Distance (km)", "source": "Plugin 46, kilométrage de la période", "method": "Valeur LOGITRAK brute",
     "attribution": "Par véhicule assigné"},
    {"data": "Trajets et temps de conduite", "source": "track/list", "method": "Nombre de trajets LOGITRAK; temps = somme(end_date - start_date) des trajets",
     "attribution": "Par véhicule assigné"},
    {"data": "Indicateurs /100 km", "source": "Calcul LOGITRAK", "method": "nombre d'événements ÷ km période × 100 (affiché avec le nombre brut)",
     "attribution": "—"},
]


async def compute_driver_ecodriving(navixy, cache, navixy_hash: str, from_date: str, to_date: str, tenant: str) -> dict:
    cache_key = f"ecodriving:{from_date}:{to_date}"
    cached, hit, age = cache.get(tenant, cache_key)
    if cached:
        cached["_audit"]["cache"] = {"hit": True, "age_seconds": age}
        return cached

    audit = AuditBuilder(tenant)
    navixy.reset_logs()

    emp_data, tk_data = await asyncio.gather(
        navixy.get_employees(navixy_hash),
        navixy.get_trackers(navixy_hash),
    )
    audit.real("employees", "employee/list")
    audit.real("trackers", "tracker/list")
    if not emp_data.get('success') or not tk_data.get('success'):
        return {"success": False, "error": "Échec récupération employés ou trackers",
                "_audit": audit.build(navixy.get_logs(), False, 0)}

    trackers_map = {t['id']: t['label'] for t in tk_data.get('list', [])}
    all_tids = list(trackers_map.keys())
    employees = emp_data.get('list', [])
    assigned_tids = {e['tracker_id']: e['id'] for e in employees if e.get('tracker_id')}

    from_dt = f"{from_date} 00:00:00"
    to_dt = f"{to_date} 23:59:59"

    # ---- Plugin 46 report (all trackers, attribution applied after) ----
    report = None
    gen = await navixy.generate_report(all_tids, from_dt, to_dt, PLUGIN_DRIVE_QUALITY,
                                       f"LOGITRAK eco {from_date} {to_date}", navixy_hash)
    audit.real("drive_quality_report", "report/tracker/generate (plugin 46)")
    report_id = gen.get('id')
    if report_id:
        for _ in range(REPORT_POLL_MAX):
            st = await navixy.get_report_status(report_id, navixy_hash)
            if st.get('percent_ready') == 100:
                break
            await asyncio.sleep(1)
        ret = await navixy.retrieve_report(report_id, navixy_hash)
        if ret.get('success'):
            report = ret.get('report')
        await navixy.delete_report(report_id, navixy_hash)
    if report is None:
        audit.unavailable("drive_quality_report", "Rapport plugin 46 non généré/récupéré")

    # ---- Trips for assigned trackers only ----
    tracks_by_tid: Dict[int, list] = {}
    assigned_list = list(assigned_tids.keys())
    if assigned_list:
        results = await asyncio.gather(*[navixy.get_tracks(tid, from_dt, to_dt, navixy_hash) for tid in assigned_list])
        for tid, res in zip(assigned_list, results):
            tracks_by_tid[tid] = res.get('list', []) if res.get('success') else []
        audit.real("tracks", "track/list")

    # ---- Parse report ----
    summary_by_label: Dict[str, dict] = {}
    vehicle_sheets: Dict[int, dict] = {}
    if report:
        for row in _parse_summary_rows(report):
            name = (row.get('name') or {}).get('v')
            if name:
                summary_by_label[name] = row
        for sheet in report.get('sheets', []):
            eids = sheet.get('entity_ids')
            if eids:
                parsed = _parse_vehicle_sheet(sheet)
                if parsed is not None:
                    vehicle_sheets[eids[0]] = parsed

    def vehicle_stats(tid: int) -> dict:
        """Score/penalties/distance for one tracker, from LOGITRAK report."""
        label = trackers_map.get(tid)
        srow = summary_by_label.get(label, {})
        rating_raw = (srow.get('rating') or {}).get('raw')
        rating_disp = (srow.get('rating') or {}).get('v')
        mileage = (srow.get('mileage') or {}).get('raw') or 0
        has_data = tid in vehicle_sheets and mileage > 0
        score = None
        if has_data and rating_disp and rating_disp != '—':
            score = {
                "raw": round(rating_raw, 1) if rating_raw is not None else None,
                "display": rating_disp,
                "stars": rating_disp.count('★'),
            }
        pen_count = (srow.get('penalties_number') or {}).get('raw') or 0
        pen_avg = (srow.get('avg_penalty') or {}).get('raw') or 0
        return {
            "label": label, "has_data": has_data, "score": score,
            "distance_km": round(mileage, 1),
            "penalties": {
                "total": round(pen_avg * pen_count, 1),
                "count": pen_count,
                "avg": round(pen_avg, 2),
            },
            "detail": vehicle_sheets.get(tid),
        }

    # ---- Build drivers ----
    drivers = []
    for emp in employees:
        name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip() or f"Conducteur {emp['id']}"
        tid = emp.get('tracker_id')
        d = {
            "employee_id": emp['id'],
            "driver_name": name,
            "phone": emp.get('phone', ''),
            "personnel_number": emp.get('personnel_number', ''),
            "tracker_id": tid,
            "vehicle_label": trackers_map.get(tid) if tid else None,
            "has_vehicle": bool(tid),
            "has_activity": False,
            "score": None,
            "distance_km": None,
            "trips_count": None,
            "driving_time_sec": None,
            "penalties": None,
            "events": None,
            "events_per_100km": None,
            "daily": None,
            "recent_events": None,
        }
        if tid:
            vs = vehicle_stats(tid)
            tracks = tracks_by_tid.get(tid, [])
            d["has_activity"] = vs["has_data"]
            if vs["has_data"]:
                dist = vs["distance_km"]
                detail = vs["detail"] or {}
                eco = detail.get('eco_events', [])
                idl = detail.get('idling_events', [])
                spd = detail.get('speeding_events', [])
                counts = {"braking": 0, "acceleration": 0, "turning": 0, "other": 0}
                for e in eco:
                    counts[e['category']] += 1
                idling_sec = sum(e.get('duration_sec') or 0 for e in idl)
                idling_min = round(idling_sec / 60, 1)
                d.update({
                    "score": vs["score"],
                    "distance_km": dist,
                    "trips_count": len(tracks),
                    "driving_time_sec": round(sum(_track_duration_sec(t) for t in tracks)),
                    "penalties": vs["penalties"],
                    "events": {
                        "braking": {"count": counts['braking'], "per_100km": _per_100km(counts['braking'], dist)},
                        "acceleration": {"count": counts['acceleration'], "per_100km": _per_100km(counts['acceleration'], dist)},
                        "turning": {"count": counts['turning'], "per_100km": _per_100km(counts['turning'], dist)},
                        "other": {"count": counts['other'], "per_100km": _per_100km(counts['other'], dist)},
                        "speeding": {"count": len(spd), "per_100km": _per_100km(len(spd), dist)},
                        "idling": {"count": len(idl), "duration_min": idling_min,
                                   "min_per_100km": _per_100km(idling_min, dist)},
                    },
                    "events_per_100km": _per_100km(vs["penalties"]["count"], dist),
                    "daily": detail.get('daily'),
                    "recent_events": sorted(
                        [{**e, "kind": "eco"} for e in eco]
                        + [{**e, "kind": "idling"} for e in idl]
                        + [{**e, "kind": "speeding"} for e in spd],
                        key=lambda e: e.get('ts') or 0, reverse=True,
                    )[:60],
                })
        drivers.append(d)

    # ---- Unassigned vehicles with activity (events NOT attributed to anyone) ----
    unassigned_vehicles = []
    for tid in all_tids:
        if tid in assigned_tids:
            continue
        vs = vehicle_stats(tid)
        if vs["has_data"]:
            unassigned_vehicles.append({
                "tracker_id": tid, "label": vs["label"], "score": vs["score"],
                "distance_km": vs["distance_km"], "penalties_count": vs["penalties"]["count"],
            })
    if unassigned_vehicles:
        audit.computed("unassigned_vehicles",
                       "Événements de véhicules sans conducteur assigné — conservés au niveau véhicule, jamais attribués")

    # ---- Summary ----
    with_vehicle = [d for d in drivers if d['has_vehicle']]
    with_activity = [d for d in drivers if d['has_activity']]
    scores = [d['score']['raw'] for d in with_activity if d.get('score')]
    total_dist = round(sum(d['distance_km'] or 0 for d in with_activity), 1)
    total_pen = sum((d['penalties'] or {}).get('count', 0) for d in with_activity)
    audit.computed("avg_score", "moyenne(notations LOGITRAK des conducteurs avec activité)")
    audit.computed("penalties_per_100km", "somme(nb pénalités) ÷ somme(km) × 100")

    result = {
        "success": True,
        "period": {"from": from_date, "to": to_date},
        "summary": {
            "drivers_total": len(drivers),
            "drivers_with_vehicle": len(with_vehicle),
            "drivers_with_activity": len(with_activity),
            "avg_score": round(sum(scores) / len(scores), 1) if scores else None,
            "penalties_per_100km": _per_100km(total_pen, total_dist),
            "total_penalties": total_pen,
            "total_distance_km": total_dist,
            "total_trips": sum(d['trips_count'] or 0 for d in with_activity),
            "total_driving_time_sec": sum(d['driving_time_sec'] or 0 for d in with_activity),
        },
        "drivers": drivers,
        "unassigned_vehicles": unassigned_vehicles,
        "sources": SOURCES,
        "report_available": report is not None,
        "_audit": audit.build(navixy.get_logs(), False, 0),
    }
    cache.set(tenant, cache_key, result)
    return result
