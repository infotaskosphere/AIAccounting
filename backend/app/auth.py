"""
Auth Module — JWT + bcrypt
"""
from __future__ import annotations
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import bcrypt
import jwt
import asyncpg

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production-please")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

bearer_scheme = HTTPBearer()


# ─── Password ─────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


# ─── JWT ──────────────────────────────────────────────────────────────────────

def create_access_token(user_id: int, company_id: int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "company_id": company_id,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ─── FastAPI deps ─────────────────────────────────────────────────────────────

class CurrentUser:
    def __init__(self, user_id: int, company_id: int, role: str, name: str, email: str):
        self.user_id = user_id
        self.company_id = company_id
        self.role = role
        self.name = name
        self.email = email


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db=None,   # injected by main.py via Depends(get_db)
) -> CurrentUser:
    payload = decode_token(credentials.credentials)
    user_id = int(payload["sub"])
    company_id = payload["company_id"]
    role = payload["role"]

    # lightweight — trust JWT (no DB hit per request)
    return CurrentUser(
        user_id=user_id,
        company_id=company_id,
        role=role,
        name=payload.get("name", ""),
        email=payload.get("email", ""),
    )


def require_role(*roles: str):
    """Dependency factory: require one of the given roles."""
    async def checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker


# Convenience aliases
require_admin = require_role("admin")
require_accountant = require_role("admin", "accountant")
