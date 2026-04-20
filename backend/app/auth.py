"""
app/auth.py
-----------
JWT authentication + Role-Based Access Control.
Roles: owner > manager > accountant > viewer
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, Header
from jose import JWTError, jwt

SECRET_KEY  = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM   = "HS256"
TOKEN_EXPIRE_HOURS = 24

ROLE_HIERARCHY = {"owner": 4, "manager": 3, "accountant": 2, "viewer": 1}


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(user_id: str, company_id: str, role: str) -> str:
    payload = {
        "sub":        user_id,
        "company_id": company_id,
        "role":       role,
        "exp":        datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise HTTPException(401, f"Invalid or expired token: {exc}")


# ── FastAPI Dependencies ───────────────────────────────────────────────────────

async def get_current_user(authorization: str = Header(default="")) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")
    return decode_token(authorization.split(" ", 1)[1])


async def require_role(min_role: str = "viewer"):
    """Factory: returns a dependency that enforces minimum role level."""
    async def _check(user: dict = Depends(get_current_user)) -> dict:
        user_level = ROLE_HIERARCHY.get(user.get("role", "viewer"), 0)
        min_level  = ROLE_HIERARCHY.get(min_role, 0)
        if user_level < min_level:
            raise HTTPException(403, f"Requires role '{min_role}' or higher")
        return user
    return _check


async def get_company_id(user: dict = Depends(get_current_user)) -> str:
    cid = user.get("company_id")
    if not cid:
        raise HTTPException(400, "No company in token")
    return cid


def require_owner():  return require_role("owner")
def require_manager(): return require_role("manager")
def require_accountant(): return require_role("accountant")
