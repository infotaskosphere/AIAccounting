"""
services/reporting_service.py
-------------------------------
One-click intelligent reporting: P&L, Cash Flow, Receivables/Payables.
Generates AI summaries explaining financial performance in plain language.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Optional
import asyncpg
import structlog
import anthropic
import os

log = structlog.get_logger()


class ReportingService:
    """
    Generates financial reports instantly and explains them in plain language.
    """

    def __init__(self, db: asyncpg.Pool):
        self.db = db
        self._anthropic = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

    # ── Profit & Loss ─────────────────────────────────────────────────────

    async def get_profit_and_loss(
        self,
        company_id: str,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ) -> dict:
        if not from_date:
            today = date.today()
            from_date = date(today.year, today.month, 1)  # month start
        if not to_date:
            to_date = date.today()

        async with self.db.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT a.name, a.nature, a.account_type,
                       SUM(jl.cr_amount - jl.dr_amount) AS net_amount
                FROM journal_lines jl
                JOIN accounts a ON a.id = jl.account_id
                JOIN vouchers v ON v.id = jl.voucher_id
                WHERE v.company_id=$1 AND v.date BETWEEN $2 AND $3
                  AND v.status='posted'
                  AND a.nature IN ('income', 'expense')
                GROUP BY a.id
                ORDER BY a.nature, a.name
                """,
                company_id, from_date, to_date
            )

        income_items = []
        expense_items = []
        total_income = Decimal(0)
        total_expense = Decimal(0)

        for row in rows:
            amount = abs(Decimal(str(row["net_amount"] or 0)))
            if row["nature"] == "income":
                income_items.append({"name": row["name"], "amount": float(amount)})
                total_income += amount
            else:
                expense_items.append({"name": row["name"], "amount": float(amount)})
                total_expense += amount

        net_profit = total_income - total_expense

        return {
            "period": {"from": str(from_date), "to": str(to_date)},
            "income": {
                "items": sorted(income_items, key=lambda x: -x["amount"]),
                "total": float(total_income),
            },
            "expenses": {
                "items": sorted(expense_items, key=lambda x: -x["amount"]),
                "total": float(total_expense),
            },
            "net_profit": float(net_profit),
            "profit_margin": round(float(net_profit / max(total_income, Decimal(1))) * 100, 2),
        }

    # ── Cash Flow ─────────────────────────────────────────────────────────

    async def get_cash_flow(
        self,
        company_id: str,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ) -> dict:
        if not from_date:
            today = date.today()
            from_date = date(today.year, today.month, 1)
        if not to_date:
            to_date = date.today()

        async with self.db.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT v.date, v.voucher_type, v.narration,
                       SUM(jl.dr_amount) FILTER (WHERE a.account_type IN ('bank','cash')) AS cash_in,
                       SUM(jl.cr_amount) FILTER (WHERE a.account_type IN ('bank','cash')) AS cash_out
                FROM journal_lines jl
                JOIN accounts a ON a.id = jl.account_id
                JOIN vouchers v ON v.id = jl.voucher_id
                WHERE v.company_id=$1 AND v.date BETWEEN $2 AND $3
                  AND v.status='posted'
                GROUP BY v.id
                ORDER BY v.date
                """,
                company_id, from_date, to_date
            )

        daily: dict[str, dict] = {}
        total_in = Decimal(0)
        total_out = Decimal(0)

        for row in rows:
            d = str(row["date"])
            cash_in  = Decimal(str(row["cash_in"]  or 0))
            cash_out = Decimal(str(row["cash_out"] or 0))
            if d not in daily:
                daily[d] = {"date": d, "cash_in": 0.0, "cash_out": 0.0, "net": 0.0}
            daily[d]["cash_in"]  += float(cash_in)
            daily[d]["cash_out"] += float(cash_out)
            daily[d]["net"]       = daily[d]["cash_in"] - daily[d]["cash_out"]
            total_in  += cash_in
            total_out += cash_out

        return {
            "period": {"from": str(from_date), "to": str(to_date)},
            "daily": sorted(daily.values(), key=lambda x: x["date"]),
            "total_inflow":  float(total_in),
            "total_outflow": float(total_out),
            "net_cash_flow": float(total_in - total_out),
        }

    # ── Receivables & Payables ────────────────────────────────────────────

    async def get_aging_report(self, company_id: str, report_type: str = "receivable") -> dict:
        """
        Aging report: 0-30, 31-60, 61-90, 90+ days.
        report_type: 'receivable' | 'payable'
        """
        account_type = "debtor" if report_type == "receivable" else "creditor"
        today = date.today()

        async with self.db.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT a.name AS party_name,
                       v.date AS txn_date,
                       v.reference,
                       SUM(CASE WHEN jl.dr_amount > 0 THEN jl.dr_amount ELSE -jl.cr_amount END) AS balance
                FROM journal_lines jl
                JOIN accounts a ON a.id = jl.account_id
                JOIN vouchers v ON v.id = jl.voucher_id
                WHERE v.company_id=$1 AND v.status='posted'
                  AND a.account_type=$2
                GROUP BY a.id, v.id
                HAVING ABS(SUM(CASE WHEN jl.dr_amount > 0 THEN jl.dr_amount ELSE -jl.cr_amount END)) > 0.01
                ORDER BY v.date
                """,
                company_id, account_type
            )

        buckets = {"0_30": [], "31_60": [], "61_90": [], "90_plus": []}
        totals  = {"0_30": 0.0, "31_60": 0.0, "61_90": 0.0, "90_plus": 0.0}

        for row in rows:
            days_old = (today - row["txn_date"]).days
            balance  = float(abs(row["balance"] or 0))
            item = {
                "party": row["party_name"],
                "reference": row["reference"],
                "date": str(row["txn_date"]),
                "days": days_old,
                "amount": balance,
            }
            if days_old <= 30:
                buckets["0_30"].append(item); totals["0_30"] += balance
            elif days_old <= 60:
                buckets["31_60"].append(item); totals["31_60"] += balance
            elif days_old <= 90:
                buckets["61_90"].append(item); totals["61_90"] += balance
            else:
                buckets["90_plus"].append(item); totals["90_plus"] += balance

        grand_total = sum(totals.values())
        return {
            "type": report_type,
            "as_of": str(today),
            "buckets": buckets,
            "totals": totals,
            "grand_total": grand_total,
        }

    # ── Expense breakdown ─────────────────────────────────────────────────

    async def get_expense_breakdown(
        self,
        company_id: str,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ) -> list[dict]:
        if not from_date:
            today = date.today()
            from_date = date(today.year, today.month, 1)
        if not to_date:
            to_date = date.today()

        async with self.db.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT a.name, SUM(jl.dr_amount) AS total_expense
                FROM journal_lines jl
                JOIN accounts a ON a.id = jl.account_id
                JOIN vouchers v ON v.id = jl.voucher_id
                WHERE v.company_id=$1 AND v.date BETWEEN $2 AND $3
                  AND v.status='posted' AND a.nature='expense'
                GROUP BY a.id
                ORDER BY total_expense DESC
                """,
                company_id, from_date, to_date
            )

        total = sum(row["total_expense"] or 0 for row in rows)
        return [
            {
                "category": row["name"],
                "amount": float(row["total_expense"] or 0),
                "percentage": round(float(row["total_expense"] or 0) / max(float(total), 1) * 100, 2),
            }
            for row in rows
        ]

    # ── AI Summary ────────────────────────────────────────────────────────

    async def generate_ai_summary(
        self,
        company_id: str,
        report_data: dict,
        report_type: str = "pnl",
        language: str = "simple",
    ) -> str:
        """
        Generate an AI plain-language explanation of financial data.
        language: 'simple' (layman) | 'accountant'
        """
        try:
            if language == "simple":
                instruction = (
                    "You are a friendly financial advisor. Explain these financial results to a "
                    "business owner with no accounting knowledge. Use simple language, no jargon. "
                    "Focus on: Is the business doing well? What should they watch out for? "
                    "Keep it under 150 words. Start with a one-line verdict."
                )
            else:
                instruction = (
                    "You are a senior accountant. Provide a professional analysis of these "
                    "financial statements. Highlight key ratios, trends, and risks. "
                    "Be concise and precise. Under 200 words."
                )

            prompt = f"""
{instruction}

