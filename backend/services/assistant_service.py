"""
services/assistant_service.py
------------------------------
Conversational accounting assistant.
Translates natural language queries into structured answers.
e.g. "What is my profit this month?" → calls ReportingService → formats response.
"""

from __future__ import annotations

import anthropic
import asyncpg
import os
import json
import structlog
from datetime import date
from typing import Optional

log = structlog.get_logger()


SYSTEM_PROMPT = """You are FINIX Assistant, an intelligent accounting helper.
You help business owners understand their finances in plain, simple language.

You have access to these data tools (respond ONLY with JSON when calling them):
- get_profit_and_loss: {"tool": "get_profit_and_loss", "params": {"period": "this_month"|"last_month"|"this_year"}}
- get_cash_flow: {"tool": "get_cash_flow", "params": {"period": "this_month"|"last_month"}}
- get_pending_receivables: {"tool": "get_pending_receivables", "params": {}}
- get_pending_payables: {"tool": "get_pending_payables", "params": {}}
- get_gst_liability: {"tool": "get_gst_liability", "params": {"period": "this_month"}}
- get_expense_breakdown: {"tool": "get_expense_breakdown", "params": {"period": "this_month"}}
- get_bank_balance: {"tool": "get_bank_balance", "params": {}}

Rules:
1. If the user asks a financial question, FIRST respond with a JSON tool call.
2. After getting data, respond in SIMPLE PLAIN LANGUAGE (no accounting jargon).
3. Always give a number-first answer: "Your profit this month is ₹45,230."
4. If asked a non-financial question, answer conversationally.
5. Keep responses under 100 words unless detailed breakdown is requested.
6. Use ₹ symbol for Indian Rupees.
7. Be warm, encouraging, and easy to understand.

Never say "I cannot access real-time data" - you DO have real-time access through tools.
"""


class AssistantService:
    """
    Stateless conversational assistant.
    Each call takes a message + conversation history and returns a response.
    """

    def __init__(self, db: asyncpg.Pool):
        self.db = db
        self._client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

    async def chat(
        self,
        company_id: str,
        message: str,
        history: list[dict] | None = None,
        user_id: Optional[str] = None,
    ) -> dict:
        """
        Process a user message and return assistant response + any data.
        Returns: {response: str, data: dict|None, tool_used: str|None}
        """
        history = history or []
        messages = history + [{"role": "user", "content": message}]

        try:
            # Step 1: Ask Claude what to do
            response = self._client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=500,
                system=SYSTEM_PROMPT,
                messages=messages,
            )
            raw = response.content[0].text.strip()

            # Step 2: Check if Claude wants to call a tool
            tool_data = None
            tool_name = None

            if raw.startswith("{") and '"tool"' in raw:
                try:
                    tool_call = json.loads(raw)
                    tool_name = tool_call.get("tool")
                    params = tool_call.get("params", {})
                    tool_data = await self._execute_tool(company_id, tool_name, params)

                    # Step 3: Send tool result back to Claude for natural response
                    follow_up_messages = messages + [
                        {"role": "assistant", "content": raw},
                        {"role": "user", "content": f"Tool result: {json.dumps(tool_data)}\n\nNow respond to the user in simple plain language."}
                    ]
                    final_response = self._client.messages.create(
                        model="claude-sonnet-4-20250514",
                        max_tokens=400,
                        system=SYSTEM_PROMPT,
                        messages=follow_up_messages,
                    )
                    raw = final_response.content[0].text.strip()
                except json.JSONDecodeError:
                    pass

            return {
                "response": raw,
                "data": tool_data,
                "tool_used": tool_name,
            }

        except Exception as exc:
            log.error("assistant_error", error=str(exc))
            return {
                "response": "I encountered an issue. Please try rephrasing your question.",
                "data": None,
                "tool_used": None,
            }

    async def _execute_tool(self, company_id: str, tool: str, params: dict) -> dict:
        """Execute the requested financial data tool."""
        from services.reporting_service import ReportingService

        reporting = ReportingService(self.db)
        today = date.today()

        # Period helpers
        period = params.get("period", "this_month")
        if period == "this_month":
            from_date = date(today.year, today.month, 1)
            to_date = today
        elif period == "last_month":
            first_this = date(today.year, today.month, 1)
            from datetime import timedelta
            last_month_end = first_this - timedelta(days=1)
            from_date = date(last_month_end.year, last_month_end.month, 1)
            to_date = last_month_end
        elif period == "this_year":
            from_date = date(today.year, 1, 1)
            to_date = today
        else:
            from_date = date(today.year, today.month, 1)
            to_date = today

        if tool == "get_profit_and_loss":
            data = await reporting.get_profit_and_loss(company_id, from_date, to_date)
            return {
                "revenue": data["income"]["total"],
                "expenses": data["expenses"]["total"],
                "net_profit": data["net_profit"],
                "profit_margin_pct": data["profit_margin"],
                "period": data["period"],
            }

        elif tool == "get_cash_flow":
            data = await reporting.get_cash_flow(company_id, from_date, to_date)
            return {
                "total_inflow": data["total_inflow"],
                "total_outflow": data["total_outflow"],
                "net_cash_flow": data["net_cash_flow"],
                "period": data["period"],
            }

        elif tool == "get_pending_receivables":
            data = await reporting.get_aging_report(company_id, "receivable")
            return {
                "total_pending": data["grand_total"],
                "overdue_90_plus": data["totals"]["90_plus"],
                "due_0_30_days": data["totals"]["0_30"],
            }

        elif tool == "get_pending_payables":
            data = await reporting.get_aging_report(company_id, "payable")
            return {
                "total_payable": data["grand_total"],
                "overdue_90_plus": data["totals"]["90_plus"],
            }

        elif tool == "get_expense_breakdown":
            items = await reporting.get_expense_breakdown(company_id, from_date, to_date)
            top5 = items[:5]
            return {
                "top_expenses": top5,
                "period": {"from": str(from_date), "to": str(to_date)},
            }

        elif tool == "get_bank_balance":
            async with self.db.acquire() as conn:
                balance = await conn.fetchval(
                    """
                    SELECT COALESCE(SUM(ab.closing_balance), 0)
                    FROM account_balances ab
                    JOIN accounts a ON a.id = ab.account_id
                    WHERE ab.company_id=$1 AND a.account_type IN ('bank','cash')
                    """,
                    company_id
                ) or 0
            return {"bank_balance": float(balance)}

        elif tool == "get_gst_liability":
            async with self.db.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT COALESCE(SUM(cgst + sgst + igst), 0) AS total_gst
                    FROM gst_transactions
                    WHERE company_id=$1 AND txn_type='output'
                      AND DATE_TRUNC('month', invoice_date) = DATE_TRUNC('month', CURRENT_DATE)
                    """,
                    company_id
                )
            return {"gst_liability": float(row["total_gst"] if row else 0)}

        return {"error": f"Unknown tool: {tool}"}


# ── Suggested quick questions ──────────────────────────────────────────────────

QUICK_QUESTIONS = [
    "What is my profit this month?",
    "What is my current bank balance?",
    "How much GST do I owe?",
    "Show me pending payments to receive",
    "What are my top expenses?",
    "How much do I owe to suppliers?",
    "How is my cash flow this month?",
    "Give me a summary of my business performance",
]
