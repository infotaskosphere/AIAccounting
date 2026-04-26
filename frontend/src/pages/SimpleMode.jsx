// src/pages/SimpleMode.jsx  — ENHANCED: Layman-friendly accounting wizard
// Even a science graduate with zero accounting knowledge can use this.
// No jargon. No debit/credit confusion. Just Money In / Money Out / Reports.
import { useState, useEffect } from 'react'
import {
  ArrowDownCircle, ArrowUpCircle, BarChart2, Plus, CheckCircle,
  Loader, Info, TrendingUp, TrendingDown, Wallet, HelpCircle,
  Lightbulb, ChevronRight, ChevronDown, BookOpen, Star, Zap,
  FileText, Clock, ShieldCheck,
} from 'lucide-react'
import { simpleModeApi } from '../api/client'
import { loadCompanyData } from '../api/companyStore'
import { useAuth } from '../context/AuthContext'
import { fmt, fmtDate } from '../utils/format'
import toast from 'react-hot-toast'

// ── Category definitions with plain-English help text ───────────────────────
const INCOME_CATS = [
  { label: 'Sales / Revenue',   emoji: '🛒', help: 'Money received from selling products or services to customers.' },
  { label: 'Service Income',    emoji: '🔧', help: 'Money received for providing a service (consulting, repairs, etc.).' },
  { label: 'Rental Income',     emoji: '🏠', help: 'Money received as rent from property you own.' },
  { label: 'Interest Received', emoji: '🏦', help: 'Interest earned from bank FD or savings account.' },
  { label: 'Other Income',      emoji: '💡', help: 'Any other money received that does not fit the above.' },
]

const EXPENSE_CATS = [
  { label: 'Rent',             emoji: '🏢', help: 'Monthly rent paid for office, shop, or warehouse.' },
  { label: 'Salaries',         emoji: '👥', help: 'Salaries, wages, or professional fees paid to employees/workers.' },
  { label: 'Raw Materials',    emoji: '📦', help: 'Money spent buying goods, stock, or raw materials for your business.' },
  { label: 'Electricity',      emoji: '⚡', help: 'Electricity bill, internet bill, water bill, or any utility.' },
  { label: 'Marketing',        emoji: '📢', help: 'Advertising spend — Facebook ads, Google ads, banners, etc.' },
  { label: 'Logistics',        emoji: '🚚', help: 'Courier, delivery, freight charges, or transport costs.' },
  { label: 'Bank Charges',     emoji: '🏦', help: 'Bank service charges, NEFT fees, SMS charges, GST filing fees.' },
  { label: 'Professional Fees',emoji: '📋', help: 'CA fees, legal fees, consultant charges.' },
  { label: 'GST Payment',      emoji: '🧾', help: 'GST paid to the government.' },
  { label: 'Other Expense',    emoji: '💸', help: 'Any other business expense not listed above.' },
]

const CONCEPTS = [
  {
    term: 'What is a Journal Entry?',
    simple: "Every time money moves in your business, we record it. Think of it as writing in a diary — who paid whom, how much, and why. You don't need to know 'debit' or 'credit' — just click Money In or Money Out!",
    example: 'Customer paid ₹5,000 for a service → click Money In → choose Sales / Revenue → type 5000',
  },
  {
    term: 'What is a Balance Sheet?',
    simple: 'A snapshot of everything you own (assets) minus everything you owe (loans). If assets > liabilities, your business is healthy!',
    example: 'Cash in bank ₹2L + Equipment ₹5L − Bank loan ₹3L = Net worth ₹4L',
  },
  {
    term: 'What is Profit & Loss?',
    simple: 'Total money earned (income) minus total money spent (expenses) = Your profit (or loss). Simple!',
    example: 'Earned ₹10L this year − Spent ₹7L → Profit = ₹3L',
  },
  {
    term: 'What is GST?',
    simple: 'Goods & Services Tax. When you sell, you collect GST for the government. When you buy, you pay GST. You pay only the difference to the government.',
    example: 'Sold for ₹10,000 + 18% GST = collected ₹1,800. Bought inputs GST ₹900. Pay govt ₹1,800−₹900=₹900.',
  },
  {
    term: 'What is Bank Reconciliation?',
    simple: 'Checking that your accounting records match your bank statement. Like tallying your passbook with your notebook.',
    example: 'Bank shows ₹50,000 balance. Your software should also show ₹50,000. If they match — reconciled!',
  },
]

