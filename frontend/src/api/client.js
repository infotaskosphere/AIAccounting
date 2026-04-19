// src/api/client.js
// Centralized API layer — all backend calls go through here

import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// ── Auth token injection ──────────────────────────────────────────────────
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// ── Error handler ─────────────────────────────────────────────────────────
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Company context ───────────────────────────────────────────────────────
export const getCompanyId = () =>
  localStorage.getItem('company_id') || 'demo-company-uuid'

// ════════════════════════════════════════════════════════════════════════════
// Dashboard
// ════════════════════════════════════════════════════════════════════════════
export const dashboardApi = {
  getBalanceSheet: () =>
    api.get(`/reports/${getCompanyId()}/balance-sheet`),
  getTrialBalance: () =>
    api.get(`/reports/${getCompanyId()}/trial-balance`),
  getRecentVouchers: () =>
    api.get(`/reports/${getCompanyId()}/recent-vouchers`),
  getCashflow: () =>
    api.get(`/reports/${getCompanyId()}/cashflow`),
}

// ════════════════════════════════════════════════════════════════════════════
// Accounts
// ════════════════════════════════════════════════════════════════════════════
export const accountsApi = {
  list: () =>
    api.get(`/accounts?company_id=${getCompanyId()}`),
  create: (data) =>
    api.post('/accounts', { ...data, company_id: getCompanyId() }),
}

// ════════════════════════════════════════════════════════════════════════════
// Vouchers / Journal
// ════════════════════════════════════════════════════════════════════════════
export const vouchersApi = {
  list: (params = {}) =>
    api.get(`/vouchers`, { params: { company_id: getCompanyId(), ...params } }),
  create: (data) =>
    api.post('/vouchers', { ...data, company_id: getCompanyId() }),
  reverse: (id) =>
    api.post(`/vouchers/${id}/reverse`),
  getLedger: (accountId, params = {}) =>
    api.get(`/ledger/${accountId}`, { params: { company_id: getCompanyId(), ...params } }),
}

// ════════════════════════════════════════════════════════════════════════════
// Bank Import & Reconciliation
// ════════════════════════════════════════════════════════════════════════════
export const bankApi = {
  getBankAccounts: () =>
    api.get(`/bank-accounts?company_id=${getCompanyId()}`),
  importStatement: (bankAccountId, file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/bank/${bankAccountId}/import`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  getUnmatched: (bankAccountId) =>
    api.get(`/bank/${bankAccountId}/unmatched`),
  autoReconcile: () =>
    api.post(`/reconcile/${getCompanyId()}`),
  manualMatch: (txnId, voucherId) =>
    api.post(`/bank/match`, { txn_id: txnId, voucher_id: voucherId }),
  ignoreTransaction: (txnId) =>
    api.post(`/bank/ignore`, { txn_id: txnId }),
}

// ════════════════════════════════════════════════════════════════════════════
// AI
// ════════════════════════════════════════════════════════════════════════════
export const aiApi = {
  classify: (narrations) =>
    api.post('/ai/classify', {
      company_id: getCompanyId(),
      narrations,
    }),
  confirmClassification: (narration, accountId) =>
    api.post('/ai/confirm', {
      company_id: getCompanyId(),
      narration,
      account_id: accountId,
    }),
}

// ════════════════════════════════════════════════════════════════════════════
// GST
// ════════════════════════════════════════════════════════════════════════════
export const gstApi = {
  getGSTR1: (period) =>
    api.get(`/gst/${getCompanyId()}/gstr1/${period}`),
  getGSTR3B: (period) =>
    api.get(`/gst/${getCompanyId()}/gstr3b/${period}`),
  getITCSummary: (period) =>
    api.get(`/gst/${getCompanyId()}/itc/${period}`),
  getTransactions: (period) =>
    api.get(`/gst/${getCompanyId()}/transactions?period=${period}`),
}

// ════════════════════════════════════════════════════════════════════════════
// Payroll
// ════════════════════════════════════════════════════════════════════════════
export const payrollApi = {
  getEmployees: () =>
    api.get(`/employees?company_id=${getCompanyId()}`),
  createEmployee: (data) =>
    api.post('/employees', { ...data, company_id: getCompanyId() }),
  runPayroll: (period) =>
    api.post(`/payroll/${getCompanyId()}/run/${period}`),
  getPayrollHistory: () =>
    api.get(`/payroll/${getCompanyId()}/history`),
  getPayslip: (employeeId, period) =>
    api.get(`/payroll/${getCompanyId()}/payslip/${employeeId}/${period}`),
}

export default api
