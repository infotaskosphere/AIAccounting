# backend/app/deps.py
# FastAPI dependency injection — DB pool, auth, company context

from typing import AsyncGenerator
import asyncpg
from fastapi import Depends, HTTPException, Header
from jose import JWTError, jwt
import os

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM  = "HS256"

# ── DB Pool ────────────────────────────────────────────────────────────────
# Set by lifespan in main.py
_pool: asyncpg.Pool | None = None

def set_pool(pool: asyncpg.Pool) -> None:
    global _pool
    _pool = pool

async def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise HTTPException(503, "Database not available")
    return _pool

# ── Auth ───────────────────────────────────────────────────────────────────
async def get_current_user(authorization: str = Header(default="")) -> dict:
    """
    Validate Bearer JWT token.
    Returns decoded payload: {sub: user_id, company_id: ..., role: ...}
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")

async def get_company_id(user: dict = Depends(get_current_user)) -> str:
    company_id = user.get("company_id")
    if not company_id:
        raise HTTPException(400, "No company associated with this user")
    return company_id

# ── Optional auth (for dev/demo mode) ──────────────────────────────────────
DEMO_COMPANY_ID = "demo-company-uuid-0000-000000000001"

async def get_company_id_optional(authorization: str = Header(default="")) -> str:
    """
    In dev/demo mode returns a fixed company ID without auth.
    In production, swap this for get_company_id above.
    """
    if not authorization:
        return DEMO_COMPANY_ID
    try:
        payload = jwt.decode(
            authorization.replace("Bearer ", ""),
            SECRET_KEY, algorithms=[ALGORITHM]
        )
        return payload.get("company_id", DEMO_COMPANY_ID)
    except Exception:
        return DEMO_COMPANY_ID
