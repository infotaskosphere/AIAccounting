-- ============================================================
-- Default Chart of Accounts Seeder (Indian SME)
-- Run after schema.sql for each new company
-- ============================================================

-- Usage: Replace :company_id with actual company UUID
-- psql -v company_id="'YOUR-UUID-HERE'" -f seed_accounts.sql

DO $$
DECLARE
    cid UUID := :'company_id'::UUID;
    -- Group IDs
    g_current_assets    UUID := uuid_generate_v4();
    g_fixed_assets      UUID := uuid_generate_v4();
    g_current_liab      UUID := uuid_generate_v4();
    g_long_term_liab    UUID := uuid_generate_v4();
    g_equity            UUID := uuid_generate_v4();
    g_income            UUID := uuid_generate_v4();
    g_direct_exp        UUID := uuid_generate_v4();
    g_indirect_exp      UUID := uuid_generate_v4();
BEGIN

-- ---- GROUPS ----
INSERT INTO account_groups (id, company_id, name, nature, sequence) VALUES
    (g_current_assets,  cid, 'Current Assets',       'asset',     1),
    (g_fixed_assets,    cid, 'Fixed Assets',          'asset',     2),
    (g_current_liab,    cid, 'Current Liabilities',   'liability', 3),
    (g_long_term_liab,  cid, 'Long Term Liabilities', 'liability', 4),
    (g_equity,          cid, 'Capital & Reserves',    'equity',    5),
    (g_income,          cid, 'Income',                'income',    6),
    (g_direct_exp,      cid, 'Direct Expenses',       'expense',   7),
    (g_indirect_exp,    cid, 'Indirect Expenses',     'expense',   8);

-- ---- ASSET ACCOUNTS ----
INSERT INTO accounts (company_id, group_id, code, name, nature, account_type, is_system) VALUES
    (cid, g_current_assets, '1001', 'Cash in Hand',            'asset', 'cash',        TRUE),
    (cid, g_current_assets, '1002', 'Petty Cash',              'asset', 'cash',        TRUE),
    (cid, g_current_assets, '1010', 'HDFC Bank - Current A/c', 'asset', 'bank',        FALSE),
    (cid, g_current_assets, '1011', 'SBI Bank - Current A/c',  'asset', 'bank',        FALSE),
    (cid, g_current_assets, '1100', 'Sundry Debtors',          'asset', 'debtor',      TRUE),
    (cid, g_current_assets, '1200', 'Advance to Suppliers',    'asset', 'other',       FALSE),
    (cid, g_current_assets, '1300', 'Input GST - CGST',        'asset', 'tax',         TRUE),
    (cid, g_current_assets, '1301', 'Input GST - SGST',        'asset', 'tax',         TRUE),
    (cid, g_current_assets, '1302', 'Input GST - IGST',        'asset', 'tax',         TRUE),
    (cid, g_current_assets, '1400', 'TDS Receivable',          'asset', 'tax',         TRUE),
    (cid, g_current_assets, '1500', 'Prepaid Expenses',        'asset', 'other',       FALSE),
    (cid, g_fixed_assets,   '2001', 'Computer & Equipment',    'asset', 'fixed_asset', FALSE),
    (cid, g_fixed_assets,   '2002', 'Furniture & Fixtures',    'asset', 'fixed_asset', FALSE),
    (cid, g_fixed_assets,   '2003', 'Vehicles',                'asset', 'fixed_asset', FALSE);

