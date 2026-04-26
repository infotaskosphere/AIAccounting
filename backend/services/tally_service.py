"""
services/tally_service.py
Exports vouchers and ledgers as Tally Prime-compatible XML.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import date
from typing import Optional


class TallyService:
    def __init__(self, db):
        self.db = db

    # ── helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _tally_date(d) -> str:
        """Format date as YYYYMMDD for Tally."""
        if isinstance(d, str):
            d = date.fromisoformat(d)
        return d.strftime("%Y%m%d")

    @staticmethod
    def _amount(v) -> str:
        return f"{float(v or 0):.2f}"

    # ── voucher export ────────────────────────────────────────────────────────

    async def export_vouchers_xml(
        self,
        company_id: str,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ) -> str:
        """Return Tally Prime XML string for all posted vouchers in range."""
        fd = from_date or date(date.today().year, 4, 1)
        to = to_date   or date.today()

        async with self.db.acquire() as conn:
            vouchers = await conn.fetch(
                """
                SELECT v.id::text, v.voucher_no, v.voucher_type, v.date,
                       v.narration, v.reference
                FROM vouchers v
                WHERE v.company_id=$1::uuid
                  AND v.status='posted'
                  AND v.date BETWEEN $2 AND $3
                ORDER BY v.date, v.voucher_no
                """,
                company_id, fd, to,
            )

            lines_map: dict[str, list] = {}
            if vouchers:
                ids = [v["id"] for v in vouchers]
                placeholders = ",".join(f"${i+1}::uuid" for i in range(len(ids)))
                lines = await conn.fetch(
                    f"""
                    SELECT jl.voucher_id::text, jl.dr_amount, jl.cr_amount,
                           jl.narration, a.name AS account_name
                    FROM journal_lines jl
                    JOIN accounts a ON a.id = jl.account_id
                    WHERE jl.voucher_id IN ({placeholders})
                    ORDER BY jl.sequence
                    """,
                    *ids,
                )
                for l in lines:
                    lines_map.setdefault(l["voucher_id"], []).append(dict(l))

        # Build XML
        envelope = ET.Element("ENVELOPE")
        header   = ET.SubElement(envelope, "HEADER")
        ET.SubElement(header, "TALLYREQUEST").text = "Import Data"

        body    = ET.SubElement(envelope, "BODY")
        imp_data = ET.SubElement(body, "IMPORTDATA")
        req_desc = ET.SubElement(imp_data, "REQUESTDESC")
        ET.SubElement(req_desc, "REPORTNAME").text = "Vouchers"
        req_data = ET.SubElement(imp_data, "REQUESTDATA")

        for v in vouchers:
            vid = v["id"]
            msg = ET.SubElement(req_data, "TALLYMESSAGE", attrib={"xmlns:UDF": "TallyUDF"})
            voucher = ET.SubElement(
                msg, "VOUCHER",
                attrib={
                    "VCHTYPE":   v["voucher_type"].title(),
                    "ACTION":    "Create",
                    "OBJVIEW":   "Accounting Voucher View",
                },
            )
            ET.SubElement(voucher, "DATE").text          = self._tally_date(v["date"])
            ET.SubElement(voucher, "VOUCHERNUMBER").text = v["voucher_no"] or ""
            ET.SubElement(voucher, "NARRATION").text     = v["narration"] or ""
            ET.SubElement(voucher, "VOUCHERTYPENAME").text = v["voucher_type"].title()

            for l in lines_map.get(vid, []):
                le = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
                ET.SubElement(le, "LEDGERNAME").text  = l["account_name"]
                is_debit = float(l["dr_amount"] or 0) > 0
                ET.SubElement(le, "ISDEEMEDPOSITIVE").text = "Yes" if is_debit else "No"
                amount = float(l["dr_amount"] or 0) if is_debit else float(l["cr_amount"] or 0)
                ET.SubElement(le, "AMOUNT").text = f"-{amount:.2f}" if is_debit else f"{amount:.2f}"

        return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(envelope, encoding="unicode")

    # ── ledger export ─────────────────────────────────────────────────────────

    async def export_ledgers_xml(self, company_id: str) -> str:
        """Return Tally Prime XML string for chart of accounts (ledger masters)."""
        async with self.db.acquire() as conn:
            accounts = await conn.fetch(
                """
                SELECT a.code, a.name, a.nature, a.account_type,
                       COALESCE(ab.closing_balance, a.opening_balance, 0) AS balance
                FROM accounts a
                LEFT JOIN account_balances ab ON ab.account_id = a.id
                WHERE a.company_id=$1::uuid AND a.is_active=TRUE
                ORDER BY a.nature, a.code
                """,
                company_id,
            )

        NATURE_GROUP = {
            "asset":     "Current Assets",
            "liability": "Current Liabilities",
            "equity":    "Capital Account",
            "income":    "Direct Incomes",
            "expense":   "Direct Expenses",
        }

        envelope = ET.Element("ENVELOPE")
        header   = ET.SubElement(envelope, "HEADER")
        ET.SubElement(header, "TALLYREQUEST").text = "Import Data"
        body     = ET.SubElement(envelope, "BODY")
        imp_data = ET.SubElement(body, "IMPORTDATA")
        req_desc = ET.SubElement(imp_data, "REQUESTDESC")
        ET.SubElement(req_desc, "REPORTNAME").text = "All Masters"
        req_data = ET.SubElement(imp_data, "REQUESTDATA")

        for acc in accounts:
            msg    = ET.SubElement(req_data, "TALLYMESSAGE", attrib={"xmlns:UDF": "TallyUDF"})
            ledger = ET.SubElement(msg, "LEDGER", attrib={"NAME": acc["name"], "ACTION": "Create"})
            ET.SubElement(ledger, "NAME").text       = acc["name"]
            ET.SubElement(ledger, "PARENT").text     = NATURE_GROUP.get(acc["nature"], "Suspense A/c")
            ET.SubElement(ledger, "OPENINGBALANCE").text = self._amount(acc["balance"])

        return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(envelope, encoding="unicode")
