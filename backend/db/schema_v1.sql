-- ============================================================
-- AI Accounting Software - PostgreSQL Schema
-- Phase 1: Foundation
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fuzzy matching in reconciliation

-- ============================================================
-- TENANCY
-- ============================================================

CREATE TABLE companies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    gstin           TEXT,
    pan             TEXT,
    address         TEXT,
    financial_year  TEXT DEFAULT '2024-25',
    currency        TEXT DEFAULT 'INR',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'accountant' CHECK (role IN ('owner', 'accountant', 'viewer')),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CHART OF ACCOUNTS
-- ============================================================

CREATE TABLE account_groups (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    parent_id       UUID REFERENCES account_groups(id),
    nature          TEXT NOT NULL CHECK (nature IN ('asset', 'liability', 'equity', 'income', 'expense')),
    sequence        INT DEFAULT 0
);

CREATE TABLE accounts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    group_id        UUID REFERENCES account_groups(id),
    code            TEXT NOT NULL,                          -- e.g. "1001"
    name            TEXT NOT NULL,                          -- e.g. "Cash in Hand"
    nature          TEXT NOT NULL CHECK (nature IN ('asset', 'liability', 'equity', 'income', 'expense')),
    account_type    TEXT NOT NULL CHECK (account_type IN (
                        'bank', 'cash', 'debtor', 'creditor',
                        'income', 'expense', 'tax', 'capital', 'fixed_asset', 'other'
                    )),
    gstin           TEXT,                                   -- for party accounts
    pan             TEXT,
    opening_balance NUMERIC(18,2) DEFAULT 0,
    opening_dr_cr   TEXT DEFAULT 'dr' CHECK (opening_dr_cr IN ('dr', 'cr')),
    is_system       BOOLEAN DEFAULT FALSE,                  -- seeded accounts, cannot delete
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, code)
);

CREATE INDEX idx_accounts_company ON accounts(company_id);
CREATE INDEX idx_accounts_name_trgm ON accounts USING GIN (name gin_trgm_ops);

-- ============================================================
-- VOUCHERS & JOURNAL ENTRIES (Double-Entry Core)
-- ============================================================

CREATE TABLE vouchers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    voucher_no      TEXT NOT NULL,                          -- e.g. "JV-2024-0001"
    voucher_type    TEXT NOT NULL CHECK (voucher_type IN (
                        'journal', 'payment', 'receipt', 'contra',
                        'sales', 'purchase', 'debit_note', 'credit_note'
                    )),
    date            DATE NOT NULL,
    narration       TEXT,
    reference       TEXT,                                   -- invoice no, cheque no, etc.
    source          TEXT DEFAULT 'manual' CHECK (source IN (
                        'manual', 'invoice_webhook', 'bank_import',
                        'payment_gateway', 'payroll', 'ai_suggested'
                    )),
    ai_confidence   NUMERIC(5,4),                          -- 0.0000 to 1.0000
    status          TEXT DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'reversed')),
    reversed_by     UUID REFERENCES vouchers(id),
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, voucher_no)
);

CREATE INDEX idx_vouchers_company_date ON vouchers(company_id, date);
CREATE INDEX idx_vouchers_status ON vouchers(status);

-- The actual ledger lines (always balanced: sum(dr) = sum(cr))
CREATE TABLE journal_lines (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voucher_id      UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    account_id      UUID NOT NULL REFERENCES accounts(id),
    dr_amount       NUMERIC(18,2) DEFAULT 0 CHECK (dr_amount >= 0),
    cr_amount       NUMERIC(18,2) DEFAULT 0 CHECK (cr_amount >= 0),
    narration       TEXT,
    sequence        INT DEFAULT 0,
    CHECK (
        (dr_amount > 0 AND cr_amount = 0) OR
        (cr_amount > 0 AND dr_amount = 0)
    )
);

CREATE INDEX idx_journal_lines_voucher ON journal_lines(voucher_id);
CREATE INDEX idx_journal_lines_account ON journal_lines(account_id);

