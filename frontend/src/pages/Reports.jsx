// src/pages/Reports.jsx — P&L, Balance Sheet, Cash Flow (Schedule III / AS-3)
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, TrendingUp, BarChart2, ArrowLeftRight, Info } from 'lucide-react'
import { fmt } from '../utils/format'
import { computeFinancials } from '../api/companyStore'
import { useAuth } from '../context/AuthContext'

// ─── Empty Report (shown when no vouchers posted) ─────────────────────────────
function EmptyReport({ label }) {
  return (
    <div className="card" style={{ padding:'80px 0', textAlign:'center', color:'var(--text-3)' }}>
      <div style={{ fontSize:'2.5rem', marginBottom:12 }}>📈</div>
      <div style={{ fontSize:14, fontWeight:600, marginBottom:6, color:'var(--text-2)' }}>{label} will appear here</div>
      <div style={{ fontSize:12 }}>Post sales, purchase, or payment entries from the Dashboard to generate this report.</div>
    </div>
  )
}

// ─── Real P&L from vouchers ────────────────────────────────────────────────────
function ProfitLoss({ fin }) {
  const Row = ({ label, value, bold, indent, color }) => (
    <tr style={{ borderBottom:'1px solid var(--border)' }}>
      <td style={{ padding:'8px 14px 8px '+(indent?28:14)+'px', fontSize:'0.83rem', fontWeight: bold?700:400, color: color||'var(--text)' }}>{label}</td>
      <td style={{ padding:'8px 14px', textAlign:'right', fontFamily:'var(--font-mono)', fontSize:'0.83rem', fontWeight: bold?700:400, color: color||(value<0?'var(--danger)':'var(--text)') }}>
        {value === 0 ? '—' : (value < 0 ? `(${fmt(Math.abs(value))})` : fmt(value))}
      </td>
      <td style={{ padding:'8px 14px', textAlign:'right', fontFamily:'var(--font-mono)', fontSize:'0.83rem', color:'var(--text-4)' }}>—</td>
    </tr>
  )

  const salesRevenue = fin.vouchers.filter(v=>v.voucher_type==='sales').reduce((s,v)=>s+(Number(v.amount)||0),0)
  const purchases    = fin.vouchers.filter(v=>v.voucher_type==='purchase').reduce((s,v)=>s+(Number(v.amount)||0),0)
  const grossProfit  = salesRevenue - purchases
  const netProfit    = fin.net_profit

  return (
    <div className="card" style={{ overflow:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ background:'var(--surface-2)', borderBottom:'2px solid var(--border)' }}>
            <th style={{ padding:'10px 14px', fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-3)', textAlign:'left' }}>Particulars</th>
            <th style={{ padding:'10px 14px', fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-3)', textAlign:'right' }}>Current Year (₹)</th>
            <th style={{ padding:'10px 14px', fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-3)', textAlign:'right' }}>Previous Year (₹)</th>
          </tr>
        </thead>
        <tbody>
          <Row label="I. REVENUE FROM OPERATIONS" value={salesRevenue} bold/>
          <Row label="   Sales / Services" value={salesRevenue} indent/>
          <Row label="II. OTHER INCOME" value={0} bold/>
          <Row label="III. TOTAL INCOME (I + II)" value={salesRevenue} bold color="var(--success)"/>
          <Row label="IV. EXPENSES" value={0} bold/>
          <Row label="   Cost of Materials / Purchases" value={purchases} indent/>
          <Row label="   Employee Benefit Expenses" value={0} indent/>
          <Row label="   Finance Costs" value={0} indent/>
          <Row label="   Depreciation & Amortisation" value={0} indent/>
          <Row label="   Other Expenses" value={0} indent/>
          <Row label="TOTAL EXPENSES" value={purchases} bold/>
          <Row label="V. PROFIT BEFORE TAX (III – IV)" value={grossProfit} bold color={grossProfit>=0?'var(--success)':'var(--danger)'}/>
          <Row label="   Tax Expense" value={0} indent/>
          <Row label="VI. PROFIT AFTER TAX" value={netProfit} bold color={netProfit>=0?'var(--success)':'var(--danger)'}/>
        </tbody>
      </table>
    </div>
  )
}

// ─── Real Balance Sheet from vouchers ─────────────────────────────────────────
function BalanceSheet({ fin }) {
  const Section = ({ title }) => (
    <tr style={{ background:'var(--surface-2)' }}>
      <td colSpan={3} style={{ padding:'10px 14px', fontWeight:700, fontSize:'0.8rem', textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--text-3)' }}>{title}</td>
    </tr>
  )
  const Row = ({ label, value, bold, indent }) => (
    <tr style={{ borderBottom:'1px solid var(--border)' }}>
      <td style={{ padding:'8px 14px 8px '+(indent?28:14)+'px', fontSize:'0.83rem', fontWeight:bold?700:400 }}>{label}</td>
      <td style={{ padding:'8px 14px', textAlign:'right', fontFamily:'var(--font-mono)', fontSize:'0.83rem', fontWeight:bold?700:400 }}>
        {value === 0 ? '—' : fmt(value)}
      </td>
      <td style={{ padding:'8px 14px', textAlign:'right', fontFamily:'var(--font-mono)', fontSize:'0.83rem', color:'var(--text-4)' }}>—</td>
    </tr>
  )

  const salesAmt   = fin.vouchers.filter(v=>v.voucher_type==='sales').reduce((s,v)=>s+(Number(v.amount)||0),0)
  const receiptAmt = fin.vouchers.filter(v=>v.voucher_type==='receipt').reduce((s,v)=>s+(Number(v.amount)||0),0)
  const payAmt     = fin.vouchers.filter(v=>v.voucher_type==='payment').reduce((s,v)=>s+(Number(v.amount)||0),0)
  const purAmt     = fin.vouchers.filter(v=>v.voucher_type==='purchase').reduce((s,v)=>s+(Number(v.amount)||0),0)

  return (
    <div className="card" style={{ overflow:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ background:'var(--surface-2)', borderBottom:'2px solid var(--border)' }}>
            <th style={{ padding:'10px 14px', fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-3)', textAlign:'left' }}>Particulars</th>
            <th style={{ padding:'10px 14px', fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-3)', textAlign:'right' }}>Current Year (₹)</th>
            <th style={{ padding:'10px 14px', fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-3)', textAlign:'right' }}>Previous Year (₹)</th>
          </tr>
        </thead>
        <tbody>
          <Section title="EQUITY & LIABILITIES"/>
          <Row label="Share Capital" value={0} indent/>
          <Row label="Reserves & Surplus (P&L)" value={fin.net_profit} indent/>
          <Row label="Trade Payables (Creditors)" value={purAmt - payAmt} indent/>
          <Row label="TOTAL EQUITY & LIABILITIES" value={fin.liabilities} bold/>
          <Section title="ASSETS"/>
          <Row label="Trade Receivables (Debtors)" value={salesAmt - receiptAmt} indent/>
          <Row label="Cash & Bank" value={receiptAmt - payAmt} indent/>
          <Row label="TOTAL ASSETS" value={fin.assets} bold color="var(--success)"/>
        </tbody>
      </table>
    </div>
  )
}

// ─── Cash Flow (real) ──────────────────────────────────────────────────────────
function CashFlow({ fin }) {
  const inflow  = fin.vouchers.filter(v=>['sales','receipt'].includes(v.voucher_type)).reduce((s,v)=>s+(Number(v.amount)||0),0)
  const outflow = fin.vouchers.filter(v=>['purchase','payment'].includes(v.voucher_type)).reduce((s,v)=>s+(Number(v.amount)||0),0)
  const net     = inflow - outflow
  const Row = ({ label, value, bold, indent, color }) => (
    <tr style={{ borderBottom:'1px solid var(--border)' }}>
      <td style={{ padding:'8px 14px 8px '+(indent?28:14)+'px', fontSize:'0.83rem', fontWeight:bold?700:400 }}>{label}</td>
      <td style={{ padding:'8px 14px', textAlign:'right', fontFamily:'var(--font-mono)', fontSize:'0.83rem', fontWeight:bold?700:400, color:color||(value<0?'var(--danger)':'var(--text)') }}>
        {value === 0 ? '—' : (value<0?`(${fmt(Math.abs(value))})`:fmt(value))}
      </td>
    </tr>
  )
  return (
    <div className="card" style={{ overflow:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ background:'var(--surface-2)', borderBottom:'2px solid var(--border)' }}>
            <th style={{ padding:'10px 14px', fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-3)', textAlign:'left' }}>Particulars</th>
            <th style={{ padding:'10px 14px', fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-3)', textAlign:'right' }}>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          <Row label="A. CASH FLOW FROM OPERATING ACTIVITIES" bold value={0}/>
          <Row label="   Cash receipts from customers" value={inflow} indent/>
          <Row label="   Cash paid to suppliers / employees" value={-outflow} indent/>
          <Row label="Net Cash from Operations" value={net} bold color={net>=0?'var(--success)':'var(--danger)'}/>
          <Row label="B. CASH FLOW FROM INVESTING ACTIVITIES" bold value={0}/>
          <Row label="   No investing activities" value={0} indent/>
          <Row label="C. CASH FLOW FROM FINANCING ACTIVITIES" bold value={0}/>
          <Row label="   No financing activities" value={0} indent/>
          <Row label="NET CHANGE IN CASH" value={net} bold color={net>=0?'var(--success)':'var(--danger)'}/>
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Reports() {
  const { activeCompany } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'pl'

  const fin = computeFinancials(activeCompany?.id)
  const isSampleData = !fin.hasRealData

  const TABS = [
    { key:'pl',            label:'P & L Statement',  icon:TrendingUp },
    { key:'balance-sheet', label:'Balance Sheet',     icon:BarChart2 },
    { key:'cashflow',      label:'Cash Flow',         icon:ArrowLeftRight },
  ]

  const subtitles = {
    'pl':            'Statement of Profit & Loss — Schedule III, Part II',
    'balance-sheet': 'Balance Sheet as at 31st March 2024 — Schedule III, Part I',
    'cashflow':      'Cash Flow Statement (Indirect Method) — AS-3 / Ind AS-7',
  }

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Reports</h1>
          <p className="page-subtitle">{subtitles[tab]} · {activeCompany?.name} · {activeCompany?.fy}</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Download size={15}/> Export PDF</button>
          <button className="btn btn-secondary"><Download size={15}/> Export Excel</button>
        </div>
      </div>

      {/* Sample data banner */}
      {isSampleData && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:10, marginBottom:16, fontSize:13 }}>
          <Info size={15} color="#D97706"/>
          <span style={{ color:'#92400E' }}><strong>Sample Data</strong> — No real vouchers posted yet. This report shows demo data. Post entries from the Dashboard to see your actual financials.</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, marginBottom:20, background:'var(--surface-2)', padding:4, borderRadius:'var(--r-md)', width:'fit-content', border:'1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.key}
            onClick={() => setSearchParams({ tab: t.key })}
            className={tab===t.key ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 16px', fontSize:'0.83rem' }}>
            <t.icon size={14}/> {t.label}
          </button>
        ))}
      </div>

      {tab === 'pl'            && (isSampleData ? <EmptyReport label="Profit & Loss Statement" /> : <ProfitLoss fin={fin}/>)}
      {tab === 'balance-sheet' && (isSampleData ? <EmptyReport label="Balance Sheet" /> : <BalanceSheet fin={fin}/>)}
      {tab === 'cashflow'      && (isSampleData ? <EmptyReport label="Cash Flow Statement" /> : <CashFlow fin={fin}/>)}
    </div>
  )
}
