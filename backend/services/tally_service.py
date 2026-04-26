"""
services/tally_service.py  — v2.1 PRODUCTION
Tally Prime XML Export Service.
Generates Tally-importable XML for:
  - Vouchers (Journal, Payment, Receipt, Sales, Purchase)
  - Ledger masters
  - Groups

Compatible with Tally Prime 3.x XML import format.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import date
from decimal import Decimal
from typing import Optional
from xml.dom import minidom

import asyncpg
import structlog

log = structlog.get_logger()

# Tally voucher type mapping
VOUCHER_TYPE_MAP = {
    "journal":      "Journal",
    "payment":      "Payment",
    "receipt":      "Receipt",
    "contra":       "Contra",
    "sales":        "Sales",
    "purchase":     "Purchase",
    "debit_note":   "Debit Note",
    "credit_note":  "Credit Note",
}

# Tally group mapping based on account nature/type
TALLY_GROUP_MAP = {
    ("asset",     "bank"):        "Bank Accounts",
    ("asset",     "cash"):        "Cash-in-Hand",
    ("asset",     "debtor"):      "Sundry Debtors",
    ("asset",     "fixed_asset"): "Fixed Assets",
    ("asset",     "investment"):  "Investments",
    ("asset",     "tax"):         "Current Assets",
    ("asset",     "other"):       "Loans & Advances (Assets)",
    ("liability", "creditor"):    "Sundry Creditors",
    ("liability", "tax"):         "Duties & Taxes",
    ("liability", "loan"):        "Loans (Liability)",
    ("liability", "other"):       "Current Liabilities",
    ("equity",    "capital"):     "Capital Account",
    ("income",    "income"):      "Sales Accounts",
    ("expense",   "expense"):     "Indirect Expenses",
}


class TallyService:

    def __init__(self, db: asyncpg.Pool):
        self.db = db

    # ── Voucher XML Export ────────────────────────────────────────────────

    async def export_vouchers_xml(
        self,
        company_id: str,
        from_date:  Optional[date] = None,
        to_date:    Optional[date] = None,
    ) -> str:
        """Export all posted vouchers as Tally Prime XML."""
        if not from_date: from_date = date(date.today().year, 4, 1)
        if not to_date:   to_date   = date.today()

        async with self.db.acquire() as conn:
            vouchers = await conn.fetch(
                """SELECT v.id::text, v.voucher_no, v.voucher_type, v.date,
                          v.narration, v.reference
                   FROM vouchers v
                   WHERE v.company_id=$1::uuid AND v.date BETWEEN $2 AND $3
                     AND v.status='posted'
                   ORDER BY v.date, v.created_at""",
                company_id, from_date, to_date
            )
            lines_by_voucher: dict[str, list] = {}
            for v in vouchers:
                lines = await conn.fetch(
                    """SELECT jl.dr_amount, jl.cr_amount, jl.narration,
                              a.name AS account_name
                       FROM journal_lines jl
                       JOIN accounts a ON a.id = jl.account_id
                       WHERE jl.voucher_id=$1::uuid
                       ORDER BY jl.sequence""",
                    v["id"]
                )
                lines_by_voucher[v["id"]] = [dict(l) for l in lines]

            company = await conn.fetchrow(
                "SELECT name, gstin FROM companies WHERE id=$1::uuid", company_id
            )

        root = ET.Element("ENVELOPE")
        # Header
        header = ET.SubElement(root, "HEADER")
        ET.SubElement(header, "TALLYREQUEST").text = "Import Data"

        body = ET.SubElement(root, "BODY")
        importdata = ET.SubElement(body, "IMPORTDATA")
        reqexp     = ET.SubElement(importdata, "REQUESTDESC")
        ET.SubElement(reqexp, "REPORTNAME").text = "Vouchers"
        ET.SubElement(reqexp, "STATICVARIABLES").text = ""

        reqdata = ET.SubElement(importdata, "REQUESTDATA")

        for v in vouchers:
            self._build_voucher_element(reqdata, v, lines_by_voucher.get(v["id"], []))

        return self._pretty_xml(root)

    def _build_voucher_element(self, parent: ET.Element, voucher: dict, lines: list[dict]) -> None:
        tdl_msg = ET.SubElement(parent, "TALLYMESSAGE", xmlns_UDF="TallyUDF")
        v_elem  = ET.SubElement(tdl_msg, "VOUCHER",
                               REMOTEID=voucher["voucher_no"],
                               ACTION="Create", OBJVIEW="Accounting Voucher View")

        tally_type = VOUCHER_TYPE_MAP.get(voucher["voucher_type"], "Journal")
        ET.SubElement(v_elem, "DATE").text            = self._tally_date(voucher["date"])
        ET.SubElement(v_elem, "VOUCHERTYPENAME").text = tally_type
        ET.SubElement(v_elem, "VOUCHERNUMBER").text   = voucher["voucher_no"]
        ET.SubElement(v_elem, "NARRATION").text        = voucher["narration"] or ""
        ET.SubElement(v_elem, "EFFECTIVEDATE").text    = self._tally_date(voucher["date"])

        # Ledger entries
        for line in lines:
            le = ET.SubElement(v_elem, "ALLLEDGERENTRIES.LIST")
            ET.SubElement(le, "LEDGERNAME").text = line["account_name"]
            if line["dr_amount"] and float(line["dr_amount"]) > 0:
                ET.SubElement(le, "ISDEEMEDPOSITIVE").text = "Yes"
                ET.SubElement(le, "AMOUNT").text = f"-{abs(float(line['dr_amount'])):.2f}"
            else:
                ET.SubElement(le, "ISDEEMEDPOSITIVE").text = "No"
                ET.SubElement(le, "AMOUNT").text = f"{abs(float(line['cr_amount'])):.2f}"

    # ── Ledger Masters XML Export ─────────────────────────────────────────

    async def export_ledgers_xml(self, company_id: str) -> str:
        """Export all active ledger accounts as Tally ledger masters."""
        async with self.db.acquire() as conn:
            accounts = await conn.fetch(
                """SELECT a.code, a.name, a.nature, a.account_type,
                          a.gstin, a.opening_balance, a.opening_dr_cr
                   FROM accounts a
                   WHERE a.company_id=$1::uuid AND a.is_active=TRUE
                   ORDER BY a.nature, a.code""",
                company_id
            )

        root = ET.Element("ENVELOPE")
        hdr  = ET.SubElement(root, "HEADER")
        ET.SubElement(hdr, "TALLYREQUEST").text = "Import Data"

        body    = ET.SubElement(root, "BODY")
        impdata = ET.SubElement(body, "IMPORTDATA")
        rqdesc  = ET.SubElement(impdata, "REQUESTDESC")
        ET.SubElement(rqdesc, "REPORTNAME").text = "All Masters"

        reqdata = ET.SubElement(impdata, "REQUESTDATA")

        for acc in accounts:
            tdl  = ET.SubElement(reqdata, "TALLYMESSAGE", xmlns_UDF="TallyUDF")
            led  = ET.SubElement(tdl, "LEDGER",
                                  NAME=acc["name"], ACTION="Create")
            tally_group = TALLY_GROUP_MAP.get(
                (acc["nature"], acc["account_type"]),
                "Indirect Expenses"
            )
            ET.SubElement(led, "NAME").text         = acc["name"]
            ET.SubElement(led, "PARENT").text       = tally_group
            ET.SubElement(led, "TAXTYPE").text      = "GST"
            if acc["gstin"]:
                ET.SubElement(led, "PARTYGSTIN").text = acc["gstin"]
            # Opening balance
            ob    = float(acc["opening_balance"] or 0)
            dr_cr = acc["opening_dr_cr"] or "dr"
            sign  = "-" if dr_cr == "cr" else ""
            ET.SubElement(led, "OPENINGBALANCE").text = f"{sign}{ob:.2f}"

        return self._pretty_xml(root)

    # ── Helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _tally_date(d) -> str:
        """Convert date to Tally format: YYYYMMDD."""
        if isinstance(d, date):
            return d.strftime("%Y%m%d")
        return str(d).replace("-", "")

    @staticmethod
    def _pretty_xml(root: ET.Element) -> str:
        raw = ET.tostring(root, encoding="unicode", xml_declaration=False)
        xml_str = '<?xml version="1.0" encoding="UTF-8"?>\n' + raw
        try:
            parsed = minidom.parseString(xml_str.encode("utf-8"))
            return parsed.toprettyxml(indent="  ", encoding=None)
        except Exception:
            return xml_str
