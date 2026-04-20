// src/api/mockData.js
// Realistic mock data — app works fully without the backend running

// ── Per-company data sets ──────────────────────────────────────────────────
// Each company has its own snapshot so switching companies updates all pages.

const CO1 = {
  name: 'Acme Corp Pvt Ltd',
  period: 'March 2024',
  dashboard: {
    balanceSheet: { assets:2847500, liabilities:1234200, equity:1613300, income:4820000, expenses:3206700, net_profit:1613300 },
    cashflow: [
      { month:'Oct', inflow:380000, outflow:290000 }, { month:'Nov', inflow:420000, outflow:310000 },
      { month:'Dec', inflow:510000, outflow:380000 }, { month:'Jan', inflow:390000, outflow:340000 },
      { month:'Feb', inflow:460000, outflow:290000 }, { month:'Mar', inflow:580000, outflow:410000 },
    ],
    recentVouchers: [
      { id:'v1', voucher_no:'SI-2024-0087', voucher_type:'sales',    date:'2024-03-28', narration:'Invoice - Reliance Industries Ltd',  amount:118000, status:'posted' },
      { id:'v2', voucher_no:'PV-2024-0043', voucher_type:'payment',  date:'2024-03-27', narration:'HDFC Bank - AWS Invoice Mar 2024',    amount:24720,  status:'posted' },
      { id:'v3', voucher_no:'JV-2024-0012', voucher_type:'journal',  date:'2024-03-26', narration:'Depreciation for March 2024',         amount:8500,   status:'posted' },
      { id:'v4', voucher_no:'RV-2024-0031', voucher_type:'receipt',  date:'2024-03-25', narration:'Payment received - TCS Ltd',          amount:236000, status:'posted' },
      { id:'v5', voucher_no:'PI-2024-0019', voucher_type:'purchase', date:'2024-03-24', narration:'Raw material - Tata Steel',           amount:85000,  status:'posted' },
    ],
    alerts: [
      { type:'warning', message:'12 bank transactions pending reconciliation', action:'Reconcile now' },
      { type:'info',    message:'GSTR-1 for March due on April 11',            action:'Prepare return' },
      { type:'success', message:'AI classified 94 transactions today (98% accuracy)' },
    ],
  },
  vouchers: [
    { id:'v1', voucher_no:'SI-2024-0087', voucher_type:'sales',    date:'2024-03-28', narration:'Invoice - Reliance Industries Ltd',  amount:118000, status:'posted', source:'invoice_webhook' },
    { id:'v2', voucher_no:'PV-2024-0043', voucher_type:'payment',  date:'2024-03-27', narration:'HDFC Bank - AWS Invoice Mar 2024',   amount:24720,  status:'posted', source:'bank_import' },
    { id:'v3', voucher_no:'JV-2024-0012', voucher_type:'journal',  date:'2024-03-26', narration:'Depreciation for March 2024',        amount:8500,   status:'posted', source:'manual' },
    { id:'v4', voucher_no:'RV-2024-0031', voucher_type:'receipt',  date:'2024-03-25', narration:'Payment received - TCS Ltd',         amount:236000, status:'posted', source:'payment_gateway' },
    { id:'v5', voucher_no:'PI-2024-0019', voucher_type:'purchase', date:'2024-03-24', narration:'Raw material - Tata Steel',          amount:85000,  status:'posted', source:'invoice_webhook' },
    { id:'v6', voucher_no:'JV-2024-0011', voucher_type:'journal',  date:'2024-03-22', narration:'Prepaid insurance adjustment',       amount:15000,  status:'posted', source:'manual' },
    { id:'v7', voucher_no:'PV-2024-0042', voucher_type:'payment',  date:'2024-03-21', narration:'Rent - March 2024',                  amount:40000,  status:'posted', source:'manual' },
    { id:'v8', voucher_no:'SI-2024-0086', voucher_type:'sales',    date:'2024-03-20', narration:'Invoice - Wipro Technologies',       amount:59000,  status:'posted', source:'invoice_webhook' },
  ],
  bankTransactions: [
    { id:'bt1', txn_date:'2024-03-28', narration:'AMAZON WEB SERVICES INDIA',  amount:24720,  txn_type:'debit',  status:'unmatched', ai_suggested_account:'Software Subscriptions', confidence:0.92 },
    { id:'bt2', txn_date:'2024-03-28', narration:'NEFT CR-RELIANCE IND LTD',   amount:118000, txn_type:'credit', status:'matched',   matched_voucher:'SI-2024-0087',                confidence:0.97 },
    { id:'bt3', txn_date:'2024-03-27', narration:'UPI/PHONEPE/SWIGGY',         amount:3240,   txn_type:'debit',  status:'unmatched', ai_suggested_account:'Office Supplies',        confidence:0.71 },
    { id:'bt4', txn_date:'2024-03-26', narration:'HDFC BANK - SALARY TRANSFER',amount:284000, txn_type:'debit',  status:'unmatched', ai_suggested_account:'Salaries & Wages',       confidence:0.95 },
    { id:'bt5', txn_date:'2024-03-25', narration:'NEFT CR-TCS LIMITED',        amount:236000, txn_type:'credit', status:'matched',   matched_voucher:'RV-2024-0031',                confidence:0.98 },
    { id:'bt6', txn_date:'2024-03-24', narration:'JIOFIBER BROADBAND',         amount:2360,   txn_type:'debit',  status:'unmatched', ai_suggested_account:'Internet & Telephone',   confidence:0.96 },
    { id:'bt7', txn_date:'2024-03-23', narration:'GOOGLE INDIA DIGITAL SVCS',  amount:8496,   txn_type:'debit',  status:'unmatched', ai_suggested_account:'Advertising',            confidence:0.88 },
    { id:'bt8', txn_date:'2024-03-22', narration:'HDFC BANK CHARGES',          amount:590,    txn_type:'debit',  status:'matched',   matched_voucher:'JV-2024-0011',                confidence:0.94 },
  ],
  gst: {
    period:'March 2024',
    output:{ taxable:4820000, cgst:144600, sgst:144600, igst:0, total:5109200 },
    input: { taxable:2140000, cgst:38400,  sgst:38400,  igst:0, total:2216800 },
    net_payable:{ cgst:106200, sgst:106200, igst:0, total:212400 },
    b2b_count:24, b2c_count:8,
    transactions:[
      { invoice_no:'SI-0087', party:'Reliance Industries Ltd',   gstin:'27AAACR5055K1ZS', taxable:100000, cgst:9000,  sgst:9000,  igst:0, total:118000 },
      { invoice_no:'SI-0086', party:'Wipro Technologies',        gstin:'29AAACW0035C1ZM', taxable:50000,  cgst:4500,  sgst:4500,  igst:0, total:59000 },
      { invoice_no:'SI-0085', party:'Infosys BPM Ltd',           gstin:'29AABCI0038B1ZE', taxable:80000,  cgst:7200,  sgst:7200,  igst:0, total:94400 },
      { invoice_no:'SI-0084', party:'Tata Consultancy Services', gstin:'27AAACT2727Q1ZM', taxable:120000, cgst:10800, sgst:10800, igst:0, total:141600 },
    ],
  },
  payroll: {
    period:'2024-03',
    employees:[
      { id:'e1', name:'Rahul Sharma',  designation:'Senior Developer',  basic:60000, hra:24000, special:16000, gross:100000, pf:7200, esic:0,   tds:8500,  net:84300 },
      { id:'e2', name:'Priya Patel',   designation:'Product Manager',   basic:70000, hra:28000, special:22000, gross:120000, pf:8400, esic:0,   tds:11200, net:100400 },
      { id:'e3', name:'Amit Kumar',    designation:'UI Designer',       basic:40000, hra:16000, special:4000,  gross:60000,  pf:4800, esic:450, tds:3200,  net:51550 },
      { id:'e4', name:'Sneha Reddy',   designation:'Sales Executive',   basic:25000, hra:10000, special:5000,  gross:40000,  pf:3000, esic:300, tds:0,     net:36700 },
      { id:'e5', name:'Vikram Singh',  designation:'DevOps Engineer',   basic:55000, hra:22000, special:13000, gross:90000,  pf:6600, esic:0,   tds:7100,  net:76300 },
    ],
    totals:{ gross:410000, pf_employee:30000, esic_employee:750, tds:30000, net:349250, ctc:455450 },
  },
}