-- ---- LIABILITY ACCOUNTS ----
INSERT INTO accounts (company_id, group_id, code, name, nature, account_type, is_system) VALUES
    (cid, g_current_liab,   '3001', 'Sundry Creditors',        'liability', 'creditor', TRUE),
    (cid, g_current_liab,   '3100', 'Output GST - CGST',       'liability', 'tax',      TRUE),
    (cid, g_current_liab,   '3101', 'Output GST - SGST',       'liability', 'tax',      TRUE),
    (cid, g_current_liab,   '3102', 'Output GST - IGST',       'liability', 'tax',      TRUE),
    (cid, g_current_liab,   '3200', 'TDS Payable',             'liability', 'tax',      TRUE),
    (cid, g_current_liab,   '3201', 'PF Payable',              'liability', 'tax',      TRUE),
    (cid, g_current_liab,   '3202', 'ESIC Payable',            'liability', 'tax',      TRUE),
    (cid, g_current_liab,   '3300', 'Salary Payable',          'liability', 'other',    TRUE),
    (cid, g_current_liab,   '3400', 'Advance from Customers',  'liability', 'other',    FALSE),
    (cid, g_long_term_liab, '4001', 'Bank Loan',               'liability', 'other',    FALSE),
    (cid, g_long_term_liab, '4002', 'Director Loan',           'liability', 'other',    FALSE);

-- ---- EQUITY ACCOUNTS ----
INSERT INTO accounts (company_id, group_id, code, name, nature, account_type, is_system) VALUES
    (cid, g_equity, '5001', 'Capital Account',        'equity', 'capital', TRUE),
    (cid, g_equity, '5002', 'Retained Earnings',      'equity', 'capital', TRUE),
    (cid, g_equity, '5003', 'Current Year Profit',    'equity', 'capital', TRUE);

-- ---- INCOME ACCOUNTS ----
INSERT INTO accounts (company_id, group_id, code, name, nature, account_type, is_system) VALUES
    (cid, g_income, '6001', 'Sales - Products',       'income', 'income', FALSE),
    (cid, g_income, '6002', 'Sales - Services',       'income', 'income', FALSE),
    (cid, g_income, '6003', 'Export Sales',           'income', 'income', FALSE),
    (cid, g_income, '6100', 'Interest Income',        'income', 'income', FALSE),
    (cid, g_income, '6101', 'Other Income',           'income', 'income', FALSE),
    (cid, g_income, '6200', 'Discount Received',      'income', 'income', FALSE);

-- ---- DIRECT EXPENSE ACCOUNTS ----
INSERT INTO accounts (company_id, group_id, code, name, nature, account_type, is_system) VALUES
    (cid, g_direct_exp, '7001', 'Purchase - Raw Material', 'expense', 'expense', FALSE),
    (cid, g_direct_exp, '7002', 'Purchase - Trading Goods','expense', 'expense', FALSE),
    (cid, g_direct_exp, '7100', 'Direct Labour',           'expense', 'expense', FALSE),
    (cid, g_direct_exp, '7200', 'Freight Inward',          'expense', 'expense', FALSE);

-- ---- INDIRECT EXPENSE ACCOUNTS ----
INSERT INTO accounts (company_id, group_id, code, name, nature, account_type, is_system) VALUES
    (cid, g_indirect_exp, '8001', 'Salaries & Wages',        'expense', 'expense', TRUE),
    (cid, g_indirect_exp, '8002', 'Rent',                    'expense', 'expense', FALSE),
    (cid, g_indirect_exp, '8003', 'Electricity',             'expense', 'expense', FALSE),
    (cid, g_indirect_exp, '8004', 'Internet & Telephone',    'expense', 'expense', FALSE),
    (cid, g_indirect_exp, '8005', 'Office Supplies',         'expense', 'expense', FALSE),
    (cid, g_indirect_exp, '8006', 'Software Subscriptions',  'expense', 'expense', FALSE),
    (cid, g_indirect_exp, '8007', 'Travel & Conveyance',     'expense', 'expense', FALSE),
    (cid, g_indirect_exp, '8008', 'Professional Fees',       'expense', 'expense', FALSE),
    (cid, g_indirect_exp, '8009', 'Advertising',             'expense', 'expense', FALSE),
    (cid, g_indirect_exp, '8010', 'Bank Charges',            'expense', 'expense', FALSE),
    (cid, g_indirect_exp, '8011', 'Depreciation',            'expense', 'expense', FALSE),
    (cid, g_indirect_exp, '8012', 'Discount Allowed',        'expense', 'expense', FALSE),
    (cid, g_indirect_exp, '8013', 'Miscellaneous Expenses',  'expense', 'expense', FALSE);

END $$;
