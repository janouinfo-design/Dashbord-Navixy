"""
Vehicle administrative records (fiche administrative) — user-entered data stored in MongoDB.
GPS km / tracker info remain LOGITRAK-sourced; admin fields are user input, shown as-is.
"""
import os
import re
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Body, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse

UPLOAD_DIR = "/app/backend/uploads"
SECTIONS = {"general", "leasing", "assurance", "carte_grise"}
EMPTY_DOC = {
    "general": {}, "leasing": {}, "assurance": {}, "carte_grise": {},
    "controles": [], "etat_des_lieux": [], "documents": [],
}


def _now():
    return datetime.now(timezone.utc).isoformat()


def _safe_name(name: str) -> str:
    return re.sub(r'[^A-Za-z0-9._-]', '_', name or 'fichier')[:120]


def create_vehicle_admin_router(db, navixy, get_tenant_context, navixy_api_url):
    router = APIRouter(prefix="/vehicles/admin")
    col = db.vehicle_admin

    GARAGE_FIELDS = ("label", "model", "reg_number", "vin", "manufacture_year", "color",
                     "liability_insurance_policy_number", "liability_insurance_valid_till",
                     "free_insurance_policy_number", "free_insurance_valid_till", "additional_info")

    def _map_garage(v: dict) -> dict:
        fn = v.get("avatar_file_name")
        return {
            "vehicle_id": v["id"],
            "tracker_id": v.get("tracker_id"),
            "label": v.get("label"),
            "model": v.get("model"),
            "type": v.get("type"),
            "subtype": v.get("subtype"),
            "manufacture_year": v.get("manufacture_year"),
            "color": v.get("color"),
            "reg_number": v.get("reg_number"),
            "vin": v.get("vin"),
            "garage": v.get("garage_organization_name"),
            "fuel_type": v.get("fuel_type"),
            "fuel_grade": v.get("fuel_grade"),
            "liability_insurance_policy_number": v.get("liability_insurance_policy_number"),
            "liability_insurance_valid_till": v.get("liability_insurance_valid_till"),
            "avatar_file_name": fn,
            "avatar_url": f"{navixy_api_url}/static/vehicle/avatars/{fn}" if fn else None,
        }

    @router.get("/navixy-garage")
    async def garage_list(request: Request):
        h, _ = await get_tenant_context(request)
        data = await navixy.get_vehicles(h)
        if not data.get("success"):
            return {"success": False, "error": "Échec récupération garage"}
        linked, unlinked = {}, []
        for v in data.get("list", []):
            m = _map_garage(v)
            if m["tracker_id"]:
                linked[str(m["tracker_id"])] = m
            else:
                unlinked.append(m)
        return {"success": True, "linked": linked, "unlinked": unlinked}

    @router.put("/navixy-garage/{vehicle_id}")
    async def garage_update(vehicle_id: int, request: Request, payload: dict = Body(...)):
        h, _ = await get_tenant_context(request)
        data = (payload.get("data") or {})
        read = await navixy.read_vehicle(vehicle_id, h)
        if not read.get("success"):
            raise HTTPException(404, "Véhicule garage introuvable")
        vehicle = read["value"]
        for k in GARAGE_FIELDS:
            if k in data:
                val = data[k]
                if val == "":
                    val = None if k in ("manufacture_year", "liability_insurance_valid_till", "free_insurance_valid_till", "color") else ""
                if k == "manufacture_year" and val is not None:
                    try:
                        val = int(val)
                    except (TypeError, ValueError):
                        val = None
                vehicle[k] = val
        upd = await navixy.update_vehicle(vehicle, h)
        if not upd.get("success"):
            raise HTTPException(502, f"Échec mise à jour garage: {upd.get('status')}")
        reread = await navixy.read_vehicle(vehicle_id, h)
        return {"success": True, "vehicle": _map_garage(reread["value"])}

    @router.post("/navixy-garage/{vehicle_id}/photo")
    async def garage_photo(vehicle_id: int, request: Request, file: UploadFile = File(...)):
        h, _ = await get_tenant_context(request)
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(413, "Image trop volumineuse (max 10 Mo)")
        res = await navixy.upload_vehicle_avatar(vehicle_id, _safe_name(file.filename),
                                                 content, file.content_type or "image/jpeg", h)
        if not res.get("success"):
            raise HTTPException(502, f"Échec upload photo: {res.get('status')}")
        fn = res.get("value")
        return {"success": True, "avatar_file_name": fn,
                "avatar_url": f"{navixy_api_url}/static/vehicle/avatars/{fn}"}


    async def _get_or_empty(tenant: str, tracker_id: int):
        doc = await col.find_one({"tenant": tenant, "tracker_id": tracker_id}, {"_id": 0})
        return doc or {"tenant": tenant, "tracker_id": tracker_id, **EMPTY_DOC}

    @router.get("")
    async def list_records(request: Request):
        _, tenant = await get_tenant_context(request)
        docs = await col.find({"tenant": tenant}, {"_id": 0}).to_list(1000)
        return {"success": True, "records": {str(d["tracker_id"]): d for d in docs}}

    @router.put("/{tracker_id}")
    async def upsert_section(tracker_id: int, request: Request, payload: dict = Body(...)):
        section = payload.get("section")
        data = payload.get("data") or {}
        data = {k: v for k, v in data.items() if v not in ("", None)}
        if section not in SECTIONS:
            raise HTTPException(400, f"Section invalide: {section}")
        _, tenant = await get_tenant_context(request)
        await col.update_one(
            {"tenant": tenant, "tracker_id": tracker_id},
            {"$set": {section: data, "updated_at": _now()},
             "$setOnInsert": {k: v for k, v in EMPTY_DOC.items() if k != section}},
            upsert=True,
        )
        return {"success": True, "record": await _get_or_empty(tenant, tracker_id)}

    # ---- Contrôles ----
    @router.post("/{tracker_id}/controles")
    async def add_controle(tracker_id: int, request: Request, payload: dict = Body(...)):
        _, tenant = await get_tenant_context(request)
        item = {
            "id": str(uuid.uuid4()),
            "label": payload.get("label") or "Controle",
            "due_date": payload.get("due_date"),
            "done_date": payload.get("done_date"),
            "notes": payload.get("notes", ""),
            "created_at": _now(),
        }
        await col.update_one(
            {"tenant": tenant, "tracker_id": tracker_id},
            {"$push": {"controles": item}, "$set": {"updated_at": _now()},
             "$setOnInsert": {k: v for k, v in EMPTY_DOC.items() if k != "controles"}},
            upsert=True,
        )
        return {"success": True, "record": await _get_or_empty(tenant, tracker_id)}

    @router.put("/{tracker_id}/controles/{cid}")
    async def update_controle(tracker_id: int, cid: str, request: Request, payload: dict = Body(...)):
        _, tenant = await get_tenant_context(request)
        sets = {f"controles.$.{k}": payload[k] for k in ("label", "due_date", "done_date", "notes") if k in payload}
        sets["updated_at"] = _now()
        await col.update_one({"tenant": tenant, "tracker_id": tracker_id, "controles.id": cid}, {"$set": sets})
        return {"success": True, "record": await _get_or_empty(tenant, tracker_id)}

    @router.delete("/{tracker_id}/controles/{cid}")
    async def delete_controle(tracker_id: int, cid: str, request: Request):
        _, tenant = await get_tenant_context(request)
        await col.update_one({"tenant": tenant, "tracker_id": tracker_id},
                             {"$pull": {"controles": {"id": cid}}, "$set": {"updated_at": _now()}})
        return {"success": True, "record": await _get_or_empty(tenant, tracker_id)}

    # ---- État des lieux ----
    @router.post("/{tracker_id}/etat-des-lieux")
    async def add_etat(tracker_id: int, request: Request, payload: dict = Body(...)):
        _, tenant = await get_tenant_context(request)
        item = {
            "id": str(uuid.uuid4()),
            "date": payload.get("date"),
            "km": payload.get("km"),
            "etat": payload.get("etat", ""),
            "notes": payload.get("notes", ""),
            "created_at": _now(),
        }
        await col.update_one(
            {"tenant": tenant, "tracker_id": tracker_id},
            {"$push": {"etat_des_lieux": item}, "$set": {"updated_at": _now()},
             "$setOnInsert": {k: v for k, v in EMPTY_DOC.items() if k != "etat_des_lieux"}},
            upsert=True,
        )
        return {"success": True, "record": await _get_or_empty(tenant, tracker_id)}

    @router.delete("/{tracker_id}/etat-des-lieux/{eid}")
    async def delete_etat(tracker_id: int, eid: str, request: Request):
        _, tenant = await get_tenant_context(request)
        await col.update_one({"tenant": tenant, "tracker_id": tracker_id},
                             {"$pull": {"etat_des_lieux": {"id": eid}}, "$set": {"updated_at": _now()}})
        return {"success": True, "record": await _get_or_empty(tenant, tracker_id)}

    # ---- Documents (fichiers) ----
    @router.post("/{tracker_id}/documents")
    async def upload_document(tracker_id: int, request: Request,
                              file: UploadFile = File(...), category: str = Form("Autre")):
        _, tenant = await get_tenant_context(request)
        doc_id = str(uuid.uuid4())
        folder = os.path.join(UPLOAD_DIR, tenant, str(tracker_id))
        os.makedirs(folder, exist_ok=True)
        fname = _safe_name(file.filename)
        path = os.path.join(folder, f"{doc_id}_{fname}")
        size = 0
        with open(path, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > 25 * 1024 * 1024:
                    f.close()
                    os.remove(path)
                    raise HTTPException(413, "Fichier trop volumineux (max 25 Mo)")
                f.write(chunk)
        meta = {
            "id": doc_id, "filename": fname, "category": category,
            "size": size, "content_type": file.content_type or "application/octet-stream",
            "uploaded_at": _now(),
        }
        await col.update_one(
            {"tenant": tenant, "tracker_id": tracker_id},
            {"$push": {"documents": meta}, "$set": {"updated_at": _now()},
             "$setOnInsert": {k: v for k, v in EMPTY_DOC.items() if k != "documents"}},
            upsert=True,
        )
        return {"success": True, "record": await _get_or_empty(tenant, tracker_id)}

    @router.get("/{tracker_id}/documents/{doc_id}")
    async def download_document(tracker_id: int, doc_id: str, request: Request):
        _, tenant = await get_tenant_context(request)
        doc = await col.find_one({"tenant": tenant, "tracker_id": tracker_id}, {"_id": 0, "documents": 1})
        meta = next((m for m in (doc or {}).get("documents", []) if m["id"] == doc_id), None)
        if not meta:
            raise HTTPException(404, "Document introuvable")
        path = os.path.join(UPLOAD_DIR, tenant, str(tracker_id), f"{doc_id}_{meta['filename']}")
        if not os.path.exists(path):
            raise HTTPException(404, "Fichier introuvable sur le disque")
        return FileResponse(path, media_type=meta["content_type"], filename=meta["filename"])

    @router.delete("/{tracker_id}/documents/{doc_id}")
    async def delete_document(tracker_id: int, doc_id: str, request: Request):
        _, tenant = await get_tenant_context(request)
        doc = await col.find_one({"tenant": tenant, "tracker_id": tracker_id}, {"_id": 0, "documents": 1})
        meta = next((m for m in (doc or {}).get("documents", []) if m["id"] == doc_id), None)
        if meta:
            path = os.path.join(UPLOAD_DIR, tenant, str(tracker_id), f"{doc_id}_{meta['filename']}")
            if os.path.exists(path):
                os.remove(path)
        await col.update_one({"tenant": tenant, "tracker_id": tracker_id},
                             {"$pull": {"documents": {"id": doc_id}}, "$set": {"updated_at": _now()}})
        return {"success": True, "record": await _get_or_empty(tenant, tracker_id)}

    return router