const CO2 = {
  name: 'Beta Traders',
  period: 'March 2024',
  dashboard: {
    balanceSheet: { assets:980000, liabilities:420000, equity:560000, income:1840000, expenses:1280000, net_profit:560000 },
    cashflow: [
      { month:'Oct', inflow:140000, outflow:110000 }, { month:'Nov', inflow:160000, outflow:120000 },
      { month:'Dec', inflow:210000, outflow:160000 }, { month:'Jan', inflow:180000, outflow:140000 },
      { month:'Feb', inflow:190000, outflow:130000 }, { month:'Mar', inflow:220000, outflow:155000 },
    ],
    recentVouchers: [
      { id:'bv1', voucher_no:'SI-2024-0031', voucher_type:'sales',    date:'2024-03-28', narration:'Invoice - M/s Krishna Enterprises', amount:42000, status:'posted' },
      { id:'bv2', voucher_no:'PV-2024-0018', voucher_type:'payment',  date:'2024-03-26', narration:'Electricity Bill - March 2024',      amount:8400,  status:'posted' },
      { id:'bv3', voucher_no:'RV-2024-0012', voucher_type:'receipt',  date:'2024-03-25', narration:'Payment received - Mehta & Sons',    amount:85000, status:'posted' },
      { id:'bv4', voucher_no:'PI-2024-0009', voucher_type:'purchase', date:'2024-03-23', narration:'Goods - Sunrise Wholesalers',        amount:32000, status:'posted' },
    ],
    alerts: [
      { type:'warning', message:'4 bank transactions pending reconciliation',  action:'Reconcile now' },
      { type:'info',    message:'GSTR-1 for March due on April 11',            action:'Prepare return' },
    ],
  },
  vouchers: [
    { id:'bv1', voucher_no:'SI-2024-0031', voucher_type:'sales',    date:'2024-03-28', narration:'Invoice - M/s Krishna Enterprises', amount:42000, status:'posted', source:'manual' },
    { id:'bv2', voucher_no:'PV-2024-0018', voucher_type:'payment',  date:'2024-03-26', narration:'Electricity Bill - March 2024',      amount:8400,  status:'posted', source:'manual' },
    { id:'bv3', voucher_no:'RV-2024-0012', voucher_type:'receipt',  date:'2024-03-25', narration:'Payment received - Mehta & Sons',    amount:85000, status:'posted', source:'manual' },
    { id:'bv4', voucher_no:'PI-2024-0009', voucher_type:'purchase', date:'2024-03-23', narration:'Goods - Sunrise Wholesalers',        amount:32000, status:'posted', source:'manual' },
  ],
  bankTransactions: [
    { id:'bb1', txn_date:'2024-03-28', narration:'SBI - SALARY TRANSFER',       amount:95000, txn_type:'debit',  status:'unmatched', ai_suggested_account:'Salaries & Wages',  confidence:0.95 },
    { id:'bb2', txn_date:'2024-03-27', narration:'NEFT CR-MEHTA AND SONS',      amount:85000, txn_type:'credit', status:'matched',   matched_voucher:'RV-2024-0012',           confidence:0.96 },
    { id:'bb3', txn_date:'2024-03-25', narration:'MSEB ELECTRICITY BILL',       amount:8400,  txn_type:'debit',  status:'matched',   matched_voucher:'PV-2024-0018',           confidence:0.97 },
    { id:'bb4', txn_date:'2024-03-22', narration:'INDIAN OIL FUEL EXPENSE',     amount:4200,  txn_type:'debit',  status:'unmatched', ai_suggested_account:'Travelling',        confidence:0.84 },
  ],
  gst: {
    period:'March 2024',
    output:{ taxable:1840000, cgst:55200, sgst:55200, igst:0, total:1950400 },
    input: { taxable:820000,  cgst:14760, sgst:14760, igst:0, total:849520 },
    net_payable:{ cgst:40440, sgst:40440, igst:0, total:80880 },
    b2b_count:12, b2c_count:5,
    transactions:[
      { invoice_no:'SI-0031', party:'M/s Krishna Enterprises', gstin:'27AAACK1234B1ZP', taxable:35593, cgst:3203, sgst:3203, igst:0, total:42000 },
      { invoice_no:'SI-0030', party:'Mehta & Sons',            gstin:'27AAACM5678C1ZQ', taxable:72034, cgst:6483, sgst:6483, igst:0, total:85000 },
    ],
  },
  payroll: {
    period:'2024-03',
    employees:[
      { id:'be1', name:'Suresh Patil',  designation:'Store Manager',   basic:22000, hra:8800, special:4200, gross:35000, pf:2640, esic:263, tds:0,    net:32097 },
      { id:'be2', name:'Anita Desai',   designation:'Sales Executive', basic:18000, hra:7200, special:2800, gross:28000, pf:2160, esic:210, tds:0,    net:25630 },
      { id:'be3', name:'Ravi Joshi',    designation:'Accountant',      basic:28000, hra:11200,special:5800, gross:45000, pf:3360, esic:0,   tds:1200, net:40440 },
    ],
    totals:{ gross:108000, pf_employee:8160, esic_employee:473, tds:1200, net:98167, ctc:121633 },
  },
}