-- Immutable audit log (append-only, never update/delete)
CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    company_id      UUID NOT NULL,
    entity_type     TEXT NOT NULL,                          -- 'voucher', 'account', etc.
    entity_id       UUID NOT NULL,
    action          TEXT NOT NULL,                          -- 'create', 'reverse', 'ai_post'
    actor_id        UUID,
    before_data     JSONB,
    after_data      JSONB,
    ip_address      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- ============================================================
-- BANK STATEMENTS & RECONCILIATION
-- ============================================================

CREATE TABLE bank_accounts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    account_id      UUID NOT NULL REFERENCES accounts(id),  -- linked ledger account
    bank_name       TEXT NOT NULL,
    account_number  TEXT NOT NULL,
    ifsc            TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bank_transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    txn_date        DATE NOT NULL,
    value_date      DATE,
    amount          NUMERIC(18,2) NOT NULL,
    txn_type        TEXT NOT NULL CHECK (txn_type IN ('credit', 'debit')),
    narration       TEXT,
    reference       TEXT,
    balance         NUMERIC(18,2),
    -- Reconciliation state
    status          TEXT DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'matched', 'manually_matched', 'ignored')),
    matched_voucher_id UUID REFERENCES vouchers(id),
    ai_match_confidence NUMERIC(5,4),
    ai_suggested_account_id UUID REFERENCES accounts(id),
    ai_suggested_confidence NUMERIC(5,4),
    -- Import tracking
    import_batch_id UUID,
    raw_data        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bank_txn_status ON bank_transactions(status);
CREATE INDEX idx_bank_txn_date ON bank_transactions(txn_date);
CREATE INDEX idx_bank_txn_narration_trgm ON bank_transactions USING GIN (narration gin_trgm_ops);

-- ============================================================
-- INVOICES (linked from external systems)
-- ============================================================

CREATE TABLE invoices (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_no      TEXT NOT NULL,
    invoice_type    TEXT NOT NULL CHECK (invoice_type IN ('sales', 'purchase')),
    party_id        UUID REFERENCES accounts(id),
    party_name      TEXT,
    invoice_date    DATE NOT NULL,
    due_date        DATE,
    subtotal        NUMERIC(18,2) DEFAULT 0,
    cgst            NUMERIC(18,2) DEFAULT 0,
    sgst            NUMERIC(18,2) DEFAULT 0,
    igst            NUMERIC(18,2) DEFAULT 0,
    total           NUMERIC(18,2) DEFAULT 0,
    status          TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'cancelled')),
    voucher_id      UUID REFERENCES vouchers(id),           -- auto-created journal entry
    external_id     TEXT,                                   -- ID from external invoice software
    raw_payload     JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GST
-- ============================================================

CREATE TABLE gst_transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    voucher_id      UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    invoice_id      UUID REFERENCES invoices(id),
    txn_type        TEXT NOT NULL CHECK (txn_type IN ('output', 'input')),
    party_gstin     TEXT,
    party_name      TEXT,
    place_of_supply TEXT,
    supply_type     TEXT CHECK (supply_type IN ('B2B', 'B2C', 'export', 'nil_rated', 'exempt')),
    hsn_sac         TEXT,
    taxable_value   NUMERIC(18,2) DEFAULT 0,
    gst_rate        NUMERIC(5,2) DEFAULT 0,
    cgst            NUMERIC(18,2) DEFAULT 0,
    sgst            NUMERIC(18,2) DEFAULT 0,
    igst            NUMERIC(18,2) DEFAULT 0,
    cess            NUMERIC(18,2) DEFAULT 0,
    period          TEXT NOT NULL,                          -- e.g. '2024-03' (YYYY-MM)
    return_type     TEXT,                                   -- 'GSTR1', 'GSTR3B'
    filed           BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PAYROLL
-- ============================================================