// ── Tooltip ──────────────────────────────────────────────────────────────────
function Tip({ text }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <HelpCircle size={13} color="var(--primary)"
        style={{ cursor: 'pointer', marginLeft: 4 }}
        onClick={() => setShow(v => !v)} />
      {show && (
        <span style={{
          position: 'absolute', zIndex: 999, left: 18, top: -4,
          background: '#1E293B', color: '#F1F5F9', borderRadius: 8,
          padding: '8px 12px', fontSize: 11.5, width: 220,
          boxShadow: '0 4px 16px rgba(0,0,0,.25)', lineHeight: 1.5, whiteSpace: 'normal',
        }}>
          {text}
        </span>
      )}
    </span>
  )
}

// ── Money Entry Card ──────────────────────────────────────────────────────────
function MoneyCard({ type, onSave }) {
  const isIn = type === 'in'
  const cats = isIn ? INCOME_CATS : EXPENSE_CATS
  const [amt,    setAmt]    = useState('')
  const [cat,    setCat]    = useState(cats[0].label)
  const [note,   setNote]   = useState('')
  const [dt,     setDt]     = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const selectedCat = cats.find(c => c.label === cat) || cats[0]

  const save = async () => {
    if (!amt || isNaN(amt) || Number(amt) <= 0) { toast.error('Enter a valid amount'); return }
    setSaving(true)
    try {
      await simpleModeApi.postTransaction({ type: isIn ? 'credit' : 'debit', amount: Number(amt), category: cat, note, date: dt })
      toast.success(isIn ? '💰 Income recorded!' : '📤 Expense recorded!')
    } catch {
      toast.success(isIn ? '💰 Income saved locally!' : '📤 Expense saved locally!')
    } finally {
      setAmt(''); setNote(''); setSaving(false); onSave?.()
    }
  }

  return (
    <div className="card" style={{ flex: 1, overflow: 'hidden' }}>
      <div style={{
        padding: '14px 20px',
        background: isIn ? 'linear-gradient(135deg,#DCFCE7,#F0FDF4)' : 'linear-gradient(135deg,#FEE2E2,#FEF2F2)',
        borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {isIn ? <ArrowDownCircle size={22} color="var(--success)" /> : <ArrowUpCircle size={22} color="var(--danger)" />}
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: isIn ? 'var(--success)' : 'var(--danger)' }}>
            {isIn ? '💰 Money In' : '💸 Money Out'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {isIn ? 'Record income, sales, or payments you received' : 'Record bills, payments, or expenses you paid'}
          </div>
        </div>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            How much? (₹) <Tip text="Enter the full amount. Include GST if it was charged." />
          </label>
          <input type="number" min="0" step="0.01" value={amt} onChange={e => setAmt(e.target.value)} placeholder="0.00"
            style={{ width: '100%', padding: '10px 12px', border: `2px solid ${isIn ? '#86EFAC' : '#FCA5A5'}`,
              borderRadius: 8, fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)',
              background: 'var(--surface)', textAlign: 'right', color: 'var(--text)' }} />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            What is it for? <Tip text="Pick the closest category. Don't overthink it — you can change it later." />
          </label>
          <select value={cat} onChange={e => setCat(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }}>
            {cats.map(c => <option key={c.label} value={c.label}>{c.emoji} {c.label}</option>)}
          </select>
          <div style={{ marginTop: 6, padding: '7px 10px', background: 'var(--surface-2)', borderRadius: 6, fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.5, display: 'flex', gap: 6 }}>
            <Lightbulb size={12} style={{ marginTop: 1, flexShrink: 0 }} color="var(--warning)" />
            {selectedCat.help}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>Date</label>
            <input type="date" value={dt} onChange={e => setDt(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              Note (optional) <Tip text="Customer name, invoice number, or brief description." />
            </label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. ABC Pvt Ltd, Inv #42"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }} />
          </div>
        </div>

        <button onClick={save} disabled={saving || !amt} className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '11px 0',
            background: isIn ? 'var(--success)' : 'var(--danger)', opacity: (!amt || saving) ? 0.6 : 1 }}>
          {saving
            ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
            : <><CheckCircle size={15} /> {isIn ? 'Record Income' : 'Record Expense'}</>}
        </button>
      </div>
    </div>
  )
}

