// src/pages/SimpleMode.jsx
// Layman-friendly accounting: no jargon, just Money In / Money Out / Reports
import { useState, useEffect } from 'react'
import { ArrowDownCircle, ArrowUpCircle, BarChart2, Plus, CheckCircle, Loader, Info, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { simpleModeApi, reportingApi } from '../api/client'
import toast from 'react-hot-toast'

const INCOME_CATS  = ['Sales / Revenue', 'Service Income', 'Rental Income', 'Interest Received', 'Other Income']
const EXPENSE_CATS = ['Rent', 'Salaries', 'Raw Materials', 'Electricity', 'Marketing', 'Logistics', 'Bank Charges', 'Other Expense']

function MoneyCard({ type, onSave }) {
  const isIn = type === 'in'
  const [amt, setAmt]  = useState('')
  const [cat, setCat]  = useState(isIn ? INCOME_CATS[0] : EXPENSE_CATS[0])
  const [note, setNote] = useState('')
  const [dt,   setDt]   = useState(new Date().toISOString().slice(0,10))
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!amt || isNaN(amt) || Number(amt) <= 0) { toast.error('Enter a valid amount'); return }
    setSaving(true)
    try {
      await simpleModeApi.postTransaction({
        type: isIn ? 'credit' : 'debit',
        amount: Number(amt),
        category: cat,
        note,
        date: dt,
      })
      toast.success(isIn ? '💰 Income recorded!' : '📤 Expense recorded!')
      setAmt(''); setNote('')
      onSave?.()
    } catch {
      toast.error('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ flex:1, overflow:'hidden' }}>
      <div style={{
        padding:'14px 20px',
        background: isIn ? 'linear-gradient(135deg,#DCFCE7,#F0FDF4)' : 'linear-gradient(135deg,#FEE2E2,#FEF2F2)',
        borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', gap:10,
      }}>
        {isIn ? <ArrowDownCircle size={22} color="var(--success)" /> : <ArrowUpCircle size={22} color="var(--danger)" />}
        <div>
          <div style={{ fontWeight:700, fontSize:15, color: isIn ? 'var(--success)' : 'var(--danger)' }}>
            {isIn ? 'Money In' : 'Money Out'}
          </div>
          <div style={{ fontSize:11, color:'var(--text-3)' }}>
            {isIn ? 'Record income, sales, or receipts' : 'Record payments, expenses, or bills'}
          </div>
        </div>
      </div>

      <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:'var(--text-2)', display:'block', marginBottom:6 }}>
            How much? (₹)
          </label>
          <input
            type="number" min="0" step="0.01"
            value={amt}
            onChange={e => setAmt(e.target.value)}
            placeholder="0.00"
            style={{ width:'100%', padding:'10px 12px', border:`2px solid ${isIn ? 'var(--success-b)' : 'var(--danger-b)'}`, borderRadius:8, fontSize:20, fontWeight:700, fontFamily:'var(--mono)', background:'var(--surface)', textAlign:'right', color:'var(--text)' }}
          />
        </div>

        <div>
          <label style={{ fontSize:12, fontWeight:600, color:'var(--text-2)', display:'block', marginBottom:6 }}>
            What is it for?
          </label>
          <select
            value={cat}
            onChange={e => setCat(e.target.value)}
            style={{ width:'100%', padding:'9px 12px', border:'1px solid var(--border)', borderRadius:8, fontSize:13, background:'var(--surface)', color:'var(--text)' }}
          >
            {(isIn ? INCOME_CATS : EXPENSE_CATS).map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'var(--text-2)', display:'block', marginBottom:6 }}>Date</label>
            <input type="date" value={dt} onChange={e => setDt(e.target.value)}
              style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:13, background:'var(--surface)', color:'var(--text)' }} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'var(--text-2)', display:'block', marginBottom:6 }}>Note (optional)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Client name"
              style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8, fontSize:13, background:'var(--surface)', color:'var(--text)' }} />
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          style={{
            width:'100%', padding:'11px 0', border:'none', borderRadius:8, cursor:'pointer',
            background: isIn ? 'var(--success)' : 'var(--danger)', color:'#fff',
            fontWeight:700, fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            transition:'opacity .15s',
          }}
        >
          {saving ? <Loader size={14} /> : <Plus size={14} />}
          {saving ? 'Saving...' : `Record ${isIn ? 'Income' : 'Expense'}`}
        </button>
      </div>
    </div>
  )
}

