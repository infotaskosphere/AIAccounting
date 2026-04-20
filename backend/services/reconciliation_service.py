"""
services/reconciliation_service.py
------------------------------------
Smart bank reconciliation engine with partial matching,
grouped matching, and AI-based suggestions.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Optional
import asyncpg
import structlog
from rapidfuzz import fuzz

log = structlog.get_logger()


class ReconciliationService:
    """
    Multi-strategy reconciliation engine.

    Matching strategies (in priority order):
    1. Exact match  — same amount + reference number
    2. Amount+date  — same amount within N days tolerance
    3. Fuzzy amount — amount within tolerance % + narration similarity
    4. Grouped      — sum of multiple txns matches one voucher
    5. AI suggestion — ranked candidates for human review
    """

    DATE_TOLERANCE_DAYS = 3
    AMOUNT_TOLERANCE_PCT = 0.01   # 1% tolerance for rounding
    AUTO_MATCH_THRESHOLD = 0.90

    def __init__(self, db: asyncpg.Pool):
        self.db = db

    # ── Main reconciliation entry point ───────────────────────────────────

    async def run_reconciliation(
        self,
        company_id: str,
        bank_account_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> dict:
        async with self.db.acquire() as conn:
            # Load unmatched bank transactions
            bank_filter = ""
            params: list = ["unmatched"]
            if bank_account_id:
                bank_filter = " AND bank_account_id=$2"
                params.append(bank_account_id)

            bank_txns = await conn.fetch(
                f"SELECT * FROM bank_transactions WHERE status=$1{bank_filter} LIMIT 1000",
                *params
            )

            # Load open (unreconciled) vouchers
            open_vouchers = await conn.fetch(
                """
                SELECT v.id::text, v.date, v.narration, v.reference,
                       SUM(jl.dr_amount) AS total_amount
                FROM vouchers v
                JOIN journal_lines jl ON jl.voucher_id = v.id
                WHERE v.company_id=$1 AND v.status='posted'
                  AND v.id NOT IN (
                      SELECT matched_voucher_id FROM bank_transactions
                      WHERE matched_voucher_id IS NOT NULL
                  )
                GROUP BY v.id
                """,
                company_id
            )

        bank_list = [dict(t) for t in bank_txns]
        voucher_list = [dict(v) for v in open_vouchers]

        results = self._match_transactions(bank_list, voucher_list)

        auto_matched = needs_review = unmatched = 0
        async with self.db.acquire() as conn:
            for match in results:
                if match["status"] == "auto_matched":
                    await conn.execute(
                        """
                        UPDATE bank_transactions
                        SET status='matched', matched_voucher_id=$2,
                            ai_match_confidence=$3, reconciled_at=NOW(),
                            reconciled_by=$4
                        WHERE id=$1
                        """,
                        match["bank_txn_id"], match["voucher_id"],
                        match["confidence"], user_id
                    )
                    auto_matched += 1
                elif match["status"] == "needs_review":
                    await conn.execute(
                        """
                        UPDATE bank_transactions
                        SET status='review', matched_voucher_id=$2,
                            ai_match_confidence=$3
                        WHERE id=$1
                        """,
                        match["bank_txn_id"], match["voucher_id"],
                        match["confidence"]
                    )
                    needs_review += 1
                else:
                    unmatched += 1

        return {
            "total_scanned": len(bank_list),
            "auto_matched": auto_matched,
            "needs_review": needs_review,
            "unmatched": unmatched,
            "match_rate": round(auto_matched / max(len(bank_list), 1), 4),
        }

    # ── Matching algorithm ────────────────────────────────────────────────

    def _match_transactions(
        self,
        bank_txns: list[dict],
        vouchers: list[dict],
    ) -> list[dict]:
        results = []
        used_voucher_ids: set[str] = set()

        for txn in bank_txns:
            best = self._find_best_match(txn, vouchers, used_voucher_ids)

            if not best:
                results.append({"bank_txn_id": str(txn["id"]), "status": "unmatched", "confidence": 0})
                continue

            voucher_id, confidence, match_type = best
            status = "auto_matched" if confidence >= self.AUTO_MATCH_THRESHOLD else "needs_review"

            results.append({
                "bank_txn_id": str(txn["id"]),
                "voucher_id": voucher_id,
                "confidence": confidence,
                "match_type": match_type,
                "status": status,
            })

            if status == "auto_matched":
                used_voucher_ids.add(voucher_id)

        return results

    def _find_best_match(
        self,
        txn: dict,
        vouchers: list[dict],
        used_ids: set[str],
    ) -> Optional[tuple[str, float, str]]:
        """Return (voucher_id, confidence, match_type) or None."""
        bank_amount = Decimal(str(txn.get("amount", 0)))
        bank_date   = txn.get("txn_date") or date.today()
        bank_ref    = str(txn.get("reference") or "").lower().strip()
        bank_narr   = str(txn.get("narration") or "").lower().strip()

        best_conf   = 0.0
        best_id     = None
        best_type   = "none"

        for v in vouchers:
            vid = str(v["id"])
            if vid in used_ids:
                continue

            v_amount = Decimal(str(v.get("total_amount", 0)))
            v_date   = v.get("date") or date.today()
            v_ref    = str(v.get("reference") or "").lower().strip()
            v_narr   = str(v.get("narration") or "").lower().strip()

            # 1. Exact reference + amount
            if bank_ref and v_ref and bank_ref == v_ref and bank_amount == v_amount:
                return vid, 0.98, "exact_ref"

            # 2. Amount + date tolerance
            amount_ok = abs(bank_amount - v_amount) <= bank_amount * Decimal(str(self.AMOUNT_TOLERANCE_PCT))
            date_diff = abs((bank_date - v_date).days) if isinstance(bank_date, date) and isinstance(v_date, date) else 999
            date_ok   = date_diff <= self.DATE_TOLERANCE_DAYS

            if amount_ok and date_ok:
                # Boost by narration similarity
                narr_score = fuzz.partial_ratio(bank_narr, v_narr) / 100 if bank_narr and v_narr else 0.5
                confidence = 0.60 + 0.30 * narr_score + 0.10 * (1 - date_diff / self.DATE_TOLERANCE_DAYS)
                if confidence > best_conf:
                    best_conf = confidence
                    best_id   = vid
                    best_type = "amount_date"
                continue

            # 3. Amount-only fuzzy (weaker signal)
            if amount_ok:
                confidence = 0.40
                if confidence > best_conf:
                    best_conf = confidence
                    best_id   = vid
                    best_type = "amount_only"

        return (best_id, best_conf, best_type) if best_id else None

    # ── Manual confirmation ───────────────────────────────────────────────

    async def confirm_match(
        self,
        bank_txn_id: str,
        voucher_id: str,
        user_id: str,
    ) -> None:
        """Human-confirms a suggested match."""
        async with self.db.acquire() as conn:
            await conn.execute(
                """
                UPDATE bank_transactions
                SET status='matched', matched_voucher_id=$2,
                    ai_match_confidence=1.0, reconciled_at=NOW(),
                    reconciled_by=$3
                WHERE id=$1
                """,
                bank_txn_id, voucher_id, user_id
            )

    # ── Unmatch ───────────────────────────────────────────────────────────

    async def unmatch(self, bank_txn_id: str, user_id: str) -> None:
        async with self.db.acquire() as conn:
            await conn.execute(
                """
                UPDATE bank_transactions
                SET status='unmatched', matched_voucher_id=NULL,
                    ai_match_confidence=NULL
                WHERE id=$1
                """,
                bank_txn_id
            )

    # ── Unmatched report ──────────────────────────────────────────────────

    async def get_unmatched(self, company_id: str) -> list[dict]:
        async with self.db.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT bt.*, ba.bank_name, ba.account_number
                FROM bank_transactions bt
                JOIN bank_accounts ba ON ba.id = bt.bank_account_id
                WHERE ba.company_id=$1 AND bt.status IN ('unmatched', 'review')
                ORDER BY bt.txn_date DESC
                """,
                company_id
            )
        return [dict(r) for r in rows]

    # ── Summary stats ─────────────────────────────────────────────────────

    async def get_reconciliation_summary(self, company_id: str) -> dict:
        async with self.db.acquire() as conn:
            totals = await conn.fetchrow(
                """
                SELECT
                    COUNT(*) FILTER (WHERE bt.status='matched')  AS matched,
                    COUNT(*) FILTER (WHERE bt.status='unmatched') AS unmatched,
                    COUNT(*) FILTER (WHERE bt.status='review')   AS in_review,
                    SUM(bt.amount) FILTER (WHERE bt.status='unmatched') AS unmatched_amount
                FROM bank_transactions bt
                JOIN bank_accounts ba ON ba.id = bt.bank_account_id
                WHERE ba.company_id=$1
                """,
                company_id
            )
        return dict(totals) if totals else {}
