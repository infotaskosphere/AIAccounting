"""
app/routes/simple_mode.py
--------------------------
Backend routes for Simple Mode (layman UX).
Plain-English transactions that auto-classify and post.
"""
from __future__ import annotations

from datetime import date as date_type
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import asyncpg

from app.auth import get_current_user
from services.transaction_service import TransactionService
from services.ai_service import AIService

router = APIRouter(prefix="/api/v1/simple", tags=["Simple Mode"])

# Category → ledger code hints (will be resolved to actual account_id via AI)
CATEGORY_MAP = {
    "Sales / Revenue": "income",
    "Service Income":  "income",
    "Rental Income":   "income",
    "Interest Received": "income",
    "Other Income":    "income",
    "Rent":            "expense",
    "Salaries":        "expense",
    "Raw Materials":   "expense",
    "Electricity":     "expense",
    "Marketing":       "expense",
    "Logistics":       "expense",
    "Bank Charges":    "expense",
    "Other Expense":   "expense",
}


class SimpleTransactionIn(BaseModel):
    type:     str           # 'credit' | 'debit'
    amount:   float
    category: str
    note:     Optional[str] = ""
    date:     Optional[str] = None


def _get_pool(request=None):
    from app.main import pool
    return pool


@router.post("/transaction")
async def post_simple_transaction(
    body: SimpleTransactionIn,
    user: dict = Depends(get_current_user),
):
    """
    Layman-friendly transaction entry.
    Auto-classifies using category hint + AI, creates journal entry.
    """
    from app.main import pool, app
    svc = TransactionService(pool)
    svc.ai.set_classifier(app.state.classifier)

    narration = f"{body.category}: {body.note}" if body.note else body.category
    txn_date = date_type.fromisoformat(body.date) if body.date else date_type.today()

    result = await svc.auto_post_transaction(
        company_id=user["company_id"],
        narration=narration,
        amount=Decimal(str(body.amount)),
        txn_date=txn_date,
        txn_type=body.type,
        source="manual",
        user_id=user["sub"],
    )
    return {"success": True, "data": result}


@router.get("/recent")
async def get_recent_transactions(
    limit: int = 20,
    user: dict = Depends(get_current_user),
):
    """Return recent transactions in simple format."""
    from app.main import pool
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT bt.txn_date, bt.amount, bt.txn_type, bt.narration, bt.status
            FROM bank_transactions bt
            WHERE bt.company_id=$1
            ORDER BY bt.txn_date DESC, bt.created_at DESC
            LIMIT $2
            """,
            user["company_id"], limit
        )
    return {"success": True, "data": [dict(r) for r in rows]}


@router.get("/summary")
async def get_simple_summary(user: dict = Depends(get_current_user)):
    """Quick financial summary for Simple Mode dashboard."""
    from app.main import pool
    from services.reporting_service import ReportingService
    svc = ReportingService(pool)
    data = await svc.get_dashboard_summary(user["company_id"])
    return {"success": True, "data": data}
