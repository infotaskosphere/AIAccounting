"""
services/transaction_service.py
--------------------------------
Core transaction processing service.
All business logic for vouchers, journal entries, and auto-posting flows through here.
"""

from __future__ import annotations

import asyncio
from datetime import date
from decimal import Decimal
from typing import Optional
import asyncpg
import structlog

from engine.accounting import (
    AccountingEngine, VoucherRequest, VoucherType, TxnSource, JournalLine
)
from services.ai_service import AIService
from services.audit_service import AuditService

log = structlog.get_logger()


class TransactionService:
    """
    Orchestrates the full AI-first accounting pipeline:
    Input → AI Classification → Ledger Mapping → Journal Entry → Reconciliation
    """

    def __init__(self, db: asyncpg.Pool):
        self.db = db
        self.engine = AccountingEngine(db)
        self.ai = AIService(db)
        self.audit = AuditService(db)

    # ── Auto-post a detected transaction ──────────────────────────────────

    async def auto_post_transaction(
        self,
        company_id: str,
        narration: str,
        amount: Decimal,
        txn_date: date,
        txn_type: str,          # 'debit' | 'credit'
        reference: str = "",
        source: str = "bank_import",
        user_id: Optional[str] = None,
    ) -> dict:
        """
        Full pipeline: classify → suggest accounts → create journal entry.
        Returns voucher_id + AI metadata.
        """
        # Step 1: AI classification
        classification = await self.ai.classify_single(company_id, narration)

        # Step 2: Determine debit/credit accounts based on txn type
        if txn_type == "debit":
            # Money OUT: Dr Expense/Payable, Cr Bank
            dr_account_id = classification.account_id
            cr_account_id = await self._get_bank_account_id(company_id)
        else:
            # Money IN: Dr Bank, Cr Income/Receivable
            dr_account_id = await self._get_bank_account_id(company_id)
            cr_account_id = classification.account_id

        # Step 3: Create double-entry journal
        lines = [
            JournalLine(account_id=dr_account_id, dr_amount=amount, cr_amount=Decimal(0), narration=narration),
            JournalLine(account_id=cr_account_id, dr_amount=Decimal(0), cr_amount=amount, narration=narration),
        ]

        req = VoucherRequest(
            company_id=company_id,
            voucher_type=VoucherType.PAYMENT if txn_type == "debit" else VoucherType.RECEIPT,
            date=txn_date,
            narration=narration,
            reference=reference,
            lines=lines,
            source=TxnSource(source),
            ai_confidence=classification.confidence,
        )

        voucher_id = await self.engine.post_voucher(req)

        # Step 4: Audit log
        await self.audit.log(
            company_id=company_id,
            entity_type="voucher",
            entity_id=voucher_id,
            action="ai_auto_post",
            actor_id=user_id,
            after_data={
                "narration": narration,
                "amount": str(amount),
                "classification": classification.account_name,
                "confidence": classification.confidence,
                "method": classification.method,
            }
        )

        return {
            "voucher_id": voucher_id,
            "ai_classification": {
                "account_id": classification.account_id,
                "account_name": classification.account_name,
                "confidence": classification.confidence,
                "method": classification.method,
                "requires_review": classification.requires_review,
            }
        }

    # ── Batch auto-post from bank import ──────────────────────────────────

    async def batch_auto_post(
        self,
        company_id: str,
        bank_account_id: str,
        transactions: list[dict],
        user_id: Optional[str] = None,
    ) -> dict:
        """
        Process a list of bank transactions through the full AI pipeline.
        Creates journal entries for high-confidence results.
        Returns summary with per-transaction results.
        """
        results = []
        auto_posted = 0
        needs_review = 0
        errors = 0

        for txn in transactions:
            try:
                result = await self.auto_post_transaction(
                    company_id=company_id,
                    narration=txn.get("narration", ""),
                    amount=Decimal(str(txn.get("amount", 0))),
                    txn_date=txn.get("txn_date", date.today()),
                    txn_type=txn.get("txn_type", "debit"),
                    reference=txn.get("reference", ""),
                    source="bank_import",
                    user_id=user_id,
                )
                if result["ai_classification"]["requires_review"]:
                    needs_review += 1
                else:
                    auto_posted += 1
                results.append({"status": "posted", **result})
            except Exception as exc:
                errors += 1
                log.error("auto_post_failed", narration=txn.get("narration"), error=str(exc))
                results.append({"status": "error", "error": str(exc), "txn": txn})

        return {
            "total": len(transactions),
            "auto_posted": auto_posted,
            "needs_review": needs_review,
            "errors": errors,
            "results": results,
        }

    # ── Manual correction feedback loop ───────────────────────────────────

    async def record_user_correction(
        self,
        company_id: str,
        narration: str,
        original_account_id: str,
        corrected_account_id: str,
        user_id: str,
    ) -> None:
        """
        Record user correction to retrain the AI classifier.
        Stores in ai_classifications for dynamic retraining.
        """
        async with self.db.acquire() as conn:
            # Upsert learned mapping
            await conn.execute(
                """
                INSERT INTO ai_classifications
                    (company_id, narration, suggested_account_id, confirmed_account_id, corrected_by, corrected_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (company_id, narration)
                DO UPDATE SET
                    confirmed_account_id = $4,
                    corrected_by = $5,
                    corrected_at = NOW(),
                    correction_count = ai_classifications.correction_count + 1
                """,
                company_id, narration, original_account_id, corrected_account_id, user_id
            )

            # Audit
            await self.audit.log(
                company_id=company_id,
                entity_type="ai_classification",
                entity_id=company_id,
                action="user_correction",
                actor_id=user_id,
                after_data={
                    "narration": narration,
                    "original": original_account_id,
                    "corrected": corrected_account_id,
                }
            )

        log.info("user_correction_recorded", narration=narration, corrected_to=corrected_account_id)

    # ── Edit voucher with audit ────────────────────────────────────────────

    async def edit_voucher(
        self,
        voucher_id: str,
        company_id: str,
        updates: dict,
        user_id: str,
    ) -> str:
        """Edit an existing voucher, maintaining full edit history in audit log."""
        async with self.db.acquire() as conn:
            before = await conn.fetchrow(
                "SELECT * FROM vouchers WHERE id=$1 AND company_id=$2",
                voucher_id, company_id
            )
            if not before:
                raise ValueError(f"Voucher {voucher_id} not found")

            if before["status"] == "reversed":
                raise ValueError("Cannot edit a reversed voucher")

            # Update allowed fields
            allowed = {"narration", "reference", "date"}
            safe_updates = {k: v for k, v in updates.items() if k in allowed}

            if safe_updates:
                set_clauses = ", ".join(f"{k}=${i+2}" for i, k in enumerate(safe_updates))
                values = list(safe_updates.values())
                await conn.execute(
                    f"UPDATE vouchers SET {set_clauses}, updated_at=NOW() WHERE id=$1",
                    voucher_id, *values
                )

        await self.audit.log(
            company_id=company_id,
            entity_type="voucher",
            entity_id=voucher_id,
            action="edit",
            actor_id=user_id,
            before_data=dict(before),
            after_data=safe_updates,
        )
        return voucher_id

    # ── Approve draft voucher ─────────────────────────────────────────────

    async def approve_voucher(self, voucher_id: str, company_id: str, user_id: str) -> None:
        async with self.db.acquire() as conn:
            await conn.execute(
                "UPDATE vouchers SET status='posted', updated_at=NOW() WHERE id=$1 AND company_id=$2 AND status='draft'",
                voucher_id, company_id
            )
        await self.audit.log(
            company_id=company_id,
            entity_type="voucher",
            entity_id=voucher_id,
            action="approve",
            actor_id=user_id,
        )

    # ── Helpers ───────────────────────────────────────────────────────────

    async def _get_bank_account_id(self, company_id: str) -> str:
        async with self.db.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id FROM accounts WHERE company_id=$1 AND account_type='bank' AND is_active=TRUE LIMIT 1",
                company_id
            )
            if not row:
                row = await conn.fetchrow(
                    "SELECT id FROM accounts WHERE company_id=$1 AND account_type='cash' AND is_active=TRUE LIMIT 1",
                    company_id
                )
            if not row:
                raise ValueError("No bank/cash account found for company")
            return str(row["id"])