// Map company id → data
export const COMPANY_DATA = { 'co-1': CO1, 'co-2': CO2 }

// Helper — call this in any page: getCompanyData(activeCompany?.id)
export function getCompanyData(companyId) {
  return COMPANY_DATA[companyId] || CO1
}

// Legacy named exports (kept for backward compatibility — use getCompanyData in pages)
export const mockDashboard         = CO1.dashboard
export const mockVouchers          = CO1.vouchers
export const mockBankTransactions  = CO1.bankTransactions
export const mockGSTSummary        = CO1.gst
export const mockPayroll           = CO1.payroll
export const mockAccounts = [
  { id:'acc-1',  code:'1001', name:'Cash in Hand',            nature:'asset',   account_type:'cash',    balance:45200 },
  { id:'acc-2',  code:'1010', name:'HDFC Bank - Current A/c', nature:'asset',   account_type:'bank',    balance:1284500 },
  { id:'acc-3',  code:'1100', name:'Sundry Debtors',          nature:'asset',   account_type:'debtor',  balance:842000 },
  { id:'acc-4',  code:'1300', name:'Input GST - CGST',        nature:'asset',   account_type:'tax',     balance:38400 },
  { id:'acc-5',  code:'1301', name:'Input GST - SGST',        nature:'asset',   account_type:'tax',     balance:38400 },
  { id:'acc-6',  code:'3001', name:'Sundry Creditors',        nature:'liability',account_type:'creditor',balance:284000 },
  { id:'acc-7',  code:'3100', name:'Output GST - CGST',       nature:'liability',account_type:'tax',    balance:72000 },
  { id:'acc-8',  code:'3101', name:'Output GST - SGST',       nature:'liability',account_type:'tax',    balance:72000 },
  { id:'acc-9',  code:'3200', name:'TDS Payable',             nature:'liability',account_type:'tax',    balance:18500 },
  { id:'acc-10', code:'6001', name:'Sales - Products',        nature:'income',  account_type:'income',  balance:2840000 },
  { id:'acc-11', code:'6002', name:'Sales - Services',        nature:'income',  account_type:'income',  balance:1980000 },
  { id:'acc-12', code:'8001', name:'Salaries & Wages',        nature:'expense', account_type:'expense', balance:1840000 },
  { id:'acc-13', code:'8002', name:'Rent',                    nature:'expense', account_type:'expense', balance:480000 },
  { id:'acc-14', code:'8006', name:'Software Subscriptions',  nature:'expense', account_type:'expense', balance:124000 },
  { id:'acc-15', code:'8010', name:'Bank Charges',            nature:'expense', account_type:'expense', balance:12400 },
]