Report Type: {report_type.upper()}
Data: {report_data}

Provide analysis:"""

            response = self._anthropic.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=300,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text.strip()

        except Exception as exc:
            log.warning("ai_summary_failed", error=str(exc))
            # Fallback: rule-based summary
            if report_type == "pnl":
                profit = report_data.get("net_profit", 0)
                margin = report_data.get("profit_margin", 0)
                if profit > 0:
                    return f"Your business made a profit of ₹{profit:,.2f} ({margin:.1f}% margin). Revenue is exceeding expenses — good performance."
                else:
                    return f"Your business had a loss of ₹{abs(profit):,.2f}. Expenses exceeded revenue. Review your top expense categories."
            return "Financial data loaded successfully."

    # ── Dashboard summary ─────────────────────────────────────────────────

    async def get_dashboard_summary(self, company_id: str) -> dict:
        """Comprehensive dashboard data in a single call."""
        today = date.today()
        month_start = date(today.year, today.month, 1)

        pnl     = await self.get_profit_and_loss(company_id, month_start, today)
        cashflow= await self.get_cash_flow(company_id, month_start, today)
        recv    = await self.get_aging_report(company_id, "receivable")
        payable = await self.get_aging_report(company_id, "payable")

        # Quick balances
        async with self.db.acquire() as conn:
            bank_balance = await conn.fetchval(
                """
                SELECT COALESCE(SUM(ab.closing_balance), 0)
                FROM account_balances ab
                JOIN accounts a ON a.id = ab.account_id
                WHERE ab.company_id=$1 AND a.account_type IN ('bank','cash')
                """,
                company_id
            ) or 0

        return {
            "period": {"from": str(month_start), "to": str(today)},
            "cash_balance":       float(bank_balance),
            "monthly_revenue":    pnl["income"]["total"],
            "monthly_expenses":   pnl["expenses"]["total"],
            "net_profit":         pnl["net_profit"],
            "profit_margin":      pnl["profit_margin"],
            "net_cash_flow":      cashflow["net_cash_flow"],
            "total_receivable":   recv["grand_total"],
            "total_payable":      payable["grand_total"],
            "overdue_receivable": recv["totals"]["90_plus"],
        }
