"""
Simple Mode Router
Simplified endpoints for non-accountant users (viewers, business owners).
Returns plain-language summaries rather than raw accounting data.
"""
from __future__ import annotations
from fastapi import APIRouter, Depends
import asyncpg

from app.deps import get_db, get_current_user
from app.auth import CurrentUser

router = APIRouter(prefix="/simple", tags=["simple-mode"])


@router.get("/summary")
async def simple_summary(
    db: asyncpg.Connection = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """Plain-language financial summary for today."""
    # Cash & Bank
    cash_rows = await db.fetch(
        """
        SELECT a.name, ab.closing_balance
        FROM account_balances ab
        JOIN accounts a ON a.id = ab.account_id
        WHERE a.company_id=$1
          AND a.account_type IN ('bank','cash')
          AND a.is_active=true
        ORDER BY ab.closing_balance DESC
        """,
        user.company_id,
    )
    total_cash = sum(float(r["closing_balance"] or 0) for r in cash_rows)

    # Revenue this month
    revenue = await db.fetchval(
        """
        SELECT COALESCE(SUM(jl.credit_amount - jl.debit_amount), 0)
        FROM journal_lines jl
        JOIN vouchers v ON v.id = jl.voucher_id
        JOIN accounts a ON a.id = jl.account_id
        WHERE a.company_id=$1
          AND a.account_type = 'income'
          AND v.status = 'posted'
          AND DATE_TRUNC('month', v.voucher_date) = DATE_TRUNC('month', CURRENT_DATE)
        """,
        user.company_id,
    ) or 0

    # Expenses this month
    expenses = await db.fetchval(
        """
        SELECT COALESCE(SUM(jl.debit_amount - jl.credit_amount), 0)
        FROM journal_lines jl
        JOIN vouchers v ON v.id = jl.voucher_id
        JOIN accounts a ON a.id = jl.account_id
        WHERE a.company_id=$1
          AND a.account_type = 'expense'
          AND v.status = 'posted'
          AND DATE_TRUNC('month', v.voucher_date) = DATE_TRUNC('month', CURRENT_DATE)
        """,
        user.company_id,
    ) or 0

    profit = float(revenue) - float(expenses)

    # Pending approvals
    pending = await db.fetchval(
        "SELECT COUNT(*) FROM vouchers WHERE company_id=$1 AND status='draft'",
        user.company_id,
    ) or 0

    return {
        "total_cash_and_bank": round(total_cash, 2),
        "this_month_revenue": round(float(revenue), 2),
        "this_month_expenses": round(float(expenses), 2),
        "this_month_profit": round(profit, 2),
        "pending_approvals": pending,
        "cash_accounts": [
            {"name": r["name"], "balance": round(float(r["closing_balance"] or 0), 2)}
            for r in cash_rows
        ],
        "health": "good" if profit > 0 else "monitor",
    }


@router.get("/expenses/top")
async def top_expenses(
    months: int = 1,
    db: asyncpg.Connection = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    rows = await db.fetch(
        """
        SELECT a.name,
               SUM(jl.debit_amount - jl.credit_amount) AS total
        FROM journal_lines jl
        JOIN vouchers v ON v.id = jl.voucher_id
        JOIN accounts a ON a.id = jl.account_id
        WHERE a.company_id=$1
          AND a.account_type = 'expense'
          AND v.status = 'posted'
          AND v.voucher_date >= CURRENT_DATE - ($2::int * 30)
        GROUP BY a.name
        ORDER BY total DESC
        LIMIT 10
        """,
        user.company_id, months,
    )
    return {
        "period_months": months,
        "top_expenses": [
            {"name": r["name"], "amount": round(float(r["total"] or 0), 2)}
            for r in rows
        ],
    }


@router.get("/gst/due")
async def gst_due(
    db: asyncpg.Connection = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """How much GST is payable (output - input ITC)."""
    output = await db.fetchval(
        """
        SELECT COALESCE(SUM(ab.closing_balance), 0)
        FROM account_balances ab
        JOIN accounts a ON a.id = ab.account_id
        WHERE a.company_id=$1
          AND a.code LIKE '31%'
          AND a.name ILIKE '%output%'
        """,
        user.company_id,
    ) or 0

    input_itc = await db.fetchval(
        """
        SELECT COALESCE(SUM(ab.closing_balance), 0)
        FROM account_balances ab
        JOIN accounts a ON a.id = ab.account_id
        WHERE a.company_id=$1
          AND a.code LIKE '31%'
          AND a.name ILIKE '%input%'
        """,
        user.company_id,
    ) or 0

    net = float(output) - float(input_itc)
    return {
        "output_gst": round(float(output), 2),
        "input_itc": round(float(input_itc), 2),
        "net_payable": round(net, 2),
        "status": "payable" if net > 0 else "refundable",
    }
