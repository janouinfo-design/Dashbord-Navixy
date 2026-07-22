"""
Navixy Fleet Dashboard — Multi-Client API
Slim route layer. All computation is delegated to AnalyticsEngine.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import json
import io
import csv
import uuid
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

from navixy_client import NavixyClient
from cache_manager import TenantCacheManager
from analytics_engine import AnalyticsEngine

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ============ INFRA ============

mongo_url = os.environ.get('MONGO_URL')
db_name = os.environ.get('DB_NAME')
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[db_name]

DEFAULT_NAVIXY_HASH = os.environ.get('NAVIXY_HASH', '')
NAVIXY_API_URL = os.environ.get('NAVIXY_API_URL', 'https://api.navixy.com/v2')
BASE_DOMAIN = os.environ.get('BASE_DOMAIN', 'logitrak.ch')

navixy = NavixyClient(NAVIXY_API_URL, DEFAULT_NAVIXY_HASH)
cache = TenantCacheManager(ttl=300)
engine = AnalyticsEngine(navixy, cache, db)

app = FastAPI(title="Navixy Fleet Dashboard - Multi-Client")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ MULTI-TENANT ============

async def get_client_from_subdomain(request: Request) -> Optional[dict]:
    host = request.headers.get('host', '')
    match = re.match(r'^([a-zA-Z0-9-]+)\.' + re.escape(BASE_DOMAIN), host)
    if match:
        subdomain = match.group(1).lower()
        if subdomain in ('www', 'admin', 'api'):
            return None
        return await db.clients.find_one({"subdomain": subdomain, "is_active": True}, {"_id": 0})
    return None


async def get_tenant_context(request: Request):
    """Returns (navixy_hash, tenant_name)."""
    info = await get_client_from_subdomain(request)
    if info and info.get('navixy_hash'):
        return info['navixy_hash'], info.get('subdomain', 'default')
    return DEFAULT_NAVIXY_HASH, 'default'

# ============ MODELS ============

class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class ClientCreate(BaseModel):
    name: str
    subdomain: str
    navixy_hash: str
    logo_url: Optional[str] = None
    primary_color: Optional[str] = "#e53935"
    contact_email: Optional[str] = None

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    navixy_hash: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    contact_email: Optional[str] = None
    is_active: Optional[bool] = None

class Client(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    subdomain: str
    navixy_hash: str
    logo_url: Optional[str] = None
    primary_color: str = "#e53935"
    contact_email: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FlowCreate(BaseModel):
    name: str
    nodes: List[Dict[str, Any]] = []
    connections: List[Dict[str, Any]] = []

class Flow(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    nodes: List[Dict[str, Any]] = []
    connections: List[Dict[str, Any]] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FuelConfigUpdate(BaseModel):
    default_fuel_price: Optional[float] = None
    currency: Optional[str] = None
    default_consumption_rate: Optional[float] = None
    fuel_types: Optional[Dict[str, float]] = None

# ============ BASIC ============

@api_router.get("/")
async def root():
    return {"message": "Navixy Fleet Dashboard API - Multi-Client", "engine_version": "1.0.0"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    obj = StatusCheck(**input.model_dump())
    doc = obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.status_checks.insert_one(doc)
    return obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for c in checks:
        if isinstance(c['timestamp'], str):
            c['timestamp'] = datetime.fromisoformat(c['timestamp'])
    return checks

# ============ CLIENT INFO ============

@api_router.get("/client/info")
async def get_client_info(request: Request):
    info = await get_client_from_subdomain(request)
    if info:
        safe = {k: v for k, v in info.items() if k != 'navixy_hash'}
        return {"success": True, "client": safe, "is_multi_tenant": True}
    return {"success": True, "client": {"name": "Default", "primary_color": "#e53935"}, "is_multi_tenant": False}

# ============ ADMIN — CLIENTS CRUD ============

@api_router.get("/admin/clients")
async def list_clients():
    clients = await db.clients.find({}, {"_id": 0}).to_list(1000)
    return {"success": True, "clients": clients}

@api_router.post("/admin/clients")
async def create_client(client_input: ClientCreate):
    existing = await db.clients.find_one({"subdomain": client_input.subdomain.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Subdomain already exists")
    obj = Client(
        name=client_input.name, subdomain=client_input.subdomain.lower(),
        navixy_hash=client_input.navixy_hash, logo_url=client_input.logo_url,
        primary_color=client_input.primary_color or "#e53935",
        contact_email=client_input.contact_email,
    )
    doc = obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.clients.insert_one(doc)
    return {"success": True, "client": obj.model_dump(),
            "dashboard_url": f"https://{obj.subdomain}.{BASE_DOMAIN}"}

@api_router.get("/admin/clients/{client_id}")
async def get_client(client_id: str):
    doc = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"success": True, "client": doc}

@api_router.put("/admin/clients/{client_id}")
async def update_client(client_id: str, client_input: ClientUpdate):
    data = {k: v for k, v in client_input.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="No data to update")
    r = await db.clients.update_one({"id": client_id}, {"$set": data})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"success": True, "message": "Client updated"}

@api_router.delete("/admin/clients/{client_id}")
async def delete_client(client_id: str):
    r = await db.clients.delete_one({"id": client_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"success": True, "message": "Client deleted"}

# ============ FUEL CONFIG ============

@api_router.get("/config/fuel")
async def get_fuel_config(request: Request):
    _, tenant = await get_tenant_context(request)
    config = await engine.get_fuel_config(tenant)
    return {"success": True, "tenant": tenant, "fuel_config": config}

@api_router.put("/config/fuel")
async def update_fuel_config(request: Request, body: FuelConfigUpdate):
    _, tenant = await get_tenant_context(request)
    current = await engine.get_fuel_config(tenant)
    update = body.model_dump(exclude_unset=True)
    for key, val in update.items():
        current[key] = val
    await engine.set_fuel_config(tenant, current)
    cache.invalidate_tenant(tenant)
    return {"success": True, "fuel_config": current}

@api_router.delete("/config/fuel")
async def reset_fuel_config(request: Request):
    _, tenant = await get_tenant_context(request)
    await engine.set_fuel_config(tenant, {"default_fuel_price": 2.0, "currency": "CHF", "default_consumption_rate": None, "fuel_types": {"diesel": 2.0, "essence": 2.1, "electric_kwh": 0.25}})
    cache.invalidate_tenant(tenant)
    return {"success": True, "message": "Fuel config reset to defaults"}

# ============ TRACKERS (passthrough) ============

@api_router.get("/trackers")
async def get_trackers(request: Request):
    h, _ = await get_tenant_context(request)
    data = await navixy.get_trackers(h)
    if data.get('success'):
        trackers = [{
            "id": t['id'], "label": t['label'], "group_id": t.get('group_id'),
            "model": t.get('source', {}).get('model'),
            "device_id": t.get('source', {}).get('device_id'),
            "tariff_end_date": t.get('source', {}).get('tariff_end_date'),
            "blocked": t.get('source', {}).get('blocked', False),
        } for t in data.get('list', [])]
        return {"success": True, "trackers": trackers}
    return {"success": False, "error": "Échec récupération trackers"}

@api_router.get("/tracker/{tracker_id}/state")
async def get_tracker_state(tracker_id: int, request: Request):
    h, _ = await get_tenant_context(request)
    return await navixy.get_tracker_state(tracker_id, h)

@api_router.get("/tracker/{tracker_id}/readings")
async def get_tracker_readings(tracker_id: int, request: Request):
    h, _ = await get_tenant_context(request)
    return await navixy.get_tracker_readings(tracker_id, h)

# ============ EMPLOYEES (passthrough) ============

@api_router.get("/employees")
async def get_employees(request: Request):
    h, _ = await get_tenant_context(request)
    data = await navixy.get_employees(h)
    if data.get('success'):
        employees = [{
            "id": e['id'], "first_name": e.get('first_name', ''),
            "last_name": e.get('last_name', ''), "tracker_id": e.get('tracker_id'),
            "phone": e.get('phone', ''), "hardware_key": e.get('hardware_key'),
            "personnel_number": e.get('personnel_number', ''),
        } for e in data.get('list', [])]
        return {"success": True, "employees": employees}
    return {"success": False, "error": "Échec récupération employés"}

# ============ ANALYTICS ENGINE ROUTES ============

@api_router.get("/fleet/stats")
async def get_fleet_stats(
    request: Request,
    from_date: str = Query(..., description="YYYY-MM-DD"),
    to_date: str = Query(..., description="YYYY-MM-DD"),
    tracker_ids: Optional[str] = Query(None),
):
    h, tenant = await get_tenant_context(request)
    return await engine.compute_fleet_stats(h, from_date, to_date, tracker_ids, tenant)

@api_router.get("/fleet/efficiency")
async def get_fleet_efficiency(
    request: Request,
    date: str = Query(..., description="YYYY-MM-DD"),
    period: str = Query("day"),
):
    h, tenant = await get_tenant_context(request)
    return await engine.compute_fleet_efficiency(h, date, period, tenant)

@api_router.get("/fleet/idle-by-group")
async def get_idle_by_group(request: Request):
    h, tenant = await get_tenant_context(request)
    return await engine.compute_idle_by_group(h, tenant)

@api_router.get("/analytics/trends")
async def get_fleet_trends(
    request: Request,
    period: str = Query("week"),
    tracker_id: Optional[int] = Query(None),
):
    h, tenant = await get_tenant_context(request)
    return await engine.compute_trends(h, period, tracker_id, tenant)

@api_router.get("/analytics/vehicle-comparison")
async def get_vehicle_comparison(request: Request):
    h, tenant = await get_tenant_context(request)
    return await engine.compute_vehicle_comparison(h, tenant)

@api_router.get("/reports/driver")
async def get_driver_report(
    request: Request,
    from_date: str = Query(..., description="YYYY-MM-DD"),
    to_date: str = Query(..., description="YYYY-MM-DD"),
    employee_id: Optional[int] = Query(None),
):
    h, tenant = await get_tenant_context(request)
    return await engine.compute_driver_report(h, from_date, to_date, employee_id, tenant)

# ============ IOT FLOWS ============

@api_router.get("/flows")
async def get_flows():
    flows = await db.flows.find({}, {"_id": 0}).to_list(100)
    for f in flows:
        for k in ('created_at', 'updated_at'):
            if isinstance(f.get(k), str):
                f[k] = datetime.fromisoformat(f[k])
    return {"success": True, "flows": flows}

@api_router.post("/flows")
async def create_flow(flow_input: FlowCreate):
    flow = Flow(name=flow_input.name, nodes=flow_input.nodes, connections=flow_input.connections)
    doc = flow.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.flows.insert_one(doc)
    return {"success": True, "flow": flow.model_dump()}

@api_router.put("/flows/{flow_id}")
async def update_flow(flow_id: str, flow_input: FlowCreate):
    data = {"name": flow_input.name, "nodes": flow_input.nodes,
            "connections": flow_input.connections,
            "updated_at": datetime.now(timezone.utc).isoformat()}
    r = await db.flows.update_one({"id": flow_id}, {"$set": data})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Flow not found")
    return {"success": True, "message": "Flow updated"}

@api_router.delete("/flows/{flow_id}")
async def delete_flow(flow_id: str):
    r = await db.flows.delete_one({"id": flow_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Flow not found")
    return {"success": True, "message": "Flow deleted"}

@api_router.get("/flows/{flow_id}/export")
async def export_flow(flow_id: str):
    flow = await db.flows.find_one({"id": flow_id}, {"_id": 0})
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    return StreamingResponse(
        io.BytesIO(json.dumps(flow, indent=2, default=str).encode()),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=flow_{flow_id}.json"},
    )

# ============ EXPORTS ============

@api_router.get("/export/fleet-stats")
async def export_fleet_stats(
    request: Request,
    from_date: str = Query(...), to_date: str = Query(...),
    format: str = Query("csv"),
):
    h, tenant = await get_tenant_context(request)
    stats = await engine.compute_fleet_stats(h, from_date, to_date, None, tenant)

    if format == "json":
        return StreamingResponse(
            io.BytesIO(json.dumps(stats, indent=2, default=str).encode()),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=fleet_{from_date}_{to_date}.json"},
        )

    output = io.StringIO()
    w = csv.writer(output)
    w.writerow(["Véhicule", "ID", "Modèle", "Kilométrage", "Heures moteur", "Statut connexion", "Carburant (L)", "Coût carburant (CHF)"])
    for v in stats.get('vehicles', []):
        w.writerow([v['label'], v['tracker_id'], v['model'], v['mileage'],
                     v['engine_hours'], v['connection_status'],
                     v.get('fuel_used_liters', 'N/A'), v.get('fuel_cost_chf', 'N/A')])
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=fleet_{from_date}_{to_date}.csv"},
    )

@api_router.get("/export/driver-report")
async def export_driver_report(
    request: Request,
    from_date: str = Query(...), to_date: str = Query(...),
    format: str = Query("csv"),
):
    h, tenant = await get_tenant_context(request)
    report = await engine.compute_driver_report(h, from_date, to_date, None, tenant)

    if format == "json":
        return StreamingResponse(
            io.BytesIO(json.dumps(report, indent=2, default=str).encode()),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=drivers_{from_date}_{to_date}.json"},
        )

    output = io.StringIO()
    w = csv.writer(output)
    w.writerow(["Conducteur", "ID", "Téléphone", "Véhicule", "Distance (km)"])
    for d in report.get('drivers', []):
        for v in d.get('vehicles', []):
            w.writerow([d['driver_name'], d['employee_id'], d['phone'],
                        v['vehicle_label'], v.get('distance', 0)])
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=drivers_{from_date}_{to_date}.csv"},
    )

# ============ MAP / POSITIONS ============

@api_router.get("/map/positions")
async def get_all_positions(request: Request):
    h, _ = await get_tenant_context(request)
    tk_data = await navixy.get_trackers(h)
    if not tk_data.get('success'):
        raise HTTPException(status_code=400, detail="Failed to fetch trackers")

    tid_list = [t['id'] for t in tk_data.get('list', [])]
    states = await navixy.get_tracker_states_batch(tid_list, h)

    positions = []
    for t in tk_data.get('list', []):
        state = states.get(t['id'], {})
        gps = state.get('gps', {})
        loc = gps.get('location', {})
        if loc and loc.get('lat') and loc.get('lng'):
            positions.append({
                "tracker_id": t['id'], "label": t['label'],
                "model": t.get('source', {}).get('model', 'Unknown'),
                "lat": loc.get('lat'), "lng": loc.get('lng'),
                "speed": gps.get('speed', 0), "heading": gps.get('heading', 0),
                "updated": gps.get('updated'),
                "connection_status": state.get('connection_status', 'unknown'),
                "movement_status": state.get('movement_status', 'unknown'),
            })

    return {"success": True, "positions": positions, "timestamp": datetime.now(timezone.utc).isoformat()}

@api_router.get("/map/position/{tracker_id}")
async def get_tracker_position(tracker_id: int, request: Request):
    h, _ = await get_tenant_context(request)
    data = await navixy.get_tracker_state(tracker_id, h)
    if not data.get('success'):
        raise HTTPException(status_code=400, detail="Failed to fetch tracker state")
    state = data.get('state', {})
    gps = state.get('gps', {})
    loc = gps.get('location', {})
    return {
        "success": True, "tracker_id": tracker_id,
        "lat": loc.get('lat', 0), "lng": loc.get('lng', 0),
        "speed": gps.get('speed', 0), "heading": gps.get('heading', 0),
        "updated": gps.get('updated'),
        "connection_status": state.get('connection_status', 'unknown'),
        "movement_status": state.get('movement_status', 'unknown'),
    }

# ============ CACHE / DEBUG ============

@api_router.get("/debug/cache-stats")
async def cache_stats():
    return {"success": True, "cache": cache.stats()}

# ============ MOUNT ============

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    mongo_client.close()
