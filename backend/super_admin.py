"""LOGITRAK — Espace Super Admin (Phase 2). Toutes routes réservées SUPER_ADMIN."""
import re
import uuid
import shutil
import secrets
import asyncio
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel

from auth import require_role, hash_password, encrypt_hash, decrypt_hash, MODULES

SLUG_RE = re.compile(r'^[a-z0-9](?:[a-z0-9-]{1,30})[a-z0-9]$')
TENANT_ROLES = ("ADMIN", "MANAGER", "READ_ONLY", "DRIVER")
MODULE_IDS = {m["id"] for m in MODULES}


def _now():
    return datetime.now(timezone.utc).isoformat()


def _temp_password():
    return "LT-" + secrets.token_urlsafe(10)


def _mask(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k not in ("navixy_hash", "_id")}


class NavixyTest(BaseModel):
    navixy_hash: str


class CompanyInput(BaseModel):
    name: str
    display_name: Optional[str] = None
    subdomain: str
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = "Europe/Zurich"
    logo_url: Optional[str] = None
    primary_color: Optional[str] = "#1e88e5"
    is_test: bool = False


class AdminUserInput(BaseModel):
    first_name: str
    last_name: str
    email: str


class ClientFullCreate(BaseModel):
    company: CompanyInput
    admin_user: AdminUserInput
    navixy_hash: str
    modules: List[str]


class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    role: str


class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None


class ModulesUpdate(BaseModel):
    modules: List[str]


class ImpersonationStart(BaseModel):
    tenant: str


class ImpersonationEnd(BaseModel):
    log_id: str


