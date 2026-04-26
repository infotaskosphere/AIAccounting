// src/api/companyStore.js
// Real per-company data store persisted in localStorage.
// New companies start with ZERO data — no mock fallback.

const STORE_KEY = (id) => `finix_data_${id}`

function emptyCompanyData() {
  return {
    dashboard: {
      balanceSheet: { assets:0, liabilities:0, equity:0, income:0, expenses:0, net_profit:0 },
      cashflow: [],
      recentVouchers: [],
      alerts: [],
    },
    vouchers: [],
    bankTransactions: [],
    bankAccounts: [],
    customAccountHeads: [],
    gst: {
      period: '',
      output: { taxable:0, cgst:0, sgst:0, igst:0, total:0 },
      input:  { taxable:0, cgst:0, sgst:0, igst:0, total:0 },
      net_payable: { cgst:0, sgst:0, igst:0, total:0 },
      b2b_count:0, b2c_count:0, transactions:[],
    },
    payroll: {
      period:'',
      employees:[],
      totals:{ gross:0, pf_employee:0, esic_employee:0, tds:0, net:0, ctc:0 },
    },
  }
}

export function loadCompanyData(companyId) {
  if (!companyId) return emptyCompanyData()
  try {
    const raw = localStorage.getItem(STORE_KEY(companyId))
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  return emptyCompanyData()
}

export function saveCompanyData(companyId, data) {
  if (!companyId) return
  try {
    localStorage.setItem(STORE_KEY(companyId), JSON.stringify(data))
  } catch (_) {}
}

export function addVoucher(companyId, voucher) {
  const data = loadCompanyData(companyId)
  const newVoucher = {
    id: `v-${Date.now()}`,
    voucher_no: generateVoucherNo(data.vouchers, voucher.voucher_type || voucher.type),
    ...voucher,
    voucher_type: voucher.voucher_type || voucher.type,
    status: 'posted',
    source: voucher.source || 'manual',
    created_at: new Date().toISOString(),
  }
  data.vouchers = [newVoucher, ...data.vouchers]
  data.dashboard.recentVouchers = data.vouchers.slice(0, 10)
  recalcDashboard(data)
  saveCompanyData(companyId, data)
  return newVoucher
}

export function updateVoucher(companyId, voucherId, updates) {
  const data = loadCompanyData(companyId)
  data.vouchers = data.vouchers.map(v =>
    v.id === voucherId ? { ...v, ...updates, updated_at: new Date().toISOString() } : v
  )
  data.dashboard.recentVouchers = data.vouchers.slice(0, 10)
  recalcDashboard(data)
  saveCompanyData(companyId, data)
}

export function deleteVoucher(companyId, voucherId) {
  const data = loadCompanyData(companyId)
  data.vouchers = data.vouchers.filter(v => v.id !== voucherId)
  data.dashboard.recentVouchers = data.vouchers.slice(0, 10)
  recalcDashboard(data)
  saveCompanyData(companyId, data)
}

export function addBankTransactions(companyId, transactions) {
  const data = loadCompanyData(companyId)
  const existingIds = new Set(data.bankTransactions.map(t => t.id))
  const newTxns = transactions
    .filter(t => !existingIds.has(t.id))
    .map((t, i) => ({
      ...t,
      id: t.id || `bt-${Date.now()}-${i}`,
      status: 'unmatched',
    }))
  data.bankTransactions = [...newTxns, ...data.bankTransactions]
  saveCompanyData(companyId, data)
  return newTxns
}

export function updateBankTransaction(companyId, txnId, updates) {
  const data = loadCompanyData(companyId)
  data.bankTransactions = data.bankTransactions.map(t =>
    t.id === txnId ? { ...t, ...updates } : t
  )
  saveCompanyData(companyId, data)
}

export function clearBankTransactions(companyId) {
  const data = loadCompanyData(companyId)
  data.bankTransactions = []
  saveCompanyData(companyId, data)
}

export function addVouchers(companyId, vouchers) {
  const data = loadCompanyData(companyId)
  const newVouchers = vouchers.map(v => ({
    id: `v-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    voucher_no: generateVoucherNo(data.vouchers, v.voucher_type || v.type),
    ...v,
    voucher_type: v.voucher_type || v.type || 'journal',
    status: 'posted',
    source: v.source || 'bulk_import',
    created_at: new Date().toISOString(),
  }))
  data.vouchers = [...newVouchers, ...data.vouchers]
  data.dashboard.recentVouchers = data.vouchers.slice(0, 10)
  recalcDashboard(data)
  saveCompanyData(companyId, data)
  return newVouchers
}

// ── Expense account heads used to classify bank payment vouchers ──────
const EXPENSE_ACCOUNTS = new Set([
  'Purchases','Salaries & Wages','Rent','Electricity & Utilities','Bank Charges',
  'GST Payment','TDS Payment','Loan Repayment','Advertising & Marketing','Office Expenses',
  'Insurance Premium','Interest Expense','ATM Cash Withdrawal','Travel & Conveyance',
  'Miscellaneous Expense','Professional Fees','Repairs & Maintenance','Vehicle Expense',
  'Trademark Government Fees','DSC Fees','Software Subscriptions','Staff Welfare',
])

// ── A bank_import receipt is "direct income" (no prior sales invoice) when
//    credit_account is an income/misc account, NOT Accounts Receivable.
//    If a sales invoice was already posted, credit_account = 'Accounts Receivable'
//    and the receipt is just settling the debtor — NOT new income.
function isDirectIncomeReceipt(v) {
  return (
    v.voucher_type === 'receipt' &&
    v.source === 'bank_import' &&
    v.credit_account !== 'Accounts Receivable' &&
    v.credit_account !== 'Trade Receivables'
  )
}

function isDirectExpensePayment(v) {
  return (
    v.voucher_type === 'payment' &&
    v.source === 'bank_import' &&
    v.debit_account !== 'Accounts Payable' &&
    v.debit_account !== 'Trade Payables'
  )
}

export function computeFinancials(companyId) {
  const data = loadCompanyData(companyId)
  const vouchers = data.vouchers || []

  // Income = Sales invoices + direct-income bank receipts (NOT debtor settlements)
  // Expenses = Purchase invoices + direct-expense bank payments (NOT creditor settlements)
  const income   = vouchers.filter(v => v.voucher_type === 'sales' || isDirectIncomeReceipt(v)).reduce((s,v) => s + (Number(v.amount)||0), 0)
  const expenses = vouchers.filter(v => v.voucher_type === 'purchase' || isDirectExpensePayment(v)).reduce((s,v) => s + (Number(v.amount)||0), 0)

  const cgstOut = vouchers.filter(v => v.voucher_type === 'sales').reduce((s,v) => s + (Number(v.cgst)||0), 0)
  const sgstOut = vouchers.filter(v => v.voucher_type === 'sales').reduce((s,v) => s + (Number(v.sgst)||0), 0)
  const cgstIn  = vouchers.filter(v => v.voucher_type === 'purchase').reduce((s,v) => s + (Number(v.cgst)||0), 0)
  const sgstIn  = vouchers.filter(v => v.voucher_type === 'purchase').reduce((s,v) => s + (Number(v.sgst)||0), 0)

  const accountMap = {}
  const addEntry = (name, group, dr, cr) => {
    if (!accountMap[name]) accountMap[name] = { name, group, dr: 0, cr: 0 }
    accountMap[name].dr += dr
    accountMap[name].cr += cr
  }

  vouchers.forEach(v => {
    const amt   = Number(v.amount) || 0
    const cgst  = Number(v.cgst)  || 0
    const sgst  = Number(v.sgst)  || 0
    const igst  = Number(v.igst)  || 0
    const total = amt + cgst + sgst + igst
    const party = v.party || 'General'

    if (v.voucher_type === 'sales') {
      // Sales invoice: Dr Debtor (Accounts Receivable) → Cr Sales Revenue
      addEntry('Sales Revenue',       'Revenue from Operations', 0,     amt)
      addEntry(party + ' (Debtor)',   'Trade Receivables',       total, 0)
      if (cgst) addEntry('Output GST - CGST', 'Other Current Liabilities', 0, cgst)
      if (sgst) addEntry('Output GST - SGST', 'Other Current Liabilities', 0, sgst)
      if (igst) addEntry('Output GST - IGST', 'Other Current Liabilities', 0, igst)

    } else if (v.voucher_type === 'purchase') {
      // Purchase invoice: Dr Purchases → Cr Creditor (Accounts Payable)
      addEntry('Purchases',           'Cost of Goods Sold', amt,   0)
      addEntry(party + ' (Creditor)', 'Trade Payables',     0,     total)
      if (cgst) addEntry('Input GST - CGST', 'Other Current Assets', cgst, 0)
      if (sgst) addEntry('Input GST - SGST', 'Other Current Assets', sgst, 0)
      if (igst) addEntry('Input GST - IGST', 'Other Current Assets', igst, 0)

    } else if (v.voucher_type === 'receipt') {
      // Bank receipt — use stored debit_account / credit_account from posting logic
      // credit_account = 'Accounts Receivable' → settling prior invoice (no income again)
      // credit_account = income account         → direct receipt (no prior invoice)
      const drAcc = v.debit_account  || 'Bank / Cash'
      const crAcc = v.credit_account || 'Accounts Receivable'
      const crGroup = crAcc === 'Accounts Receivable' || crAcc.includes('Debtor')
        ? 'Trade Receivables'
        : EXPENSE_ACCOUNTS.has(crAcc) ? 'Expenses' : 'Revenue from Operations'
      addEntry(drAcc, 'Cash & Cash Equivalents', amt, 0)
      addEntry(crAcc, crGroup, 0, amt)

    } else if (v.voucher_type === 'payment') {
      // Bank payment — use stored debit_account / credit_account
      const drAcc = v.debit_account  || 'Accounts Payable'
      const crAcc = v.credit_account || 'Bank / Cash'
      const drGroup = drAcc === 'Accounts Payable' || drAcc.includes('Creditor')
        ? 'Trade Payables'
        : EXPENSE_ACCOUNTS.has(drAcc) ? 'Expenses' : 'Other Expenses'
      addEntry(drAcc, drGroup, amt, 0)
      addEntry(crAcc, 'Cash & Cash Equivalents', 0, amt)

    } else {
      addEntry(v.narration || 'Journal Entry', 'Journal', amt, 0)
    }
  })

  const trialBalance = Object.values(accountMap).map((a, i) => ({
    code: String(1000 + i),
    name: a.name,
    group: a.group,
    opDr: 0, opCr: 0,
    txDr: a.dr, txCr: a.cr,
    clDr: a.dr > a.cr ? a.dr - a.cr : 0,
    clCr: a.cr > a.dr ? a.cr - a.dr : 0,
  }))

  return {
    income, expenses,
    net_profit: income - expenses,
    assets: income,
    liabilities: expenses,
    equity: income - expenses,
    cgstOut, sgstOut, cgstIn, sgstIn,
    netGST: (cgstOut + sgstOut) - (cgstIn + sgstIn),
    trialBalance,
    vouchers,
    hasRealData: vouchers.length > 0,
  }
}

function recalcDashboard(data) {
  const vouchers = data.vouchers || []
  let income = 0, expenses = 0
  for (const v of vouchers) {
    const amt = Number(v.amount) || 0
    if (v.voucher_type === 'sales'    || isDirectIncomeReceipt(v))   income   += amt
    if (v.voucher_type === 'purchase' || isDirectExpensePayment(v))  expenses += amt
  }
  const net_profit = income - expenses
  data.dashboard.balanceSheet = { assets: income, liabilities: expenses, equity: net_profit, income, expenses, net_profit }

  const monthMap = {}
  for (const v of vouchers) {
    if (!v.date) continue
    const d   = new Date(v.date)
    const key = d.toLocaleString('default', { month: 'short' })
    if (!monthMap[key]) monthMap[key] = { month: key, inflow: 0, outflow: 0, _ts: d.getTime() }
    const amt = Number(v.amount) || 0
    if (v.voucher_type === 'sales'    || isDirectIncomeReceipt(v))   monthMap[key].inflow  += amt
    if (v.voucher_type === 'purchase' || isDirectExpensePayment(v))  monthMap[key].outflow += amt
  }
  data.dashboard.cashflow = Object.values(monthMap)
    .sort((a, b) => a._ts - b._ts)
    .slice(-6)
    .map(({ _ts, ...rest }) => rest)
}

function generateVoucherNo(vouchers, type) {
  const prefixMap = { sales:'SI', purchase:'PI', receipt:'RV', payment:'PV', journal:'JV', contra:'CV' }
  const prefix = prefixMap[type] || 'JV'
  const year = new Date().getFullYear()
  const count = vouchers.filter(v => (v.voucher_no || '').startsWith(prefix)).length + 1
  return `${prefix}-${year}-${String(count).padStart(4, '0')}`
}

export function clearCompanyData(companyId) {
  if (!companyId) return
  localStorage.removeItem(STORE_KEY(companyId))
}

export function loadCustomHeads(companyId) {
  const data = loadCompanyData(companyId)
  return data.customAccountHeads || []
}

export function addCustomHead(companyId, head) {
  const trimmed = (head || '').trim()
  if (!trimmed) return
  const data = loadCompanyData(companyId)
  const heads = data.customAccountHeads || []
  if (heads.some(h => h.toLowerCase() === trimmed.toLowerCase())) return
  data.customAccountHeads = [...heads, trimmed]
  saveCompanyData(companyId, data)
}

export function renameCustomHead(companyId, oldHead, newHead) {
  const trimmed = (newHead || '').trim()
  if (!trimmed) return
  const data = loadCompanyData(companyId)
  const heads = data.customAccountHeads || []
  data.customAccountHeads = heads.map(h => h === oldHead ? trimmed : h)
  data.bankTransactions = (data.bankTransactions || []).map(t =>
    t.ai_suggested_account === oldHead ? { ...t, ai_suggested_account: trimmed } : t
  )
  saveCompanyData(companyId, data)
}

export function deleteCustomHead(companyId, head) {
  const data = loadCompanyData(companyId)
  const heads = data.customAccountHeads || []
  data.customAccountHeads = heads.filter(h => h !== head)
  saveCompanyData(companyId, data)
}
