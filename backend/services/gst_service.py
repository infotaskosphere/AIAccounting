"""
services/gst_service.py  — v2.1 PRODUCTION
GST Service Layer:
  - Detect GST transactions from narration + amount
  - Auto-split with state code awareness
  - GSTR-2B mock matching
  - GSTR-3B generation from DB
"""

from __future__ import annotations

import re
from decimal import Decimal
from typing import Optional

import asyncpg

from compliance.gst import GSTEngine, GSTSplit


class GSTService:

    def __init__(self):
        self.engine = GSTEngine()

    def detect_and_split(
        self,
        narration: str,
        amount: float,
        company_state_code: str = "24",
        party_state_code: str = "24",
    ) -> dict:
        """
        Detect if a transaction has GST and return the split.
        Heuristic: if narration contains GST keywords or amount contains typical GST patterns.
        """
        narr = narration.lower()
        total = Decimal(str(amount))
        is_gst_txn = any(k in narr for k in ["gst", "cgst", "sgst", "igst", "gstin", "tax invoice"])
        is_interstate = company_state_code != party_state_code

        # Try to detect GST rate from narration
        detected_rate = self._detect_rate(narration, amount)

        if not is_gst_txn and not detected_rate:
            return {
                "is_gst_transaction": False,
                "total_amount": float(total),
                "taxable_value": float(total),
                "gst_rate": 0,
                "cgst": 0, "sgst": 0, "igst": 0, "total_gst": 0,
                "is_interstate": is_interstate,
            }

        rate   = detected_rate or Decimal("18")  # default 18%
        split  = self.engine.split_gst_amount(total, rate, is_interstate=is_interstate,
                                               from_state=company_state_code,
                                               to_state=party_state_code)
        return {
            "is_gst_transaction": True,
            "total_amount":  float(split.total_amount),
            "taxable_value": float(split.taxable_value),
            "gst_rate":      float(split.gst_rate),
            "cgst":          float(split.cgst),
            "sgst":          float(split.sgst),
            "igst":          float(split.igst),
            "total_gst":     float(split.total_gst),
            "is_interstate": split.is_interstate,
        }

    def _detect_rate(self, narration: str, amount: float) -> Optional[Decimal]:
        """Detect GST rate from narration patterns."""
        # Try explicit rate in narration: "18% GST" or "@18"
        patterns = [r"@\s*(\d+(?:\.\d+)?)\s*%", r"(\d+(?:\.\d+)?)\s*%\s*gst", r"gst\s*@\s*(\d+)"]
        for pat in patterns:
            m = re.search(pat, narration.lower())
            if m:
                rate = Decimal(m.group(1))
                valid_rates = [Decimal(str(r)) for r in [0, 5, 12, 18, 28]]
                if rate in valid_rates:
                    return rate

        # Try to guess from round-amount patterns
        # e.g., 1180 = 1000 + 18% → detectable
        for rate in [5, 12, 18, 28]:
            r = Decimal(str(rate))
            factor = 1 + r / 100
            taxable = Decimal(str(amount)) / factor
            if taxable == taxable.quantize(Decimal("1")):  # taxable is a whole number
                return r
        return None

    async def generate_gstr3b(self, db: asyncpg.Pool, company_id: str, period: str) -> dict:
        """Generate GSTR-3B from database transactions."""
        from compliance.gst import GSTTransaction
        async with db.acquire() as conn:
            company = await conn.fetchrow(
                "SELECT gstin FROM companies WHERE id=$1::uuid", company_id
            )
            output_txns = await conn.fetch(
                "SELECT * FROM gst_transactions WHERE company_id=$1::uuid AND period=$2 AND txn_type='output'",
                company_id, period
            )
            input_txns = await conn.fetch(
                "SELECT * FROM gst_transactions WHERE company_id=$1::uuid AND period=$2 AND txn_type='input'",
                company_id, period
            )

        def _to_gst_txn(row) -> GSTTransaction:
            from datetime import date
            return GSTTransaction(
                party_gstin=row["party_gstin"],
                party_name=row["party_name"] or "",
                invoice_no=row["invoice_id"] or "",
                invoice_date=date.today(),
                place_of_supply=row["place_of_supply"] or "24",
                supply_type=row["supply_type"] or "B2B",
                hsn_sac=row["hsn_sac"],
                taxable_value=Decimal(str(row["taxable_value"])),
                gst_rate=Decimal(str(row["gst_rate"])),
                cgst=Decimal(str(row["cgst"])),
                sgst=Decimal(str(row["sgst"])),
                igst=Decimal(str(row["igst"])),
            )

        gstr3b = self.engine.generate_gstr3b(
            gstin=company["gstin"] if company else "",
            period=period,
            output_txns=[_to_gst_txn(t) for t in output_txns],
            input_txns=[_to_gst_txn(t) for t in input_txns],
        )
        return gstr3b
