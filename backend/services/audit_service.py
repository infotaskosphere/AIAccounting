"""
services/audit_service.py
--------------------------
Immutable audit log — every create/update/delete/AI-action is recorded.
"""
from __future__ import annotations
import asyncpg
import structlog
from typing import Optional

log = structlog.get_logger()


class AuditService:
    def __init__(self, db: asyncpg.Pool):
        self.db = db

    async def log(
        self,
        company_id: str,
        entity_type: str,
        entity_id: str,
        action: str,
        actor_id: Optional[str] = None,
        before_data: Optional[dict] = None,
        after_data:  Optional[dict] = None,
        ip_address:  Optional[str] = None,
    ) -> None:
        import json
        try:
            async with self.db.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO audit_log
                        (company_id, entity_type, entity_id, action,
                         actor_id, before_data, after_data, ip_address, created_at)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
                    """,
                    company_id, entity_type, entity_id, action,
                    actor_id,
                    json.dumps(before_data) if before_data else None,
                    json.dumps(after_data)  if after_data  else None,
                    ip_address,
                )
        except Exception as exc:
            log.error("audit_log_failed", error=str(exc), action=action)

    async def get_history(
        self,
        company_id: str,
        entity_type: Optional[str] = None,
        entity_id:   Optional[str] = None,
        limit: int = 100,
    ) -> list[dict]:
        conditions = ["company_id=$1"]
        params: list = [company_id]
        if entity_type:
            params.append(entity_type)
            conditions.append(f"entity_type=${len(params)}")
        if entity_id:
            params.append(entity_id)
            conditions.append(f"entity_id=${len(params)}")

        params.append(limit)
        where = " AND ".join(conditions)
        async with self.db.acquire() as conn:
            rows = await conn.fetch(
                f"SELECT * FROM audit_log WHERE {where} ORDER BY created_at DESC LIMIT ${len(params)}",
                *params
            )
        return [dict(r) for r in rows]