def create_super_admin_router(db, navixy, cache) -> APIRouter:
    router = APIRouter(prefix="/admin", dependencies=[Depends(require_role("SUPER_ADMIN"))])

    async def _get_client(client_id: str) -> dict:
        client = await db.clients.find_one({"id": client_id}, {"_id": 0})
        if not client:
            raise HTTPException(status_code=404, detail="Client introuvable")
        return client

    def _tenant_of(client: dict) -> str:
        return client.get("tenant") or client["subdomain"]

    async def _audit(tenant: str, action: str, by: str, detail: str = None):
        await db.audit_log.insert_one({"tenant": tenant, "action": action, "by": by,
                                       "detail": detail, "at": _now()})

    async def _navixy_status(tenant: str, nav_hash: str) -> dict:
        cached, hit, _ = cache.get(tenant, "sa:navixy_status")
        if hit:
            return cached
        if not nav_hash:
            st = {"status": "error", "trackers": None, "error": "Aucune configuration Navixy"}
            cache.set(tenant, "sa:navixy_status", st)
            return st
        data = await navixy.request("tracker/list", {}, decrypt_hash(nav_hash))
        if data.get("success"):
            st = {"status": "ok", "trackers": len(data.get("list", [])), "error": None}
            await db.tenant_sync.update_one({"tenant": tenant},
                                            {"$set": {"last_sync_at": _now()}}, upsert=True)
        else:
            err = data.get("status", {}) or data.get("error", "inconnu")
            st = {"status": "error", "trackers": None, "error": str(err)[:200]}
        cache.set(tenant, "sa:navixy_status", st)
        return st

    # ---------- Modules ----------

    @router.get("/modules")
    async def list_modules():
        return {"success": True, "modules": MODULES}

    # ---------- Dashboard / overview ----------

    @router.get("/overview")
    async def overview():
        clients = await db.clients.find({}, {"_id": 0}).to_list(500)
        syncs = {s["tenant"]: s.get("last_sync_at") async for s in db.tenant_sync.find({})}
        counts = {}
        async for row in db.users.aggregate([
            {"$match": {"tenant_id": {"$ne": None}}},
            {"$group": {"_id": "$tenant_id", "n": {"$sum": 1}}},
        ]):
            counts[row["_id"]] = row["n"]
        statuses = await asyncio.gather(*[
            _navixy_status(_tenant_of(c), c.get("navixy_hash", "")) for c in clients
        ])
        rows, navixy_ok, navixy_err, vehicles_total = [], 0, 0, 0
        for c, st in zip(clients, statuses):
            tenant = _tenant_of(c)
            anomalies = []
            if not c.get("is_active", True):
                anomalies.append("Client suspendu")
            if st["status"] == "error":
                anomalies.append("Connexion Navixy en erreur")
            elif (st.get("trackers") or 0) == 0:
                anomalies.append("Aucun véhicule accessible")
            if not syncs.get(tenant):
                anomalies.append("Aucune synchronisation enregistrée")
            if counts.get(tenant, 0) == 0:
                anomalies.append("Aucun utilisateur")
            if st["status"] == "ok":
                navixy_ok += 1
                vehicles_total += st.get("trackers") or 0
            else:
                navixy_err += 1
            rows.append({**_mask(c), "tenant": tenant, "navixy": st,
                         "users_count": counts.get(tenant, 0),
                         "last_sync_at": syncs.get(tenant), "anomalies": anomalies})
        return {"success": True,
                "kpis": {
                    "clients_total": len(clients),
                    "clients_active": sum(1 for c in clients if c.get("is_active", True)),
                    "clients_suspended": sum(1 for c in clients if not c.get("is_active", True)),
                    "vehicles_total": vehicles_total,
                    "users_total": await db.users.count_documents({}),
                    "navixy_ok": navixy_ok,
                    "navixy_error": navixy_err,
                },
                "clients": rows}

    # ---------- Test connexion Navixy (backend only, secret jamais renvoyé) ----------

    @router.post("/navixy/test")
    async def navixy_test(body: NavixyTest):
        h = body.navixy_hash.strip()
        if not h:
            raise HTTPException(status_code=400, detail="Hash Navixy requis")
        tk = await navixy.request("tracker/list", {}, h)
        if not tk.get("success"):
            err = tk.get("status", {}) or tk.get("error", "inconnu")
            return {"success": True, "result": {"ok": False,
                    "message": f"Connexion impossible : {str(err)[:200]}"}}
        account = None
        info = await navixy.request("user/get_info", {}, h)
        if info.get("success"):
            ui = info.get("user_info", {}) or {}
            account = ui.get("login") or ui.get("title")
        return {"success": True, "result": {"ok": True,
                "trackers": len(tk.get("list", [])), "account": account}}

    # ---------- Création client (wizard, atomique avec rollback) ----------

    @router.post("/clients/full")
    async def create_client_full(body: ClientFullCreate, request: Request):
        sub = body.company.subdomain.strip().lower()
        if not SLUG_RE.match(sub):
            raise HTTPException(status_code=400,
                                detail="Identifiant invalide : minuscules, chiffres et tirets (3-32 caractères)")
        if await db.clients.find_one({"$or": [{"subdomain": sub}, {"tenant": sub}]}):
            raise HTTPException(status_code=400, detail="Cet identifiant est déjà utilisé")
        if sub == "default":
            raise HTTPException(status_code=400, detail="Identifiant réservé")
        email = body.admin_user.email.strip().lower()
        if await db.users.find_one({"email": email}):
            raise HTTPException(status_code=400, detail="Cet email utilisateur existe déjà")
        bad = [m for m in body.modules if m not in MODULE_IDS]
        if bad:
            raise HTTPException(status_code=400, detail=f"Modules inconnus : {bad}")
        if not body.navixy_hash.strip():
            raise HTTPException(status_code=400, detail="Configuration Navixy requise")

        client_id = str(uuid.uuid4())
        doc = {
            "id": client_id, "tenant": sub, "subdomain": sub,
            "name": body.company.display_name or body.company.name,
            "company_name": body.company.name,
            "contact_email": body.company.contact_email, "phone": body.company.phone,
            "address": body.company.address, "country": body.company.country,
            "timezone": body.company.timezone, "logo_url": body.company.logo_url,
            "primary_color": body.company.primary_color or "#1e88e5",
            "navixy_hash": encrypt_hash(body.navixy_hash.strip()),
            "modules": body.modules, "is_test": body.company.is_test,
            "is_active": True, "created_at": _now(),
        }
        await db.clients.insert_one(doc)
        temp_password = _temp_password()
        try:
            await db.users.insert_one({
                "id": str(uuid.uuid4()), "tenant_id": sub, "email": email,
                "first_name": body.admin_user.first_name, "last_name": body.admin_user.last_name,
                "role": "ADMIN", "password_hash": hash_password(temp_password),
                "is_active": True, "must_change_password": True, "created_at": _now(),
            })
        except Exception:
            await db.clients.delete_one({"id": client_id})
            raise HTTPException(status_code=500, detail="Échec création administrateur — création annulée (rollback)")
        await _audit(sub, "client_created", request.state.user["email"])
        return {"success": True, "client": _mask(doc),
                "admin_user": {"email": email, "temp_password": temp_password},
                "dashboard_url": f"https://{sub}.logitrak.ch"}

    # ---------- Fiche client ----------

    @router.get("/clients/{client_id}/detail")
    async def client_detail(client_id: str):
        client = await _get_client(client_id)
        tenant = _tenant_of(client)
        users = await db.users.find({"tenant_id": tenant}, {"_id": 0, "password_hash": 0}).to_list(500)
        navixy_st = await _navixy_status(tenant, client.get("navixy_hash", ""))
        sync = await db.tenant_sync.find_one({"tenant": tenant}, {"_id": 0})
        return {"success": True, "client": _mask(client), "tenant": tenant,
                "users": users, "navixy": navixy_st,
                "last_sync_at": (sync or {}).get("last_sync_at")}

    @router.get("/clients/{client_id}/activity")
    async def client_activity(client_id: str):
        client = await _get_client(client_id)
        tenant = _tenant_of(client)
        imps = await db.impersonation_logs.find({"tenant": tenant}, {"_id": 0}) \
            .sort("started_at", -1).to_list(50)
        audits = await db.audit_log.find({"tenant": tenant}, {"_id": 0}).sort("at", -1).to_list(50)
        sync = await db.tenant_sync.find_one({"tenant": tenant}, {"_id": 0})
        return {"success": True, "impersonations": imps, "audit": audits,
                "last_sync_at": (sync or {}).get("last_sync_at")}

    # ---------- Utilisateurs du tenant ----------

    @router.get("/clients/{client_id}/users")
    async def client_users(client_id: str):
        client = await _get_client(client_id)
        tenant = _tenant_of(client)
        users = await db.users.find({"tenant_id": tenant}, {"_id": 0, "password_hash": 0}).to_list(500)
        return {"success": True, "tenant": tenant, "users": users}

    @router.post("/clients/{client_id}/users")
    async def add_user(client_id: str, body: UserCreate, request: Request):
        client = await _get_client(client_id)
        tenant = _tenant_of(client)
        if body.role not in TENANT_ROLES:
            raise HTTPException(status_code=400, detail="Rôle non autorisé pour un utilisateur client")
        email = body.email.strip().lower()
        if await db.users.find_one({"email": email}):
            raise HTTPException(status_code=400, detail="Cet email existe déjà")
        temp_password = _temp_password()
        user = {
            "id": str(uuid.uuid4()), "tenant_id": tenant, "email": email,
            "first_name": body.first_name, "last_name": body.last_name,
            "role": body.role, "password_hash": hash_password(temp_password),
            "is_active": True, "must_change_password": True, "created_at": _now(),
        }
        await db.users.insert_one(user)
        await _audit(tenant, "user_created", request.state.user["email"], f"{email} ({body.role})")
        return {"success": True,
                "user": {k: v for k, v in user.items() if k not in ("password_hash", "_id")},
                "temp_password": temp_password}

    @router.put("/users/{user_id}")
    async def update_user(user_id: str, body: UserUpdate, request: Request):
        target = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not target:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable")
        if target["role"] == "SUPER_ADMIN":
            raise HTTPException(status_code=403, detail="Un SUPER_ADMIN ne peut pas être modifié ici")
        data = {}
        if body.role is not None:
            if body.role not in TENANT_ROLES:
                raise HTTPException(status_code=400, detail="Rôle non autorisé")
            data["role"] = body.role
        if body.is_active is not None:
            data["is_active"] = body.is_active
        if not data:
            raise HTTPException(status_code=400, detail="Aucune donnée à modifier")
        await db.users.update_one({"id": user_id}, {"$set": data})
        by = request.state.user["email"]
        tenant = target.get("tenant_id") or "-"
        if body.is_active is False:
            await _audit(tenant, "USER_DISABLED", by, target["email"])
        elif body.is_active is True:
            await _audit(tenant, "USER_REACTIVATED", by, target["email"])
        if body.role is not None:
            await _audit(tenant, "user_role_updated", by, f"{target['email']} → {body.role}")
        return {"success": True}

    @router.post("/users/{user_id}/reset-password")
    async def reset_password(user_id: str, request: Request):
        target = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not target:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable")
        if target["role"] == "SUPER_ADMIN":
            raise HTTPException(status_code=403, detail="Réinitialisation SUPER_ADMIN via .env uniquement")
        temp_password = _temp_password()
        await db.users.update_one({"id": user_id}, {"$set": {
            "password_hash": hash_password(temp_password), "must_change_password": True}})
        await _audit(target.get("tenant_id") or "-", "PASSWORD_RESET_BY_ADMIN",
                     request.state.user["email"], target["email"])
        return {"success": True, "temp_password": temp_password}

    # ---------- Suspension / réactivation ----------

    @router.post("/clients/{client_id}/suspend")
    async def suspend_client(client_id: str, request: Request):
        client = await _get_client(client_id)
        tenant = _tenant_of(client)
        if tenant == "default":
            raise HTTPException(status_code=400, detail="Le tenant principal ne peut pas être suspendu depuis l'interface")
        await db.clients.update_one({"id": client_id}, {"$set": {
            "is_active": False, "suspended_at": _now(),
            "suspended_by": request.state.user["email"]}})
        cache.invalidate_tenant(tenant)
        await _audit(tenant, "client_suspended", request.state.user["email"])
        return {"success": True}

    @router.post("/clients/{client_id}/reactivate")
    async def reactivate_client(client_id: str, request: Request):
        client = await _get_client(client_id)
        tenant = _tenant_of(client)
        await db.clients.update_one({"id": client_id}, {"$set": {
            "is_active": True, "reactivated_at": _now(),
            "reactivated_by": request.state.user["email"]}})
        cache.invalidate_tenant(tenant)
        await _audit(tenant, "client_reactivated", request.state.user["email"])
        return {"success": True}

    # ---------- Modules par tenant ----------

    @router.put("/clients/{client_id}/modules")
    async def update_modules(client_id: str, body: ModulesUpdate, request: Request):
        client = await _get_client(client_id)
        tenant = _tenant_of(client)
        bad = [m for m in body.modules if m not in MODULE_IDS]
        if bad:
            raise HTTPException(status_code=400, detail=f"Modules inconnus : {bad}")
        await db.clients.update_one({"id": client_id}, {"$set": {"modules": body.modules}})
        cache.invalidate_tenant(tenant)
        await _audit(tenant, "modules_updated", request.state.user["email"], str(body.modules))
        return {"success": True, "modules": body.modules}

    # ---------- Impersonation (aperçu client) ----------

    @router.post("/impersonation/start")
    async def impersonation_start(body: ImpersonationStart, request: Request):
        t = body.tenant.strip().lower()
        client = await db.clients.find_one({"tenant": t, "is_active": True},
                                           {"_id": 0, "navixy_hash": 0})
        if not client and t != "default":
            raise HTTPException(status_code=404, detail="Tenant introuvable ou suspendu")
        ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or \
            (request.client.host if request.client else None)
        # Une seule session d'aperçu ouverte à la fois par super admin
        await db.impersonation_logs.update_many(
            {"super_admin_id": request.state.user["id"], "ended_at": None},
            {"$set": {"ended_at": _now()}})
        log = {"id": str(uuid.uuid4()), "super_admin_id": request.state.user["id"],
               "email": request.state.user["email"], "tenant": t, "ip": ip,
               "started_at": _now(), "ended_at": None}
        await db.impersonation_logs.insert_one(log)
        await _audit(t, "IMPERSONATION_STARTED", request.state.user["email"], f"IP {ip}")
        return {"success": True, "log_id": log["id"],
                "client": client or {"name": "Default", "tenant": "default"}}

    @router.post("/impersonation/end")
    async def impersonation_end(body: ImpersonationEnd, request: Request):
        r = await db.impersonation_logs.update_one(
            {"id": body.log_id, "super_admin_id": request.state.user["id"], "ended_at": None},
            {"$set": {"ended_at": _now()}})
        if r.modified_count:
            log = await db.impersonation_logs.find_one({"id": body.log_id}, {"_id": 0})
            await _audit(log["tenant"], "IMPERSONATION_ENDED", request.state.user["email"])
        return {"success": True}

    # ---------- Purge (tenants de test / procédure propre) ----------

    @router.delete("/clients/{client_id}/purge")
    async def purge_client(client_id: str, request: Request):
        client = await _get_client(client_id)
        tenant = _tenant_of(client)
        if tenant == "default":
            raise HTTPException(status_code=400, detail="Le tenant principal ne peut pas être purgé")
        await asyncio.gather(
            db.users.delete_many({"tenant_id": tenant}),
            db.vehicle_admin.delete_many({"tenant": tenant}),
            db.tenant_config.delete_many({"tenant": tenant}),
            db.flows.delete_many({"tenant": tenant}),
            db.tenant_sync.delete_many({"tenant": tenant}),
        )
        await db.clients.delete_one({"id": client_id})
        cache.invalidate_tenant(tenant)
        shutil.rmtree(f"/app/backend/uploads/{tenant}", ignore_errors=True)
        await _audit(tenant, "client_purged", request.state.user["email"], client.get("name"))
        return {"success": True, "message": f"Client '{client.get('name')}' et toutes ses données supprimés"}

    return router