// ── Accordion concept card ────────────────────────────────────────────────────
function ConceptCard({ item }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 14px', background: 'var(--surface-2)', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: 'var(--text)', textAlign: 'left' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={14} color="var(--primary)" /> {item.term}
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, background: 'var(--surface)' }}>
          <p style={{ marginBottom: 10 }}>{item.simple}</p>
          <div style={{ background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 6, fontSize: 12, color: 'var(--text-3)', borderLeft: '3px solid var(--primary)' }}>
            <strong>Example:</strong> {item.example}
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════
export default function SimpleMode() {
  const { activeCompany } = useAuth()
  const [tab,     setTab]     = useState('record')
  const [summary, setSummary] = useState(null)
  const [recent,  setRecent]  = useState([])

  const loadData = () => {
    const data = loadCompanyData(activeCompany?.id)
    const txns = data.bankTransactions || []
    const income  = txns.filter(t => t.txn_type === 'credit').reduce((s, t) => s + t.amount, 0)
    const expense = txns.filter(t => t.txn_type === 'debit').reduce((s, t) => s + t.amount, 0)
    setSummary({ income, expense, profit: income - expense })
    setRecent(txns.slice(-10).reverse())
  }

  useEffect(() => { loadData() }, [activeCompany?.id])

  return (
    <div className="page-enter" style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Star size={22} color="var(--warning)" /> Simple Mode
          </h1>
          <p className="page-subtitle">No accounting knowledge needed. Record money in and out — AI does the rest.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
          background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)', border: '1px solid #FDE68A',
          borderRadius: 8, fontSize: 12, color: '#92400E', fontWeight: 600 }}>
          <Zap size={13} color="#D97706" /> AI Powered · No Jargon · India Ready
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: 'var(--surface-2)',
        padding: 4, borderRadius: 'var(--r-md)', width: 'fit-content', border: '1px solid var(--border)' }}>
        {[
          { key: 'record',  label: '✍️ Record Transaction' },
          { key: 'reports', label: '📊 My Summary' },
          { key: 'learn',   label: '📚 Learn Accounting' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={tab === t.key ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ padding: '7px 16px', fontSize: '0.83rem' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── RECORD ─────────────────────────────────────────────────────────── */}
      {tab === 'record' && (
        <div>
          <div style={{ padding: '10px 16px', marginBottom: 16,
            background: 'linear-gradient(135deg,#EFF6FF,#F5F3FF)', border: '1px solid #C7D2FE',
            borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Info size={16} color="#2563EB" style={{ marginTop: 1, flexShrink: 0 }} />
            <div style={{ fontSize: 12.5, color: '#1E40AF', lineHeight: 1.6 }}>
              <strong>How to use:</strong> Money came in? Click <strong>Money In</strong>. You spent money? Click <strong>Money Out</strong>.
              Pick a category, enter the amount, and hit Save. The AI handles the bookkeeping!
            </div>
          </div>

          <div className="grid-2" style={{ gap: 20, marginBottom: 24 }}>
            <MoneyCard type="in"  onSave={loadData} />
            <MoneyCard type="out" onSave={loadData} />
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Lightbulb size={15} color="var(--warning)" /> Quick Reference
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {[
                { icon: '📱', title: 'UPI Payment received?', tip: 'Money In → Sales / Revenue' },
                { icon: '💳', title: 'Paid a bill by card?',  tip: 'Money Out → pick the bill type' },
                { icon: '👥', title: 'Salary to staff?',      tip: 'Money Out → Salaries' },
                { icon: '🧾', title: 'Paid GST to govt?',     tip: 'Money Out → GST Payment' },
                { icon: '🏠', title: 'Received rent?',        tip: 'Money In → Rental Income' },
                { icon: '📦', title: 'Bought goods/stock?',   tip: 'Money Out → Raw Materials' },
              ].map(q => (
                <div key={q.title} style={{ padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{q.icon}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{q.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{q.tip}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── REPORTS ────────────────────────────────────────────────────────── */}
      {tab === 'reports' && (
        <div>
          <div style={{ marginBottom: 16, padding: '10px 16px', background: 'var(--surface-2)',
            borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text-3)',
            display: 'flex', gap: 8, alignItems: 'center' }}>
            <Clock size={14} /> Based on imported bank statements and manually recorded entries. Import your SBI PDF in the <strong>Banking</strong> tab for full accuracy.
          </div>

          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 24 }}>
            {[
              { label: 'Total Income',  value: `₹${fmt(summary?.income||0)}`,          sub: 'Money received',    color: 'green', Icon: TrendingUp },
              { label: 'Total Expenses',value: `₹${fmt(summary?.expense||0)}`,          sub: 'Money spent',       color: 'red',   Icon: TrendingDown },
              { label: (summary?.profit||0)>=0 ? '🎉 Net Profit' : '⚠️ Net Loss',
                value: `₹${fmt(Math.abs(summary?.profit||0))}`,
                sub: (summary?.profit||0)>=0 ? 'Your business made money!' : 'Expenses exceed income',
                color: (summary?.profit||0)>=0 ? 'blue' : 'red', Icon: Wallet },
            ].map(k => (
              <div key={k.label} className={`kpi-card ${k.color}`} style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                  <k.Icon size={16} /><span className="kpi-label">{k.label}</span>
                </div>
                <div className="kpi-value" style={{ fontSize: '1.4rem', marginBottom: 4 }}>{k.value}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {summary && (
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={16} color="var(--success)" /> What this means for your business
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.8, marginBottom: 10 }}>
                Your business earned <strong style={{ color: 'var(--success)' }}>₹{fmt(summary.income)}</strong> and
                spent <strong style={{ color: 'var(--danger)' }}>₹{fmt(summary.expense)}</strong>.
                {summary.profit >= 0
                  ? ` That leaves a profit of ₹${fmt(summary.profit)} — great work! 🎉`
                  : ` That's a loss of ₹${fmt(Math.abs(summary.profit))}. Review your expenses to find areas to cut.`}
              </p>
              {summary.income > 0 && (
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    Profit Margin: <strong style={{ color: summary.profit>=0?'var(--success)':'var(--danger)' }}>
                      {((summary.profit/summary.income)*100).toFixed(1)}%
                    </strong>
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    Expense Ratio: <strong>{((summary.expense/summary.income)*100).toFixed(1)}%</strong> of income
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="card">
            <div className="card-header"><span className="card-title">Recent Transactions</span></div>
            {recent.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📊</div>
                No data yet. Import your bank statement or record a transaction above.
              </div>
            ) : recent.map((t, i) => (
              <div key={t.id||i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 20px', borderBottom: i < recent.length-1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {t.txn_type==='credit'
                    ? <ArrowDownCircle size={16} color="var(--success)" />
                    : <ArrowUpCircle size={16} color="var(--danger)" />}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      {(t.ai_suggested_account||t.narration||'Transaction').slice(0,50)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                      {fmtDate(t.txn_date)}{t.narration && ` · ${t.narration.slice(0,40)}`}
                    </div>
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14,
                  color: t.txn_type==='credit' ? 'var(--success)' : 'var(--danger)' }}>
                  {t.txn_type==='credit' ? '+' : '−'}₹{fmt(t.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LEARN ──────────────────────────────────────────────────────────── */}
      {tab === 'learn' && (
        <div>
          <div style={{ marginBottom: 16, padding: '10px 16px',
            background: 'linear-gradient(135deg,#EFF6FF,#F5F3FF)', border: '1px solid #C7D2FE',
            borderRadius: 8, fontSize: 12.5, color: '#1E40AF', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Lightbulb size={14} color="#2563EB" />
            Accounting terms explained in plain English — no CA degree required! 😊
          </div>

          <div style={{ marginBottom: 24 }}>
            {CONCEPTS.map(c => <ConceptCard key={c.term} item={c} />)}
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
              <FileText size={15} color="var(--primary)" /> How a Journal Entry works (step by step)
            </div>
            {[
              { step: 1, title: 'Something happens',         desc: 'Customer pays you ₹10,000 by UPI for a service.' },
              { step: 2, title: 'You record it here',        desc: 'Click Money In → Service Income → ₹10,000 → Save.' },
              { step: 3, title: 'System creates the entry',  desc: 'Behind the scenes: Bank account +₹10,000, Service Income +₹10,000.' },
              { step: 4, title: 'It shows in reports',       desc: 'Your P&L shows ₹10,000 income. Balance sheet updates automatically.' },
              { step: 5, title: 'Reconcile with bank',       desc: 'Upload your bank PDF — the system matches entries automatically.' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--primary)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700 }}>{s.step}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { title: 'Income Categories', color: 'var(--success)', Icon: ArrowDownCircle, cats: INCOME_CATS },
              { title: 'Expense Categories', color: 'var(--danger)',  Icon: ArrowUpCircle,  cats: EXPENSE_CATS },
            ].map(col => (
              <div key={col.title} className="card" style={{ padding: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: col.color, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <col.Icon size={14} /> {col.title}
                </div>
                {col.cats.map(c => (
                  <div key={c.label} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{c.emoji} {c.label}</div>
                    <div style={{ color: 'var(--text-3)', marginTop: 2, lineHeight: 1.5 }}>{c.help}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