function QuickStat({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="card" style={{ padding:'16px 20px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:4 }}>{label}</div>
          <div style={{ fontSize:22, fontWeight:800, color, fontFamily:'var(--mono)' }}>₹{Number(value||0).toLocaleString('en-IN', {maximumFractionDigits:0})}</div>
          {sub && <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>{sub}</div>}
        </div>
        <div style={{ width:40, height:40, borderRadius:10, background:`${color}20`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={20} color={color} />
        </div>
      </div>
    </div>
  )
}

export default function SimpleMode() {
  const [stats, setStats] = useState(null)
  const [tip,   setTip]   = useState('')

  const load = async () => {
    try {
      const res = await reportingApi.getDashboard()
      const d = res.data?.data || res.data
      setStats(d)

      // Generate plain-language tip
      if (d?.net_profit < 0) {
        setTip('⚠️ You spent more than you earned this month. Consider reviewing your expenses.')
      } else if (d?.net_profit > 0) {
        const margin = d.profit_margin || 0
        setTip(`✅ Your business is profitable this month! Profit margin: ${margin.toFixed(1)}%. Keep it up!`)
      }
    } catch {}
  }

  useEffect(() => { load() }, [])

  return (
    <div className="page-wrap page-enter">
      <div style={{ maxWidth:900, margin:'0 auto' }}>
        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <h1 style={{ fontSize:24, fontWeight:800, marginBottom:6 }}>Your Business Finances</h1>
          <p style={{ color:'var(--text-3)', fontSize:14 }}>Simple view — record money in, money out, and see how you're doing</p>
        </div>

        {/* AI tip */}
        {tip && (
          <div style={{ marginBottom:20, padding:'12px 16px', background:'linear-gradient(135deg,var(--primary-l),#F5F3FF)', borderRadius:10, border:'1px solid var(--primary-m)', fontSize:13, display:'flex', gap:10, alignItems:'flex-start' }}>
            <Info size={16} color="var(--accent)" style={{ flexShrink:0, marginTop:1 }} />
            <span>{tip}</span>
          </div>
        )}

        {/* Quick stats */}
        {stats && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
            <QuickStat label="Money In (This Month)"  value={stats.monthly_revenue}  icon={TrendingUp}   color="var(--success)" />
            <QuickStat label="Money Out (This Month)" value={stats.monthly_expenses} icon={TrendingDown}  color="var(--danger)" />
            <QuickStat label="Profit This Month"       value={stats.net_profit}       icon={Wallet}        color={stats.net_profit >= 0 ? 'var(--success)' : 'var(--danger)'}
              sub={stats.net_profit >= 0 ? 'Great job!' : 'Loss — review expenses'} />
          </div>
        )}

        {/* Money In / Out cards */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
          <MoneyCard type="in"  onSave={load} />
          <MoneyCard type="out" onSave={load} />
        </div>

        {/* View Reports CTA */}
        <div className="card" style={{ padding:20, display:'flex', alignItems:'center', justifyContent:'space-between', background:'linear-gradient(135deg,#1E3A8A,#312E81)', color:'#fff' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <BarChart2 size={24} color="#93C5FD" />
            <div>
              <div style={{ fontWeight:700, fontSize:14 }}>See Your Full Business Report</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,.7)' }}>Profit, cash flow, and what you owe — all explained simply</div>
            </div>
          </div>
          <button
            onClick={() => window.location.href='/reports'}
            style={{ padding:'9px 20px', background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.3)', borderRadius:8, color:'#fff', cursor:'pointer', fontWeight:600, fontSize:13, transition:'background .15s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.25)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.15)'}
          >
            View Reports →
          </button>
        </div>

        {/* Recent transactions */}
        <div className="card" style={{ marginTop:16, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontWeight:600, fontSize:13 }}>Recent Activity</div>
          <RecentList />
        </div>
      </div>
    </div>
  )
}

function RecentList() {
  const [items, setItems] = useState([])
  useEffect(() => {
    simpleModeApi.getRecent().then(r => setItems(r.data?.data || [])).catch(() => {})
  }, [])

  if (!items.length) return (
    <div style={{ padding:24, textAlign:'center', color:'var(--text-3)', fontSize:13 }}>
      No transactions yet. Start by recording money in or out above.
    </div>
  )

  return (
    <div>
      {items.slice(0, 8).map((t, i) => (
        <div key={i} style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background: t.txn_type === 'credit' ? 'var(--success-l)' : 'var(--danger-l)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {t.txn_type === 'credit' ? <ArrowDownCircle size={14} color="var(--success)" /> : <ArrowUpCircle size={14} color="var(--danger)" />}
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:500 }}>{t.narration || t.category}</div>
              <div style={{ fontSize:11, color:'var(--text-3)' }}>{t.txn_date}</div>
            </div>
          </div>
          <div style={{ fontWeight:700, fontFamily:'var(--mono)', color: t.txn_type === 'credit' ? 'var(--success)' : 'var(--danger)', fontSize:14 }}>
            {t.txn_type === 'credit' ? '+' : '-'}₹{Number(t.amount).toLocaleString('en-IN')}
          </div>
        </div>
      ))}
    </div>
  )
}