CREATE TABLE employees (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_code   TEXT NOT NULL,
    name            TEXT NOT NULL,
    pan             TEXT,
    pf_number       TEXT,
    esic_number     TEXT,
    bank_account    TEXT,
    ifsc            TEXT,
    basic_salary    NUMERIC(18,2) DEFAULT 0,
    hra             NUMERIC(18,2) DEFAULT 0,
    special_allowance NUMERIC(18,2) DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payroll_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    period          TEXT NOT NULL,                          -- 'YYYY-MM'
    total_gross     NUMERIC(18,2) DEFAULT 0,
    total_tds       NUMERIC(18,2) DEFAULT 0,
    total_pf        NUMERIC(18,2) DEFAULT 0,
    total_esic      NUMERIC(18,2) DEFAULT 0,
    total_net       NUMERIC(18,2) DEFAULT 0,
    voucher_id      UUID REFERENCES vouchers(id),
    status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AI LEARNING
-- ============================================================

CREATE TABLE ai_classifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    narration       TEXT NOT NULL,
    narration_embedding VECTOR(384),                        -- if using pgvector
    suggested_account_id UUID REFERENCES accounts(id),
    confirmed_account_id UUID REFERENCES accounts(id),
    confidence      NUMERIC(5,4),
    was_correct     BOOLEAN,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_class_company ON ai_classifications(company_id);

-- ============================================================
-- VIEWS
-- ============================================================

-- Real-time account balances
CREATE VIEW account_balances AS
SELECT
    a.id AS account_id,
    a.company_id,
    a.code,
    a.name,
    a.nature,
    a.account_type,
    COALESCE(SUM(jl.dr_amount), 0) AS total_dr,
    COALESCE(SUM(jl.cr_amount), 0) AS total_cr,
    CASE
        WHEN a.nature IN ('asset', 'expense')
        THEN a.opening_balance + COALESCE(SUM(jl.dr_amount), 0) - COALESCE(SUM(jl.cr_amount), 0)
        ELSE a.opening_balance + COALESCE(SUM(jl.cr_amount), 0) - COALESCE(SUM(jl.dr_amount), 0)
    END AS closing_balance
FROM accounts a
LEFT JOIN journal_lines jl ON jl.account_id = a.id
LEFT JOIN vouchers v ON v.id = jl.voucher_id AND v.status = 'posted'
GROUP BY a.id;

-- Trial balance
CREATE VIEW trial_balance AS
SELECT
    ag.name AS group_name,
    a.code,
    a.name AS account_name,
    a.nature,
    ab.total_dr,
    ab.total_cr,
    ab.closing_balance
FROM account_balances ab
JOIN accounts a ON a.id = ab.account_id
LEFT JOIN account_groups ag ON ag.id = a.group_id
ORDER BY a.nature, a.code;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-increment voucher numbers per company per type
CREATE OR REPLACE FUNCTION next_voucher_no(p_company_id UUID, p_type TEXT)
RETURNS TEXT AS $$
DECLARE
    v_count INT;
    v_prefix TEXT;
BEGIN
    v_prefix := CASE p_type
        WHEN 'journal'    THEN 'JV'
        WHEN 'payment'    THEN 'PV'
        WHEN 'receipt'    THEN 'RV'
        WHEN 'sales'      THEN 'SI'
        WHEN 'purchase'   THEN 'PI'
        ELSE 'VR'
    END;

    SELECT COUNT(*) + 1 INTO v_count
    FROM vouchers
    WHERE company_id = p_company_id AND voucher_type = p_type;

    RETURN v_prefix || '-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Validate that a voucher is balanced (sum dr = sum cr)
CREATE OR REPLACE FUNCTION validate_voucher_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_dr NUMERIC;
    v_cr NUMERIC;
BEGIN
    SELECT COALESCE(SUM(dr_amount), 0), COALESCE(SUM(cr_amount), 0)
    INTO v_dr, v_cr
    FROM journal_lines
    WHERE voucher_id = NEW.voucher_id;

    IF v_dr <> v_cr THEN
        RAISE EXCEPTION 'Voucher is unbalanced: Dr=% Cr=%', v_dr, v_cr;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_voucher_balance
AFTER INSERT OR UPDATE ON journal_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_voucher_balance();

-- Updated_at auto-update
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vouchers_updated_at BEFORE UPDATE ON vouchers
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
