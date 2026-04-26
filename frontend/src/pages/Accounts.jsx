// src/pages/Accounts.jsx — Chart of Accounts (Schedule III, Companies Act 2013)
// FIX: Was showing hardcoded fake balances for every company.
//      Now: all balances start at ZERO, real balances loaded from API trial balance.
import { useState, useEffect } from 'react'
import { Plus, Search, Download, ChevronDown, ChevronRight, Edit2,
         AlertCircle, RefreshCw, Info } from 'lucide-react'
import { fmt } from '../utils/format'
import { useAuth } from '../context/AuthContext'

// ── Chart of Accounts master — Schedule III structure, ALL BALANCES = 0 ────
// Balances are loaded from the API (trial balance). If no transactions exist,
// all balances correctly show as zero.
const DEFAULT_ACCOUNTS = [
  // EQUITY & LIABILITIES
  { id:'a1',  code:'1001', name:'Share Capital',                  group:'Share Capital',              nature:'liability', type:'Capital',       balance:0 },
  { id:'a2',  code:'1002', name:'General Reserve',                group:'Reserves & Surplus',         nature:'liability', type:'Reserve',       balance:0 },
  { id:'a3',  code:'1003', name:'Profit & Loss A/c (Balance)',    group:'Reserves & Surplus',         nature:'liability', type:'Reserve',       balance:0 },
  { id:'a4',  code:'2001', name:'Long-term Loan (Bank)',          group:'Long-term Borrowings',       nature:'liability', type:'Loan',          balance:0 },
  { id:'a5',  code:'2002', name:'Vehicle Loan',                   group:'Long-term Borrowings',       nature:'liability', type:'Loan',          balance:0 },
  { id:'a6',  code:'2101', name:'Deferred Tax Liability',         group:'Deferred Tax Liabilities',   nature:'liability', type:'Tax',           balance:0 },
  { id:'a7',  code:'3001', name:'Sundry Creditors',               group:'Trade Payables',             nature:'liability', type:'Creditor',      balance:0 },
  { id:'a8',  code:'3002', name:'Bills Payable',                  group:'Trade Payables',             nature:'liability', type:'Creditor',      balance:0 },
  { id:'a9',  code:'3101', name:'Output GST - CGST',              group:'Other Current Liabilities',  nature:'liability', type:'Tax',           balance:0 },
  { id:'a10', code:'3102', name:'Output GST - SGST',              group:'Other Current Liabilities',  nature:'liability', type:'Tax',           balance:0 },
  { id:'a11', code:'3103', name:'Output GST - IGST',              group:'Other Current Liabilities',  nature:'liability', type:'Tax',           balance:0 },
  { id:'a12', code:'3104', name:'TDS Payable',                    group:'Other Current Liabilities',  nature:'liability', type:'Tax',           balance:0 },
  { id:'a13', code:'3105', name:'PF Payable',                     group:'Other Current Liabilities',  nature:'liability', type:'Statutory',     balance:0 },
  { id:'a14', code:'3106', name:'ESIC Payable',                   group:'Other Current Liabilities',  nature:'liability', type:'Statutory',     balance:0 },
  { id:'a15', code:'3107', name:'Salary Payable',                 group:'Other Current Liabilities',  nature:'liability', type:'Payable',       balance:0 },
  { id:'a16', code:'3108', name:'Advance from Customers',         group:'Other Current Liabilities',  nature:'liability', type:'Payable',       balance:0 },
  // ASSETS
  { id:'a17', code:'4001', name:'Land & Building',                group:'Tangible Fixed Assets',      nature:'asset',     type:'Fixed Asset',   balance:0 },
  { id:'a18', code:'4002', name:'Plant & Machinery',              group:'Tangible Fixed Assets',      nature:'asset',     type:'Fixed Asset',   balance:0 },
  { id:'a19', code:'4003', name:'Furniture & Fixtures',           group:'Tangible Fixed Assets',      nature:'asset',     type:'Fixed Asset',   balance:0 },
  { id:'a20', code:'4004', name:'Computers & Peripherals',        group:'Tangible Fixed Assets',      nature:'asset',     type:'Fixed Asset',   balance:0 },
  { id:'a21', code:'4005', name:'Vehicles',                       group:'Tangible Fixed Assets',      nature:'asset',     type:'Fixed Asset',   balance:0 },
  { id:'a22', code:'4101', name:'Less: Accumulated Depreciation', group:'Tangible Fixed Assets',      nature:'asset',     type:'Depreciation',  balance:0 },
  { id:'a23', code:'4201', name:'Computer Software',              group:'Intangible Assets',          nature:'asset',     type:'Intangible',    balance:0 },
  { id:'a24', code:'4202', name:'Goodwill',                       group:'Intangible Assets',          nature:'asset',     type:'Intangible',    balance:0 },
  { id:'a25', code:'5001', name:'Long-term Investments',          group:'Non-current Investments',    nature:'asset',     type:'Investment',    balance:0 },
  { id:'a26', code:'5101', name:'Security Deposits',              group:'Long-term Loans & Advances', nature:'asset',     type:'Deposit',       balance:0 },
  { id:'a27', code:'6001', name:'Stock-in-Trade',                 group:'Inventories',                nature:'asset',     type:'Stock',         balance:0 },
  { id:'a28', code:'6002', name:'Raw Materials',                  group:'Inventories',                nature:'asset',     type:'Stock',         balance:0 },
  { id:'a29', code:'6003', name:'Work-in-Progress',               group:'Inventories',                nature:'asset',     type:'Stock',         balance:0 },
  { id:'a30', code:'7001', name:'Sundry Debtors',                 group:'Trade Receivables',          nature:'asset',     type:'Debtor',        balance:0 },
  { id:'a31', code:'7002', name:'Bills Receivable',               group:'Trade Receivables',          nature:'asset',     type:'Debtor',        balance:0 },
  { id:'a32', code:'7101', name:'Cash in Hand',                   group:'Cash & Cash Equivalents',    nature:'asset',     type:'Cash',          balance:0 },
  { id:'a33', code:'7102', name:'Bank Account (Current)',         group:'Cash & Cash Equivalents',    nature:'asset',     type:'Bank',          balance:0 },
  { id:'a34', code:'7103', name:'Bank Account (Savings)',         group:'Cash & Cash Equivalents',    nature:'asset',     type:'Bank',          balance:0 },
  { id:'a35', code:'7201', name:'Input GST - CGST',               group:'Other Current Assets',       nature:'asset',     type:'Tax',           balance:0 },
  { id:'a36', code:'7202', name:'Input GST - SGST',               group:'Other Current Assets',       nature:'asset',     type:'Tax',           balance:0 },
  { id:'a37', code:'7203', name:'TDS Receivable',                 group:'Other Current Assets',       nature:'asset',     type:'Tax',           balance:0 },
  { id:'a38', code:'7204', name:'Prepaid Expenses',               group:'Other Current Assets',       nature:'asset',     type:'Prepaid',       balance:0 },
  { id:'a39', code:'7205', name:'Advance to Suppliers',           group:'Other Current Assets',       nature:'asset',     type:'Advance',       balance:0 },
  // INCOME
  { id:'a40', code:'8001', name:'Sales - Products',               group:'Revenue from Operations',    nature:'income',    type:'Sales',         balance:0 },
  { id:'a41', code:'8002', name:'Sales - Services',               group:'Revenue from Operations',    nature:'income',    type:'Sales',         balance:0 },
  { id:'a42', code:'8003', name:'Sales Returns',                  group:'Revenue from Operations',    nature:'income',    type:'Returns',       balance:0 },
  { id:'a43', code:'8101', name:'Interest Income',                group:'Other Income',               nature:'income',    type:'Income',        balance:0 },
  { id:'a44', code:'8102', name:'Miscellaneous Income',           group:'Other Income',               nature:'income',    type:'Income',        balance:0 },
  // EXPENSES
  { id:'a45', code:'9001', name:'Purchase - Products',            group:'Cost of Goods Sold',         nature:'expense',   type:'Purchase',      balance:0 },
  { id:'a46', code:'9002', name:'Purchase Returns',               group:'Cost of Goods Sold',         nature:'expense',   type:'Returns',       balance:0 },
  { id:'a47', code:'9003', name:'Freight Inward',                 group:'Cost of Goods Sold',         nature:'expense',   type:'Direct',        balance:0 },
  { id:'a48', code:'9101', name:'Salaries & Wages',               group:'Employee Benefit Expense',   nature:'expense',   type:'Expense',       balance:0 },
  { id:'a49', code:'9102', name:'PF Contribution (Employer)',     group:'Employee Benefit Expense',   nature:'expense',   type:'Expense',       balance:0 },
  { id:'a50', code:'9103', name:'ESIC Contribution (Employer)',   group:'Employee Benefit Expense',   nature:'expense',   type:'Expense',       balance:0 },
  { id:'a51', code:'9104', name:'Staff Welfare',                  group:'Employee Benefit Expense',   nature:'expense',   type:'Expense',       balance:0 },
  { id:'a52', code:'9201', name:'Depreciation',                   group:'Depreciation & Amortisation',nature:'expense',   type:'Expense',       balance:0 },
  { id:'a53', code:'9301', name:'Bank Interest Expense',          group:'Finance Costs',              nature:'expense',   type:'Expense',       balance:0 },
  { id:'a54', code:'9302', name:'Bank Charges',                   group:'Finance Costs',              nature:'expense',   type:'Expense',       balance:0 },
  { id:'a55', code:'9401', name:'Rent',                           group:'Other Expenses',             nature:'expense',   type:'Expense',       balance:0 },
  { id:'a56', code:'9402', name:'Electricity Charges',            group:'Other Expenses',             nature:'expense',   type:'Expense',       balance:0 },
  { id:'a57', code:'9403', name:'Internet & Telephone',           group:'Other Expenses',             nature:'expense',   type:'Expense',       balance:0 },
  { id:'a58', code:'9404', name:'Software Subscriptions',         group:'Other Expenses',             nature:'expense',   type:'Expense',       balance:0 },
  { id:'a59', code:'9405', name:'Advertising & Marketing',        group:'Other Expenses',             nature:'expense',   type:'Expense',       balance:0 },
  { id:'a60', code:'9406', name:'Travelling & Conveyance',        group:'Other Expenses',             nature:'expense',   type:'Expense',       balance:0 },
  { id:'a61', code:'9407', name:'Professional Fees',              group:'Other Expenses',             nature:'expense',   type:'Expense',       balance:0 },
  { id:'a62', code:'9408', name:'Repairs & Maintenance',          group:'Other Expenses',             nature:'expense',   type:'Expense',       balance:0 },
  { id:'a63', code:'9409', name:'Printing & Stationery',          group:'Other Expenses',             nature:'expense',   type:'Expense',       balance:0 },
  { id:'a64', code:'9410', name:'Insurance Premium',              group:'Other Expenses',             nature:'expense',   type:'Expense',       balance:0 },
  { id:'a65', code:'9411', name:'GST Payment',                    group:'Other Expenses',             nature:'expense',   type:'Expense',       balance:0 },
  { id:'a66', code:'9412', name:'ATM Cash Withdrawal',            group:'Other Expenses',             nature:'expense',   type:'Expense',       balance:0 },
]

