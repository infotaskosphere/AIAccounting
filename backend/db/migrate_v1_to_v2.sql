-- ============================================================
-- Migration: v1 → v2 (upgrade existing database)
-- Run this ONCE on your existing database.
-- Safe to run multiple times (uses IF NOT EXISTS / DO NOTHING).
-- ============================================================

-- 1. Expand user roles (owner, manager, accountant, viewer)
DO $$ BEGIN
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('owner', 'manager', 'accountant', 'viewer'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Add AI confidence to vouchers
ALTER TABLE vouchers
    ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(5,4);

-- 3. Expand voucher source
DO $$ BEGIN
    ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_source_check;
    ALTER TABLE vouchers ADD CONSTRAINT vouchers_source_check
        CHECK (source IN ('manual','invoice_webhook','bank_import',
                          'payment_gateway','payroll','ai_suggested','ai_auto'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Bank transactions: add reconciliation fields
ALTER TABLE bank_transactions
    ADD COLUMN IF NOT EXISTS company_id         UUID REFERENCES companies(id),
    ADD COLUMN IF NOT EXISTS ai_match_confidence NUMERIC(5,4),
    ADD COLUMN IF NOT EXISTS reconciled_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reconciled_by      UUID REFERENCES users(id);

-- Backfill company_id on bank_transactions from bank_accounts
UPDATE bank_transactions bt
SET company_id = ba.company_id
FROM bank_accounts ba
WHERE bt.bank_account_id = ba.id
  AND bt.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_bank_txn_company ON bank_transactions(company_id);

-- 5. Expand bank_transactions status to include 'review', 'excluded'
DO $$ BEGIN
    ALTER TABLE bank_transactions DROP CONSTRAINT IF EXISTS bank_transactions_status_check;
    ALTER TABLE bank_transactions ADD CONSTRAINT bank_transactions_status_check
        CHECK (status IN ('unmatched','matched','review','excluded'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Add correction_count to ai_classifications
ALTER TABLE ai_classifications
    ADD COLUMN IF NOT EXISTS correction_count INT DEFAULT 0;

-- 7. AI suggestion log (new table)
CREATE TABLE IF NOT EXISTS ai_suggestion_log (
    id          BIGSERIAL PRIMARY KEY,
    company_id  UUID NOT NULL,
    account_id  UUID,
    confidence  NUMERIC(5,4),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_log_company ON ai_suggestion_log(company_id, created_at DESC);

-- 8. Uploaded invoices (new table)
CREATE TABLE IF NOT EXISTS uploaded_invoices (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_type      TEXT NOT NULL CHECK (invoice_type IN ('sales','purchase')),
    invoice_no        TEXT,
    party_name        TEXT,
    invoice_date      DATE,
    subtotal          NUMERIC(18,2) DEFAULT 0,
    cgst              NUMERIC(18,2) DEFAULT 0,
    sgst              NUMERIC(18,2) DEFAULT 0,
    igst              NUMERIC(18,2) DEFAULT 0,
    total             NUMERIC(18,2) DEFAULT 0,
    linked_voucher_id UUID REFERENCES vouchers(id),
    raw_data          TEXT,
    status            TEXT DEFAULT 'pending'
                      CHECK (status IN ('pending','posted','rejected')),
    uploaded_by       UUID REFERENCES users(id),
    uploaded_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Expand audit_log entity_id to TEXT (was UUID, needs to hold composite keys)
-- Only run if currently UUID type
DO $$ BEGIN
    ALTER TABLE audit_log ALTER COLUMN entity_id TYPE TEXT USING entity_id::TEXT;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 10. Add company mode (accountant / simple)
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'accountant'
    CHECK (mode IN ('accountant','simple'));

-- 11. Add last_login_at to users
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 12. Add unique constraint on bank_transactions for deduplication
DO $$ BEGIN
    ALTER TABLE bank_transactions
        ADD CONSTRAINT bank_txn_dedup_unique
        UNIQUE (bank_account_id, txn_date, amount, narration);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN unique_violation   THEN NULL; END $$;

-- Summary
DO $$ BEGIN
    RAISE NOTICE 'Migration v1→v2 complete. New features: AI confidence scores, reconciliation tracking, uploaded_invoices, ai_suggestion_log, expanded roles.';
END $$;
