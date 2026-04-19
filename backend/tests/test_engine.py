# backend/tests/test_engine.py
from decimal import Decimal
from engine.accounting import JournalLine, VoucherRequest, VoucherType, TxnSource
from datetime import date

def test_journal_line_rejects_both_dr_cr():
    try:
        JournalLine(account_id="acc-1", dr_amount=Decimal("100"), cr_amount=Decimal("100"))
        assert False, "Should have raised"
    except ValueError:
        pass

def test_journal_line_requires_nonzero():
    try:
        JournalLine(account_id="acc-1")
        assert False, "Should have raised"
    except ValueError:
        pass

def test_balanced_voucher_lines():
    lines = [
        JournalLine(account_id="acc-1", dr_amount=Decimal("1000")),
        JournalLine(account_id="acc-2", cr_amount=Decimal("1000")),
    ]
    total_dr = sum(l.dr_amount for l in lines)
    total_cr = sum(l.cr_amount for l in lines)
    assert total_dr == total_cr
