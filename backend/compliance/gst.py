"""
compliance/gst.py
-----------------
Phase 4: GST Compliance Engine

Generates GSTR-1 and GSTR-3B JSON in the format required for filing.
Also includes Payroll processor (TDS, PF, ESIC).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional


# ── GST Rate Config ───────────────────────────────────────────────────────────

GST_RATES = [0, 3, 5, 12, 18, 28]         # Valid GST rates in India

PF_EMPLOYEE_RATE   = Decimal("0.12")       # 12% of Basic
PF_EMPLOYER_RATE   = Decimal("0.12")
ESIC_EMPLOYEE_RATE = Decimal("0.0075")     # 0.75% of Gross
ESIC_EMPLOYER_RATE = Decimal("0.0325")     # 3.25% of Gross
ESIC_WAGE_LIMIT    = Decimal("21000")      # ESIC not applicable above ₹21,000/month


# ── Data Classes ──────────────────────────────────────────────────────────────

@dataclass
class GSTTransaction:
    party_gstin:    Optional[str]
    party_name:     str
    invoice_no:     str
    invoice_date:   date
    place_of_supply: str                   # 2-digit state code, e.g. "29" for Karnataka
    supply_type:    str                    # B2B, B2C, export, nil_rated, exempt
    hsn_sac:        Optional[str]
    taxable_value:  Decimal
    gst_rate:       Decimal
    cgst:           Decimal
    sgst:           Decimal
    igst:           Decimal
    cess:           Decimal = Decimal("0")
    is_reverse_charge: bool = False


@dataclass
class GSTR1:
    """GSTR-1 return data structure."""
    gstin:      str
    fp:         str                        # Filing period: "032024" (MMYYYY)
    b2b:        list[dict] = field(default_factory=list)
    b2cs:       list[dict] = field(default_factory=list)    # B2C Small
    b2cl:       list[dict] = field(default_factory=list)    # B2C Large (>2.5L)
    exp:        list[dict] = field(default_factory=list)    # Exports
    nil:        list[dict] = field(default_factory=list)    # Nil/exempt
    hsn:        list[dict] = field(default_factory=list)    # HSN summary


@dataclass
class GSTR3B:
    """GSTR-3B return data structure (summary return)."""
    gstin:           str
    fp:              str
    # 3.1 Outward supplies
    out_txval:       Decimal = Decimal("0")
    out_iamt:        Decimal = Decimal("0")
    out_camt:        Decimal = Decimal("0")
    out_samt:        Decimal = Decimal("0")
    out_csamt:       Decimal = Decimal("0")
    # 4 Eligible ITC
    itc_igst:        Decimal = Decimal("0")
    itc_cgst:        Decimal = Decimal("0")
    itc_sgst:        Decimal = Decimal("0")
    # 6.1 Tax payable
    tax_igst:        Decimal = Decimal("0")
    tax_cgst:        Decimal = Decimal("0")
    tax_sgst:        Decimal = Decimal("0")


@dataclass
class PayrollLine:
    employee_id:       str
    employee_name:     str
    basic:             Decimal
    hra:               Decimal
    special_allowance: Decimal
    gross:             Decimal = Decimal("0")
    pf_employee:       Decimal = Decimal("0")
    pf_employer:       Decimal = Decimal("0")
    esic_employee:     Decimal = Decimal("0")
    esic_employer:     Decimal = Decimal("0")
    tds:               Decimal = Decimal("0")
    net_payable:       Decimal = Decimal("0")

    def compute(self) -> None:
        self.gross = self.basic + self.hra + self.special_allowance

        # PF (on basic only, capped at ₹15,000 for statutory)
        pf_basis = min(self.basic, Decimal("15000"))
        self.pf_employee = (pf_basis * PF_EMPLOYEE_RATE).quantize(Decimal("1"),
                                                                    rounding=ROUND_HALF_UP)
        self.pf_employer = (pf_basis * PF_EMPLOYER_RATE).quantize(Decimal("1"),
                                                                    rounding=ROUND_HALF_UP)

        # ESIC (on gross, only if gross ≤ ₹21,000)
        if self.gross <= ESIC_WAGE_LIMIT:
            self.esic_employee = (self.gross * ESIC_EMPLOYEE_RATE).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP)
            self.esic_employer = (self.gross * ESIC_EMPLOYER_RATE).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP)

        # Simple TDS estimation (actual TDS requires annual projection + slabs)
        self.tds = self._estimate_tds(self.gross)

        self.net_payable = (self.gross
                            - self.pf_employee
                            - self.esic_employee
                            - self.tds)

    def _estimate_tds(self, monthly_gross: Decimal) -> Decimal:
        """
        Simplified monthly TDS estimate.
        For production, use the full tax slab computation with annual projection.
        """
        annual = monthly_gross * 12
        std_deduction = Decimal("50000")
        taxable = max(annual - std_deduction, Decimal("0"))

        # FY 2024-25 new tax regime slabs
        tax = Decimal("0")
        slabs = [
            (Decimal("300000"),  Decimal("0")),
            (Decimal("300000"),  Decimal("0.05")),
            (Decimal("300000"),  Decimal("0.10")),
            (Decimal("300000"),  Decimal("0.15")),
            (Decimal("300000"),  Decimal("0.20")),
            (Decimal("300000"),  Decimal("0.25")),
            (None,               Decimal("0.30")),
        ]
        remaining = taxable
        for limit, rate in slabs:
            if remaining <= 0:
                break
            chunk = min(remaining, limit) if limit else remaining
            tax += (chunk * rate).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            remaining -= chunk

        # Health & Education Cess 4%
        tax = (tax * Decimal("1.04")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        return (tax / 12).quantize(Decimal("1"), rounding=ROUND_HALF_UP)


# ── GST Engine ────────────────────────────────────────────────────────────────

class GSTEngine:
    """
    Generate GSTR-1 and GSTR-3B JSON from transaction data.
    Output format matches the GSTN API schema.
    """

    B2C_LARGE_THRESHOLD = Decimal("250000")  # ₹2.5L threshold for B2CL

    def generate_gstr1(self, gstin: str, period: str,
                        transactions: list[GSTTransaction]) -> dict:
        """
        Build GSTR-1 JSON.

        period: "032024" → March 2024 (MMYYYY format)
        Returns a dict that can be serialized to JSON and filed via GST API.
        """
        gstr1 = GSTR1(gstin=gstin, fp=period)

        # Group B2B by party GSTIN
        b2b_map: dict[str, list] = {}
        b2cs_map: dict[str, dict] = {}   # by (pos, rate) key
        b2cl_list: list[dict] = []
        exp_list:  list[dict] = []
        nil_list:  list[dict] = []
        hsn_map:   dict[str, dict] = {}

        for txn in transactions:
            # HSN summary
            if txn.hsn_sac:
                self._update_hsn(hsn_map, txn)

            if txn.supply_type == "export":
                exp_list.append(self._build_exp_entry(txn))

            elif txn.supply_type in ("nil_rated", "exempt"):
                nil_list.append(self._build_nil_entry(txn))

            elif txn.party_gstin:
                # B2B
                gstin_key = txn.party_gstin
                if gstin_key not in b2b_map:
                    b2b_map[gstin_key] = []
                b2b_map[gstin_key].append(self._build_b2b_invoice(txn))

            else:
                # B2C - split by amount threshold
                if txn.taxable_value > self.B2C_LARGE_THRESHOLD:
                    b2cl_list.append(self._build_b2cl_entry(txn))
                else:
                    key = f"{txn.place_of_supply}_{txn.gst_rate}"
                    if key not in b2cs_map:
                        b2cs_map[key] = {
                            "sply_ty": "INTRA" if txn.cgst > 0 else "INTER",
                            "pos":  txn.place_of_supply,
                            "typ":  "OE",
                            "iamt": Decimal("0"),
                            "camt": Decimal("0"),
                            "samt": Decimal("0"),
                            "txval": Decimal("0"),
                        }
                    b2cs_map[key]["txval"] += txn.taxable_value
                    b2cs_map[key]["iamt"]  += txn.igst
                    b2cs_map[key]["camt"]  += txn.cgst
                    b2cs_map[key]["samt"]  += txn.sgst

        # Build b2b list
        for gstin_key, invoices in b2b_map.items():
            gstr1.b2b.append({
                "ctin": gstin_key,
                "inv": invoices
            })

        gstr1.b2cs = [
            {**v, "txval": str(v["txval"]), "iamt": str(v["iamt"]),
             "camt": str(v["camt"]), "samt": str(v["samt"])}
            for v in b2cs_map.values()
        ]
        gstr1.b2cl = b2cl_list
        gstr1.exp  = exp_list
        gstr1.nil  = nil_list
        gstr1.hsn  = list(hsn_map.values())

        return self._serialise(asdict(gstr1))

    def generate_gstr3b(self, gstin: str, period: str,
                         output_txns: list[GSTTransaction],
                         input_txns: list[GSTTransaction]) -> dict:
        """
        Build GSTR-3B JSON (summary return filed monthly).
        """
        gstr3b = GSTR3B(gstin=gstin, fp=period)

        for txn in output_txns:
            gstr3b.out_txval += txn.taxable_value
            gstr3b.out_iamt  += txn.igst
            gstr3b.out_camt  += txn.cgst
            gstr3b.out_samt  += txn.sgst
            gstr3b.out_csamt += txn.cess

        for txn in input_txns:
            gstr3b.itc_igst += txn.igst
            gstr3b.itc_cgst += txn.cgst
            gstr3b.itc_sgst += txn.sgst

        # Net tax payable = output tax - ITC
        gstr3b.tax_igst = max(gstr3b.out_iamt - gstr3b.itc_igst, Decimal("0"))
        gstr3b.tax_cgst = max(gstr3b.out_camt - gstr3b.itc_cgst, Decimal("0"))
        gstr3b.tax_sgst = max(gstr3b.out_samt - gstr3b.itc_sgst, Decimal("0"))

        return {
            "gstin": gstin,
            "ret_period": period,
            "sup_details": {
                "osup_det": {
                    "txval": str(gstr3b.out_txval.quantize(Decimal("0.01"))),
                    "iamt":  str(gstr3b.out_iamt.quantize(Decimal("0.01"))),
                    "camt":  str(gstr3b.out_camt.quantize(Decimal("0.01"))),
                    "samt":  str(gstr3b.out_samt.quantize(Decimal("0.01"))),
                    "csamt": str(gstr3b.out_csamt.quantize(Decimal("0.01"))),
                }
            },
            "itc_elg": {
                "itc_avl": [
                    {"ty": "IGST", "iamt": str(gstr3b.itc_igst.quantize(Decimal("0.01")))},
                    {"ty": "CGST", "camt": str(gstr3b.itc_cgst.quantize(Decimal("0.01")))},
                    {"ty": "SGST", "samt": str(gstr3b.itc_sgst.quantize(Decimal("0.01")))},
                ]
            },
            "intr_ltfee": {
                "intr_details": {
                    "igst": {"intr": "0.00"},
                    "cgst": {"intr": "0.00"},
                    "sgst": {"intr": "0.00"},
                }
            }
        }

    def _build_b2b_invoice(self, txn: GSTTransaction) -> dict:
        return {
            "inum":  txn.invoice_no,
            "idt":   txn.invoice_date.strftime("%d-%m-%Y"),
            "val":   str((txn.taxable_value + txn.cgst + txn.sgst + txn.igst).quantize(Decimal("0.01"))),
            "pos":   txn.place_of_supply,
            "rchrg": "Y" if txn.is_reverse_charge else "N",
            "itms": [{
                "num": 1,
                "itm_det": {
                    "txval": str(txn.taxable_value.quantize(Decimal("0.01"))),
                    "rt":    str(txn.gst_rate),
                    "iamt":  str(txn.igst.quantize(Decimal("0.01"))),
                    "camt":  str(txn.cgst.quantize(Decimal("0.01"))),
                    "samt":  str(txn.sgst.quantize(Decimal("0.01"))),
                    "csamt": str(txn.cess.quantize(Decimal("0.01"))),
                }
            }]
        }

    def _build_b2cl_entry(self, txn: GSTTransaction) -> dict:
        return {
            "pos":  txn.place_of_supply,
            "inv": [{
                "inum": txn.invoice_no,
                "idt":  txn.invoice_date.strftime("%d-%m-%Y"),
                "val":  str((txn.taxable_value + txn.igst).quantize(Decimal("0.01"))),
                "itms": [{
                    "num": 1,
                    "itm_det": {
                        "txval": str(txn.taxable_value.quantize(Decimal("0.01"))),
                        "rt":    str(txn.gst_rate),
                        "iamt":  str(txn.igst.quantize(Decimal("0.01"))),
                        "csamt": str(txn.cess.quantize(Decimal("0.01"))),
                    }
                }]
            }]
        }

    def _build_exp_entry(self, txn: GSTTransaction) -> dict:
        return {
            "exp_typ": "WOPAY",  # Without payment (LUT/bond)
            "inv": [{
                "inum":  txn.invoice_no,
                "idt":   txn.invoice_date.strftime("%d-%m-%Y"),
                "val":   str(txn.taxable_value.quantize(Decimal("0.01"))),
                "sbpcode": "",
                "sbnum":   "",
                "sbdt":    "",
                "itms": [{
                    "txval": str(txn.taxable_value.quantize(Decimal("0.01"))),
                    "rt":    "0",
                    "iamt":  "0.00",
                    "csamt": "0.00",
                }]
            }]
        }

    def _build_nil_entry(self, txn: GSTTransaction) -> dict:
        return {
            "sply_ty": "INTRB2B" if txn.party_gstin else "INTRB2C",
            "nil_amt":  str(txn.taxable_value.quantize(Decimal("0.01"))),
            "expt_amt": "0.00",
            "ngsup_amt": "0.00",
        }

    def _update_hsn(self, hsn_map: dict, txn: GSTTransaction) -> None:
        key = txn.hsn_sac or ""
        if key not in hsn_map:
            hsn_map[key] = {
                "hsn_sc": key,
                "uqc":    "NOS",
                "qty":    "1",
                "txval":  Decimal("0"),
                "iamt":   Decimal("0"),
                "camt":   Decimal("0"),
                "samt":   Decimal("0"),
                "csamt":  Decimal("0"),
            }
        hsn_map[key]["txval"] += txn.taxable_value
        hsn_map[key]["iamt"]  += txn.igst
        hsn_map[key]["camt"]  += txn.cgst
        hsn_map[key]["samt"]  += txn.sgst
        hsn_map[key]["csamt"] += txn.cess

    def _serialise(self, obj):
        """Recursively convert Decimal to str for JSON serialization."""
        if isinstance(obj, dict):
            return {k: self._serialise(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [self._serialise(i) for i in obj]
        if isinstance(obj, Decimal):
            return str(obj.quantize(Decimal("0.01")))
        return obj


# ── Payroll Processor ─────────────────────────────────────────────────────────

class PayrollProcessor:
    """
    Compute payroll for all employees in a period.
    Generates payroll lines + summary for journal entry creation.
    """

    def process(self, employees: list[dict], period: str) -> dict:
        """
        Process payroll for a list of employee records.

        employees: [{"id", "name", "basic_salary", "hra", "special_allowance"}]
        period: "YYYY-MM"

        Returns:
            {
              "period": "2024-03",
              "lines": [PayrollLine],
              "totals": { gross, pf_employee, pf_employer, esic_employee,
                          esic_employer, tds, net_payable, total_cost_to_company }
            }
        """
        lines: list[PayrollLine] = []

        for emp in employees:
            line = PayrollLine(
                employee_id=str(emp["id"]),
                employee_name=emp["name"],
                basic=Decimal(str(emp.get("basic_salary", 0))),
                hra=Decimal(str(emp.get("hra", 0))),
                special_allowance=Decimal(str(emp.get("special_allowance", 0))),
            )
            line.compute()
            lines.append(line)

        totals = {
            "gross":           sum(l.gross           for l in lines),
            "pf_employee":     sum(l.pf_employee     for l in lines),
            "pf_employer":     sum(l.pf_employer     for l in lines),
            "esic_employee":   sum(l.esic_employee   for l in lines),
            "esic_employer":   sum(l.esic_employer   for l in lines),
            "tds":             sum(l.tds             for l in lines),
            "net_payable":     sum(l.net_payable     for l in lines),
        }
        totals["total_cost_to_company"] = (
            totals["gross"] + totals["pf_employer"] + totals["esic_employer"]
        )

        return {"period": period, "lines": lines, "totals": totals}

    def to_journal_lines(self, payroll: dict) -> list[dict]:
        """
        Convert payroll result to journal line specs for the accounting engine.

        Dr  Salaries & Wages       (gross)
        Dr  PF Employer            (employer PF)
        Dr  ESIC Employer          (employer ESIC)
        Cr  Salary Payable         (net payable)
        Cr  PF Payable             (employee PF + employer PF)
        Cr  ESIC Payable           (employee ESIC + employer ESIC)
        Cr  TDS Payable            (TDS)
        """
        t = payroll["totals"]
        lines = []

        # Debit side
        lines.append({"account_code": "8001", "dr": t["gross"],          "cr": Decimal("0"), "narration": "Gross salaries"})
        lines.append({"account_code": "8001", "dr": t["pf_employer"],    "cr": Decimal("0"), "narration": "Employer PF contribution"})
        lines.append({"account_code": "8001", "dr": t["esic_employer"],  "cr": Decimal("0"), "narration": "Employer ESIC contribution"})

        # Credit side
        lines.append({"account_code": "3300", "dr": Decimal("0"), "cr": t["net_payable"],   "narration": "Net salary payable"})
        lines.append({"account_code": "3201", "dr": Decimal("0"), "cr": t["pf_employee"] + t["pf_employer"], "narration": "PF payable"})
        lines.append({"account_code": "3202", "dr": Decimal("0"), "cr": t["esic_employee"] + t["esic_employer"], "narration": "ESIC payable"})
        lines.append({"account_code": "3200", "dr": Decimal("0"), "cr": t["tds"],           "narration": "TDS payable"})

        return lines

    def generate_payslip(self, line: PayrollLine, period: str) -> dict:
        """Generate a payslip dict for a single employee."""
        return {
            "employee_id":   line.employee_id,
            "employee_name": line.employee_name,
            "period":        period,
            "earnings": {
                "Basic Salary":       str(line.basic),
                "HRA":                str(line.hra),
                "Special Allowance":  str(line.special_allowance),
                "Gross":              str(line.gross),
            },
            "deductions": {
                "PF (Employee 12%)":  str(line.pf_employee),
                "ESIC (Employee 0.75%)": str(line.esic_employee),
                "TDS":                str(line.tds),
                "Total Deductions":   str(line.pf_employee + line.esic_employee + line.tds),
            },
            "net_payable":   str(line.net_payable),
            "employer_cost": str(line.gross + line.pf_employer + line.esic_employer),
        }


# ── Usage Example ─────────────────────────────────────────────────────────────
#
# from compliance.gst import GSTEngine, GSTTransaction, PayrollProcessor
# from decimal import Decimal
#
# engine = GSTEngine()
#
# txns = [
#     GSTTransaction(
#         party_gstin="29ABCDE1234F1Z5",
#         party_name="ABC Tech Pvt Ltd",
#         invoice_no="SI-2024-0001",
#         invoice_date=date(2024, 3, 15),
#         place_of_supply="29",
#         supply_type="B2B",
#         hsn_sac="998314",
#         taxable_value=Decimal("100000"),
#         gst_rate=Decimal("18"),
#         cgst=Decimal("9000"),
#         sgst=Decimal("9000"),
#         igst=Decimal("0"),
#     )
# ]
#
# gstr1_json = engine.generate_gstr1("27XXXXX1234X1ZX", "032024", txns)
# print(json.dumps(gstr1_json, indent=2))
