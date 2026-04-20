-- ============================================================
-- AI Accounting Software - PostgreSQL Schema v2.0 (UPGRADED)
-- New tables/columns for: AI confidence, reconciliation,
-- audit logs, user corrections, uploaded invoices,
-- suggestion log, and RBAC-ready roles.
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

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
    mode            TEXT DEFAULT 'accountant' CHECK (mode IN ('accountant', 'simple')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    -- Expanded roles: owner > manager > accountant > viewer
    role            TEXT NOT NULL DEFAULT 'accountant'
                    CHECK (role IN ('owner', 'manager', 'accountant', 'viewer')),
    is_active       BOOLEAN DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
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
    nature          TEXT NOT NULL CHECK (nature IN ('asset','liability','equity','income','expense')),
    sequence        INT DEFAULT 0
);

CREATE TABLE accounts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    group_id        UUID REFERENCES account_groups(id),
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    nature          TEXT NOT NULL CHECK (nature IN ('asset','liability','equity','income','expense')),
    account_type    TEXT NOT NULL CHECK (account_type IN (
                        'bank','cash','debtor','creditor',
                        'income','expense','tax','capital','fixed_asset','other'
                    )),
    gstin           TEXT,
    pan             TEXT,
    opening_balance NUMERIC(18,2) DEFAULT 0,
    opening_dr_cr   TEXT DEFAULT 'dr' CHECK (opening_dr_cr IN ('dr','cr')),
    is_system       BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, code)
);

CREATE INDEX idx_accounts_company ON accounts(company_id);
CREATE INDEX idx_accounts_name_trgm ON accounts USING GIN (name gin_trgm_ops);

-- ============================================================
-- VOUCHERS & JOURNAL ENTRIES
-- ============================================================

CREATE TABLE vouchers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    voucher_no      TEXT NOT NULL,
    voucher_type    TEXT NOT NULL CHECK (voucher_type IN (
                        'journal','payment','receipt','contra',
                        'sales','purchase','debit_note','credit_note'
                    )),
    date            DATE NOT NULL,
    narration       TEXT,
    reference       TEXT,
    source          TEXT DEFAULT 'manual' CHECK (source IN (
                        'manual','invoice_webhook','bank_import',
                        'payment_gateway','payroll','ai_suggested','ai_auto'
                    )),
    ai_confidence   NUMERIC(5,4),                   -- NEW: 0.0000-1.0000
    status          TEXT DEFAULT 'posted' CHECK (status IN ('draft','posted','reversed')),
    reversed_by     UUID REFERENCES vouchers(id),
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, voucher_no)
);

CREATE INDEX idx_vouchers_company_date ON vouchers(company_id, date);
CREATE INDEX idx_vouchers_status ON vouchers(status);
CREATE INDEX idx_vouchers_source ON vouchers(source);

CREATE TABLE journal_lines (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voucher_id      UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    account_id      UUID NOT NULL REFERENCES accounts(id),
    dr_amount       NUMERIC(18,2) DEFAULT 0 CHECK (dr_amount >= 0),
    cr_amount       NUMERIC(18,2) DEFAULT 0 CHECK (cr_amount >= 0),
    narration       TEXT,
    sequence        INT DEFAULT 0,
    CHECK ((dr_amount > 0 AND cr_amount = 0) OR (cr_amount > 0 AND dr_amount = 0))
);

CREATE INDEX idx_journal_lines_voucher  ON journal_lines(voucher_id);
CREATE INDEX idx_journal_lines_account  ON journal_lines(account_id);

-- ============================================================
-- IMMUTABLE AUDIT LOG
-- ============================================================

CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    company_id      UUID NOT NULL,
    entity_type     TEXT NOT NULL,           -- 'voucher','account','classification'
    entity_id       TEXT NOT NULL,
    action          TEXT NOT NULL,           -- 'create','edit','reverse','approve','ai_auto_post','user_correction'
    actor_id        UUID,
    before_data     JSONB,
    after_data      JSONB,
    ip_address      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_company ON audit_log(company_id, created_at DESC);

-- ============================================================
-- BANK ACCOUNTS & TRANSACTIONS
-- ============================================================

CREATE TABLE bank_accounts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    account_id      UUID NOT NULL REFERENCES accounts(id),
    bank_name       TEXT NOT NULL,
    account_number  TEXT NOT NULL,
    ifsc            TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bank_transactions (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bank_account_id       UUID NOT NULL REFERENCES bank_accounts(id),
    company_id            UUID,                    -- denormalized for fast queries
    txn_date              DATE NOT NULL,
    amount                NUMERIC(18,2) NOT NULL,
    txn_type              TEXT CHECK (txn_type IN ('debit','credit')),
    narration             TEXT,
    reference             TEXT,
    balance               NUMERIC(18,2),
    -- NEW reconciliation fields
    status                TEXT DEFAULT 'unmatched'
                          CHECK (status IN ('unmatched','matched','review','excluded')),
    matched_voucher_id    UUID REFERENCES vouchers(id),
    ai_match_confidence   NUMERIC(5,4),            -- NEW
    reconciled_at         TIMESTAMPTZ,             -- NEW
    reconciled_by         UUID REFERENCES users(id), -- NEW
    raw_data              TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (bank_account_id, txn_date, amount, narration)
);

