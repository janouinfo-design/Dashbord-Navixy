"""LOGITRAK — Module d'authentification (JWT + bcrypt + Fernet). Phase 1 sécurité."""
import os
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Request, Response, HTTPException
from pydantic import BaseModel
from cryptography.fernet import Fernet

JWT_ALGORITHM = "HS256"
ACCESS_TTL_MIN = 480
REFRESH_TTL_DAYS = 7
ROLES = ("SUPER_ADMIN", "ADMIN", "MANAGER", "READ_ONLY", "DRIVER")
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def _fernet() -> Fernet:
    return Fernet(os.environ["ENCRYPTION_KEY"].encode())


# ---------- Passwords ----------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


# ---------- Chiffrement navixy_hash au repos ----------

def encrypt_hash(plain: str) -> str:
    if not plain or plain.startswith("enc:"):
        return plain
    return "enc:" + _fernet().encrypt(plain.encode()).decode()


def decrypt_hash(stored: str) -> str:
    if not stored or not stored.startswith("enc:"):
        return stored
    return _fernet().decrypt(stored[4:].encode()).decode()


# ---------- JWT ----------

def create_access_token(user: dict) -> str:
    payload = {
        "sub": user["id"], "email": user["email"], "role": user["role"],
        "tenant_id": user.get("tenant_id"), "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TTL_MIN),
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "refresh",
               "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TTL_DAYS)}
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def _set_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="lax", max_age=ACCESS_TTL_MIN * 60, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="lax", max_age=REFRESH_TTL_DAYS * 86400, path="/")


def _sanitize(user: dict) -> dict:
    return {k: v for k, v in user.items() if k not in ("password_hash", "_id")}


# ---------- Dépendances ----------

async def get_current_user(request: Request, db) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expirée")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Jeton invalide")
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Type de jeton invalide")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Utilisateur introuvable ou désactivé")
    return user


def make_require_user(db):
    async def require_user(request: Request) -> dict:
        user = await get_current_user(request, db)
        request.state.user = user
        return user
    return require_user


def require_role(*roles):
    async def dep(request: Request) -> dict:
        user = getattr(request.state, "user", None)
        if not user:
            raise HTTPException(status_code=401, detail="Non authentifié")
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Accès refusé — rôle insuffisant")
        return user
    return dep


# ---------- Brute force ----------

async def _check_lockout(db, identifier: str):
    rec = await db.login_attempts.find_one({"identifier": identifier})
    if rec and rec.get("count", 0) >= MAX_LOGIN_ATTEMPTS:
        last = datetime.fromisoformat(rec["last_attempt"])
        if datetime.now(timezone.utc) - last < timedelta(minutes=LOCKOUT_MINUTES):
            raise HTTPException(status_code=429, detail=f"Trop de tentatives. Réessayez dans {LOCKOUT_MINUTES} minutes.")
        await db.login_attempts.delete_one({"identifier": identifier})


async def _record_failure(db, identifier: str):
    await db.login_attempts.update_one(
        {"identifier": identifier},
        {"$inc": {"count": 1}, "$set": {"last_attempt": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )


# ---------- Seed + migration idempotente ----------

async def seed_and_migrate(db):
    await db.users.create_index("email", unique=True)
    await db.users.create_index("tenant_id")
    await db.clients.create_index("subdomain", unique=True)
    await db.flows.create_index("tenant")
    await db.login_attempts.create_index("identifier")
    await db.impersonation_logs.create_index([("tenant", 1), ("started_at", -1)])

    await db.flows.update_many({"tenant": {"$exists": False}}, {"$set": {"tenant": "default"}})

    async for c in db.clients.find({"navixy_hash": {"$exists": True, "$ne": ""}}):
        h = c["navixy_hash"]
        if not h.startswith("enc:"):
            await db.clients.update_one({"_id": c["_id"]}, {"$set": {"navixy_hash": encrypt_hash(h)}})

    email = os.environ["SUPER_ADMIN_EMAIL"].lower()
    password = os.environ["SUPER_ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": email,
            "password_hash": hash_password(password),
            "role": "SUPER_ADMIN", "tenant_id": None,
            "first_name": "Super", "last_name": "Admin",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(password, existing["password_hash"]):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(password)}})


# ---------- Router ----------

class LoginInput(BaseModel):
    email: str
    password: str


def create_auth_router(db) -> APIRouter:
    router = APIRouter(prefix="/api/auth")

    @router.post("/login")
    async def login(body: LoginInput, request: Request, response: Response):
        email = body.email.strip().lower()
        ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0].strip()
        identifier = f"{ip}:{email}"
        await _check_lockout(db, identifier)

        user = await db.users.find_one({"email": email}, {"_id": 0})
        if not user or not verify_password(body.password, user["password_hash"]):
            await _record_failure(db, identifier)
            raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
        if not user.get("is_active", True):
            raise HTTPException(status_code=403, detail="Compte désactivé")

        await db.login_attempts.delete_one({"identifier": identifier})
        _set_cookies(response, create_access_token(user), create_refresh_token(user["id"]))
        return {"success": True, "user": _sanitize(user)}

    @router.post("/logout")
    async def logout(response: Response):
        response.delete_cookie("access_token", path="/")
        response.delete_cookie("refresh_token", path="/")
        return {"success": True}

    @router.get("/me")
    async def me(request: Request):
        user = await get_current_user(request, db)
        return {"success": True, "user": _sanitize(user)}

    @router.post("/refresh")
    async def refresh(request: Request, response: Response):
        token = request.cookies.get("refresh_token")
        if not token:
            raise HTTPException(status_code=401, detail="Aucun jeton de rafraîchissement")
        try:
            payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Jeton invalide")
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Type de jeton invalide")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user or not user.get("is_active", True):
            raise HTTPException(status_code=401, detail="Utilisateur introuvable ou désactivé")
        response.set_cookie("access_token", create_access_token(user), httponly=True, secure=True,
                            samesite="lax", max_age=ACCESS_TTL_MIN * 60, path="/")
        return {"success": True}

    return router