const NATURE_COLOR = { asset:'blue', liability:'red', income:'green', expense:'amber' }
const NATURE_LABEL = { asset:'Asset', liability:'Liability', income:'Income', expense:'Expense' }

export default function Accounts() {
  const { activeCompany } = useAuth()
  const [accounts,    setAccounts]    = useState(DEFAULT_ACCOUNTS)
  const [search,      setSearch]      = useState('')
  const [nature,      setNature]      = useState('all')
  const [expanded,    setExpanded]    = useState({})
  const [showModal,   setModal]       = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [apiStatus,   setApiStatus]   = useState('idle') // idle | loaded | failed
  const [newAcc,      setNewAcc]      = useState({ code:'', name:'', nature:'expense', group:'Other Expenses', balance:'' })

  // ── Try to load real balances from the API trial balance endpoint ──────
  const loadRealBalances = async () => {
    if (!activeCompany?.id) return
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res   = await fetch(`/api/v1/reports/${activeCompany.id}/trial-balance`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const rows = data.trial_balance || []

      if (rows.length > 0) {
        // Merge API balances into accounts by account name (fuzzy) or code
        setAccounts(prev => prev.map(acc => {
          const match = rows.find(r =>
            r.name?.toLowerCase() === acc.name.toLowerCase() ||
            r.code === acc.code
          )
          return match ? { ...acc, balance: parseFloat(match.closing_balance || 0) } : acc
        }))
        setApiStatus('loaded')
      } else {
        // No transactions yet — keep all zeros (correct behaviour)
        setApiStatus('loaded')
      }
    } catch {
      // Backend not connected or no DB — keep zeros, show info banner
      setApiStatus('failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRealBalances() }, [activeCompany?.id])

  // ── Add account locally ────────────────────────────────────────────────
  const handleAddAccount = () => {
    if (!newAcc.code || !newAcc.name) return
    const id = `custom_${Date.now()}`
    setAccounts(prev => [...prev, {
      ...newAcc,
      id,
      balance: parseFloat(newAcc.balance || 0),
      type: 'Expense',
    }])
    setNewAcc({ code:'', name:'', nature:'expense', group:'Other Expenses', balance:'' })
    setModal(false)
  }

  // ── Export CSV ─────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = [
      ['Code', 'Account Name', 'Group', 'Type', 'Nature', 'Balance'],
      ...accounts.map(a => [a.code, a.name, a.group, a.type, a.nature, a.balance]),
    ]
    const csv  = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `chart_of_accounts_${new Date().toISOString().slice(0,10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const filtered = accounts.filter(a => {
    const matchN = nature === 'all' || a.nature === nature
    const matchS = !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.code.includes(search) ||
      a.group.toLowerCase().includes(search.toLowerCase())
    return matchN && matchS
  })

  const grouped = filtered.reduce((acc, a) => {
    if (!acc[a.group]) acc[a.group] = []
    acc[a.group].push(a)
    return acc
  }, {})

  const toggle = (g) => setExpanded(e => ({ ...e, [g]: !e[g] }))

  // Totals from actual (API-loaded or zero) data
  const totalAssets      = accounts.filter(a => a.nature === 'asset').reduce((s,a) => s + a.balance, 0)
  const totalLiabilities = accounts.filter(a => a.nature === 'liability').reduce((s,a) => s + a.balance, 0)
  const totalIncome      = accounts.filter(a => a.nature === 'income').reduce((s,a) => s + a.balance, 0)
  const totalExpense     = accounts.filter(a => a.nature === 'expense').reduce((s,a) => s + a.balance, 0)
  const hasAnyBalance    = (totalAssets + totalLiabilities + totalIncome + totalExpense) !== 0

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Chart of Accounts</h1>
          <p className="page-subtitle">Account master — grouped as per Schedule III, Companies Act 2013</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={loadRealBalances} disabled={loading}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button className="btn btn-secondary" onClick={handleExport}><Download size={15}/> Export</button>
          <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={15}/> Add Account</button>
        </div>
      </div>

      {/* ── Data Source Banner ───────────────────────────────────────────── */}
      {!hasAnyBalance && (
        <div style={{ marginBottom: 16, padding: '10px 16px',
          background: 'linear-gradient(135deg,#EFF6FF,#F5F3FF)',
          border: '1px solid #C7D2FE', borderRadius: 8,
          display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Info size={16} color="#2563EB" style={{ marginTop: 1, flexShrink: 0 }} />
          <div style={{ fontSize: 12.5, color: '#1E40AF', lineHeight: 1.6 }}>
            <strong>All balances are ₹0 — this is correct for a new company.</strong>
            {' '}Balances will update automatically when you post journal entries,
            import your bank statement, or set opening balances in <strong>Accounting → Opening Balances</strong>.
          </div>
        </div>
      )}

      {apiStatus === 'failed' && (
        <div style={{ marginBottom: 16, padding: '10px 16px',
          background: '#FFFBEB', border: '1px solid #FDE68A',
          borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center',
          fontSize: 12.5, color: '#92400E' }}>
          <AlertCircle size={15} color="#D97706" style={{ flexShrink: 0 }} />
          Backend not connected — showing account structure only. Balances will load once the backend is deployed.
        </div>
      )}

      {/* ── Summary KPIs ─────────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:12, marginBottom:20 }}>
        {[
          { label:'Total Assets',      value:`₹${fmt(totalAssets)}`,      color:'var(--accent)'   },
          { label:'Total Liabilities', value:`₹${fmt(totalLiabilities)}`, color:'var(--danger)'   },
          { label:'Total Income',      value:`₹${fmt(totalIncome)}`,      color:'var(--success)'  },
          { label:'Total Expenses',    value:`₹${fmt(totalExpense)}`,     color:'var(--warning)'  },
        ].map(s => (
          <div key={s.label} className="card" style={{ flex:1, padding:'14px 18px' }}>
            <div style={{ fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase',
              letterSpacing:'0.07em', color:'var(--text-3)', marginBottom:5 }}>
              {s.label}
            </div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.2rem', fontWeight:700, color:s.color }}>
              {s.value}
            </div>
            {!hasAnyBalance && (
              <div style={{ fontSize:10, color:'var(--text-3)', marginTop:3 }}>No transactions yet</div>
            )}
          </div>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding:'12px 16px', marginBottom:16, display:'flex', gap:10, alignItems:'center' }}>
        <div style={{ position:'relative', flex:1 }}>
          <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-4)' }}/>
          <input className="input" style={{ paddingLeft:32 }}
            placeholder="Search accounts by name, code or group…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {['all','asset','liability','income','expense'].map(n => (
          <button key={n} className={`btn ${nature===n ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding:'6px 14px', fontSize:'0.78rem', textTransform:'capitalize' }}
            onClick={() => setNature(n)}>
            {n === 'all' ? 'All' : NATURE_LABEL[n]}
          </button>
        ))}
      </div>

      {/* ── Account Table ─────────────────────────────────────────────────── */}
      <div className="card" style={{ overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'var(--surface-2)', borderBottom:'1px solid var(--border)' }}>
              {['Code','Account Name','Group','Type','Nature','Balance (₹)',''].map(h => (
                <th key={h} style={{ padding:'10px 14px',
                  textAlign: h==='Balance (₹)' ? 'right' : 'left',
                  fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase',
                  letterSpacing:'0.06em', color:'var(--text-3)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([group, accs]) => {
              const isOpen     = expanded[group] !== false
              const groupTotal = accs.reduce((s,a) => s + a.balance, 0)
              const n          = accs[0]?.nature
              return [
                <tr key={group} onClick={() => toggle(group)}
                  style={{ background:'var(--surface-2)', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
                  <td colSpan={5} style={{ padding:'8px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      {isOpen ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
                      <span style={{ fontWeight:700, fontSize:'0.8rem', color:'var(--text)' }}>{group}</span>
                      <span style={{ fontSize:'0.72rem', color:'var(--text-4)' }}>({accs.length} accounts)</span>
                      {n && <span className={`badge badge-${NATURE_COLOR[n]}`} style={{ marginLeft:4 }}>{NATURE_LABEL[n]}</span>}
                    </div>
                  </td>
                  <td style={{ padding:'8px 14px', textAlign:'right', fontFamily:'var(--font-mono)', fontWeight:700, fontSize:'0.82rem',
                    color: groupTotal !== 0 ? 'var(--text)' : 'var(--text-4)' }}>
                    {groupTotal !== 0 ? `₹${fmt(groupTotal)}` : '—'}
                  </td>
                  <td/>
                </tr>,
                isOpen && accs.map(a => (
                  <tr key={a.id} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'9px 14px 9px 32px', fontFamily:'var(--font-mono)', fontSize:'0.78rem', color:'var(--text-3)' }}>{a.code}</td>
                    <td style={{ padding:'9px 14px', fontSize:'var(--fs-sm)', fontWeight:500, color:'var(--text)' }}>{a.name}</td>
                    <td style={{ padding:'9px 14px', fontSize:'0.78rem', color:'var(--text-3)' }}>{a.group}</td>
                    <td style={{ padding:'9px 14px', fontSize:'0.78rem', color:'var(--text-3)' }}>{a.type}</td>
                    <td style={{ padding:'9px 14px' }}>
                      <span className={`badge badge-${NATURE_COLOR[a.nature]}`}>{NATURE_LABEL[a.nature]}</span>
                    </td>
                    <td style={{ padding:'9px 14px', textAlign:'right', fontFamily:'var(--font-mono)', fontSize:'0.82rem',
                      fontWeight: a.balance !== 0 ? 600 : 400,
                      color: a.balance < 0 ? 'var(--danger)' : a.balance === 0 ? 'var(--text-4)' : 'var(--text)' }}>
                      {a.balance === 0 ? '—' : a.balance < 0 ? `(${fmt(Math.abs(a.balance))})` : fmt(a.balance)}
                    </td>
                    <td style={{ padding:'9px 14px' }}>
                      <button className="btn btn-secondary" style={{ padding:'3px 8px', fontSize:'0.72rem' }}>
                        <Edit2 size={11}/> Edit
                      </button>
                    </td>
                  </tr>
                ))
              ]
            })}
          </tbody>
        </table>
      </div>

      {/* ── Add Account Modal ─────────────────────────────────────────────── */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000,
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div className="card" style={{ width:480, padding:28 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontWeight:700, fontSize:'1.05rem' }}>Add New Account</h2>
              <button onClick={() => setModal(false)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', fontSize:18 }}>✕</button>
            </div>
            <div style={{ display:'grid', gap:14 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:12 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--text-2)', display:'block', marginBottom:5 }}>Account Code *</label>
                  <input className="input" placeholder="e.g. 9415" value={newAcc.code}
                    onChange={e => setNewAcc(p => ({...p, code:e.target.value}))}/>
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--text-2)', display:'block', marginBottom:5 }}>Account Name *</label>
                  <input className="input" placeholder="e.g. Courier Charges" value={newAcc.name}
                    onChange={e => setNewAcc(p => ({...p, name:e.target.value}))}/>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--text-2)', display:'block', marginBottom:5 }}>Nature *</label>
                  <select className="input select" value={newAcc.nature}
                    onChange={e => setNewAcc(p => ({...p, nature:e.target.value}))}>
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'var(--text-2)', display:'block', marginBottom:5 }}>Group *</label>
                  <select className="input select" value={newAcc.group}
                    onChange={e => setNewAcc(p => ({...p, group:e.target.value}))}>
                    {[...new Set(DEFAULT_ACCOUNTS.map(a => a.group))].map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:'var(--text-2)', display:'block', marginBottom:5 }}>
                  Opening Balance (₹) — leave 0 if none
                </label>
                <input className="input" type="number" placeholder="0" value={newAcc.balance}
                  onChange={e => setNewAcc(p => ({...p, balance:e.target.value}))}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 }}>
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddAccount}
                disabled={!newAcc.code || !newAcc.name}>
                <Plus size={14}/> Create Account
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