CREATE INDEX idx_bank_txn_status    ON bank_transactions(status);
CREATE INDEX idx_bank_txn_date      ON bank_transactions(txn_date);
CREATE INDEX idx_bank_txn_company   ON bank_transactions(company_id);

-- ============================================================
-- AI CLASSIFICATION & LEARNING
-- ============================================================

CREATE TABLE ai_classifications (
    id                    BIGSERIAL PRIMARY KEY,
    company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    narration             TEXT NOT NULL,
    suggested_account_id  UUID REFERENCES accounts(id),
    confirmed_account_id  UUID REFERENCES accounts(id),   -- set by user correction
    corrected_by          UUID REFERENCES users(id),
    corrected_at          TIMESTAMPTZ,
    correction_count      INT DEFAULT 0,                  -- NEW: how many times corrected
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, narration)
);

CREATE INDEX idx_ai_class_company ON ai_classifications(company_id);
CREATE INDEX idx_ai_class_narration ON ai_classifications USING GIN (narration gin_trgm_ops);

-- AI suggestion log (analytics / accuracy tracking)
CREATE TABLE ai_suggestion_log (
    id          BIGSERIAL PRIMARY KEY,
    company_id  UUID NOT NULL,
    account_id  UUID,
    confidence  NUMERIC(5,4),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_log_company ON ai_suggestion_log(company_id, created_at DESC);

-- ============================================================
-- UPLOADED INVOICES
-- ============================================================

CREATE TABLE uploaded_invoices (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_type    TEXT NOT NULL CHECK (invoice_type IN ('sales','purchase')),
    invoice_no      TEXT,
    party_name      TEXT,
    invoice_date    DATE,
    subtotal        NUMERIC(18,2) DEFAULT 0,
    cgst            NUMERIC(18,2) DEFAULT 0,
    sgst            NUMERIC(18,2) DEFAULT 0,
    igst            NUMERIC(18,2) DEFAULT 0,
    total           NUMERIC(18,2) DEFAULT 0,
    linked_voucher_id UUID REFERENCES vouchers(id),
    raw_data        TEXT,
    status          TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending','posted','rejected')),
    uploaded_by     UUID REFERENCES users(id),
    uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ACCOUNT BALANCES (materialized for speed)
-- ============================================================

CREATE TABLE account_balances (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    account_id      UUID NOT NULL REFERENCES accounts(id),
    period          TEXT NOT NULL,                          -- 'YYYY-MM'
    opening_balance NUMERIC(18,2) DEFAULT 0,
    total_dr        NUMERIC(18,2) DEFAULT 0,
    total_cr        NUMERIC(18,2) DEFAULT 0,
    closing_balance NUMERIC(18,2) DEFAULT 0,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, account_id, period)
);

-- ============================================================
-- TRIAL BALANCE VIEW
-- ============================================================

CREATE VIEW trial_balance AS
SELECT
    ab.company_id,
    a.code,
    a.name,
    a.nature,
    a.account_type,
    SUM(ab.opening_balance) AS opening_balance,
    SUM(ab.total_dr)        AS total_dr,
    SUM(ab.total_cr)        AS total_cr,
    SUM(ab.closing_balance) AS closing_balance
FROM account_balances ab
JOIN accounts a ON a.id = ab.account_id
GROUP BY ab.company_id, a.id;

-- ============================================================
-- GST
-- ============================================================

CREATE TABLE gst_transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    voucher_id      UUID REFERENCES vouchers(id),
    invoice_id      TEXT,
    period          TEXT,                                   -- 'YYYY-MM'
    txn_type        TEXT CHECK (txn_type IN ('input','output')),
    party_gstin     TEXT,
    party_name      TEXT,
    place_of_supply TEXT DEFAULT '29',
    supply_type     TEXT DEFAULT 'B2B',
    hsn_sac         TEXT,
    taxable_value   NUMERIC(18,2) DEFAULT 0,
    gst_rate        NUMERIC(5,2) DEFAULT 0,
    cgst            NUMERIC(18,2) DEFAULT 0,
    sgst            NUMERIC(18,2) DEFAULT 0,
    igst            NUMERIC(18,2) DEFAULT 0,
    cess            NUMERIC(18,2) DEFAULT 0,
    invoice_date    DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EMPLOYEES & PAYROLL
-- ============================================================

CREATE TABLE employees (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_code       TEXT NOT NULL,
    name                TEXT NOT NULL,
    pan                 TEXT,
    pf_number           TEXT,
    esic_number         TEXT,
    bank_account        TEXT,
    ifsc                TEXT,
    basic_salary        NUMERIC(18,2) DEFAULT 0,
    hra                 NUMERIC(18,2) DEFAULT 0,
    special_allowance   NUMERIC(18,2) DEFAULT 0,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, employee_code)
);
