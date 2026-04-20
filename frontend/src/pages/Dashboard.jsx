// src/pages/Dashboard.jsx
import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard,
  Wallet, BarChart2, AlertTriangle, Info, CheckCircle,
  ArrowRight, X, Plus, Zap, Activity
} from 'lucide-react'
import { getCompanyData } from '../api/mockData'
import { fmt, fmtCr, fmtDate } from '../utils/format'
import { useAuth } from '../context/AuthContext'

const vBadge = {
  sales:'badge-green', purchase:'badge-red',
  receipt:'badge-blue', payment:'badge-amber', journal:'badge-gray',
}

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#1F2937', color:'#F9FAFB', borderRadius:6, padding:'9px 12px', fontSize:12, boxShadow:'0 4px 12px rgba(0,0,0,.2)' }}>
      <div style={{ color:'#9CA3AF', marginBottom:6, fontWeight:600 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:3 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:p.color }} />
          <span style={{ color:'#D1D5DB', textTransform:'capitalize' }}>{p.name}:</span>
          <span style={{ fontWeight:600 }}>₹{(p.value/100000).toFixed(1)}L</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { activeCompany } = useAuth()
  const data   = getCompanyData(activeCompany?.id).dashboard
  const [dismissed, setDismissed] = useState([])
  const alerts = data.alerts.filter((_,i) => !dismissed.includes(`${activeCompany?.id}-${i}`))
  const dismissAlert = (i) => setDismissed(d => [...d, `${activeCompany?.id}-${i}`])
  const [modal,  setModal]  = useState(false)
  const bs = data.balanceSheet

  return (
    <div className="page-wrap page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">{activeCompany?.name} · Financial snapshot · March 2024</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Activity size={13} /> Export PDF</button>
          <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={13} /> New Entry</button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="alerts-wrap">
          {alerts.map((al, i) => (
            <div key={i} className={`alert-bar ${al.type === 'warning' ? 'warn' : al.type === 'success' ? 'succ' : 'info'}`}>
              {al.type === 'warning' && <AlertTriangle size={14} />}
              {al.type === 'info'    && <Info size={14} />}
              {al.type === 'success' && <CheckCircle size={14} />}
              <span className="al-msg">{al.message}</span>
              {al.action && <button className="al-act">{al.action} →</button>}
              <button className="al-x" onClick={() => dismissAlert(i)}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* AI strip */}
      <div className="ai-strip">
        <div className="ai-badge"><Zap size={10} /> AI</div>
        <span style={{ color:'var(--text-2)' }}>
          <strong style={{ color:'var(--text)' }}>94 transactions</strong> auto-classified today with{' '}
          <strong style={{ color:'var(--success)' }}>98% accuracy</strong> · Rule-based + fuzzy matching engine active
        </span>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {[
          { label:'Total Revenue',  value: fmtCr(bs.income),      icon:DollarSign, color:'blue',   trend:'+18% vs last year', dir:'up' },
          { label:'Net Profit',     value: fmtCr(bs.net_profit),  icon:TrendingUp, color:'green',  trend:`Margin ${((bs.net_profit/bs.income)*100).toFixed(1)}%`, dir:'up' },
          { label:'Total Assets',   value: fmtCr(bs.assets),      icon:Wallet,     color:'purple', trend:'Incl. receivables', dir:'up' },
          { label:'Net Payables',   value: fmtCr(bs.liabilities), icon:CreditCard, color:'red',    trend:'Creditors + tax', dir:'down' },
        ].map(k => (
          <div key={k.label} className={`kpi-card ${k.color}`}>
            <div className="kpi-header">
              <div className="kpi-label">{k.label}</div>
              <div className={`kpi-icon ${k.color}`}><k.icon size={14} /></div>
            </div>
            <div className="kpi-value">{k.value}</div>
            <span className={`kpi-trend ${k.dir}`}>
              {k.dir==='up' ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
              {k.trend}
            </span>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid-2" style={{ marginBottom:16 }}>
        <div className="card">
          <div className="card-head">
            <span className="card-title">Cash Flow — Last 6 Months</span>
            <span className="badge badge-blue">Monthly</span>
          </div>
          <div className="card-body" style={{ paddingTop:8 }}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.cashflow} margin={{ top:5, right:5, left:-15, bottom:0 }}>
                <defs>
                  <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2563EB" stopOpacity={.15}/>
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="go" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#B91C1C" stopOpacity={.1}/>
                    <stop offset="95%" stopColor="#B91C1C" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false}/>
                <XAxis dataKey="month" tick={{ fontSize:11, fill:'#9CA3AF', fontFamily:'IBM Plex Sans' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:11, fill:'#9CA3AF', fontFamily:'IBM Plex Sans' }} axisLine={false} tickLine={false} tickFormatter={v=>`₹${(v/100000).toFixed(0)}L`}/>
                <Tooltip content={<TT/>}/>
                <Legend wrapperStyle={{ fontSize:11, paddingTop:10, fontFamily:'IBM Plex Sans' }}/>
                <Area type="monotone" dataKey="inflow"  stroke="#2563EB" strokeWidth={2} fill="url(#gi)" name="inflow"/>
                <Area type="monotone" dataKey="outflow" stroke="#B91C1C" strokeWidth={1.5} fill="url(#go)" name="outflow"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">Revenue vs Expenses</span>
            <span className="badge badge-green">FY 2024-25</span>
          </div>
          <div className="card-body" style={{ paddingTop:8 }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.cashflow} margin={{ top:5, right:5, left:-15, bottom:0 }} barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false}/>
                <XAxis dataKey="month" tick={{ fontSize:11, fill:'#9CA3AF', fontFamily:'IBM Plex Sans' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:11, fill:'#9CA3AF', fontFamily:'IBM Plex Sans' }} axisLine={false} tickLine={false} tickFormatter={v=>`₹${(v/100000).toFixed(0)}L`}/>
                <Tooltip content={<TT/>}/>
                <Legend wrapperStyle={{ fontSize:11, paddingTop:10, fontFamily:'IBM Plex Sans' }}/>
                <Bar dataKey="inflow"  fill="#2563EB" radius={[3,3,0,0]} name="revenue"/>
                <Bar dataKey="outflow" fill="#E5E7EB" radius={[3,3,0,0]} name="expenses"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:16 }}>
        {/* Left panels */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* Balance sheet */}
          <div className="card">
            <div className="card-head"><span className="card-title">Balance Sheet Summary</span></div>
            <div className="card-body">
              {[
                { label:'Assets',      value:bs.assets,      color:'var(--accent)' },
                { label:'Liabilities', value:bs.liabilities, color:'var(--danger)' },
                { label:'Equity',      value:bs.equity,      color:'var(--success)' },
              ].map(r => (
                <div key={r.label} style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:'var(--fs-sm)', color:'var(--text-2)' }}>{r.label}</span>
                    <span className="mono-val" style={{ fontWeight:600, color:'var(--text)' }}>{fmtCr(r.value)}</span>
                  </div>
                  <div className="prog-wrap">
                    <div className="prog-fill" style={{ width:`${(r.value/bs.assets)*100}%`, background:r.color }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reconciliation */}
          <div className="card">
            <div className="card-head">
              <span className="card-title">Bank Reconciliation</span>
              <span className="badge badge-amber">12 pending</span>
            </div>
            <div className="card-body">
              {[
                { label:'Auto-matched',    pct:71, color:'var(--success)' },
                { label:'Needs review',    pct:18, color:'var(--warning)' },
                { label:'Manual required', pct:11, color:'var(--danger)' },
              ].map(r => (
                <div key={r.label} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:'var(--fs-xs)', color:'var(--text-3)' }}>{r.label}</span>
                    <span style={{ fontSize:'var(--fs-xs)', fontWeight:700, color:r.color }}>{r.pct}%</span>
                  </div>
                  <div className="prog-wrap">
                    <div className="prog-fill" style={{ width:`${r.pct}%`, background:r.color }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent transactions */}
        <div className="tbl-wrap">
          <div className="tbl-toolbar">
            <span style={{ fontWeight:600, fontSize:'var(--fs-md)', flex:1 }}>Recent Transactions</span>
            <button className="btn btn-ghost btn-sm">View all <ArrowRight size={11}/></button>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Voucher No.</th>
                <th>Narration</th>
                <th>Type</th>
                <th>Date</th>
                <th style={{ textAlign:'right' }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {data.recentVouchers.map(v => (
                <tr key={v.id}>
                  <td><span style={{ fontFamily:'var(--mono)', fontSize:'var(--fs-xs)', color:'var(--accent)', fontWeight:600 }}>{v.voucher_no}</span></td>
                  <td style={{ maxWidth:220 }}><span style={{ display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.narration}</span></td>
                  <td><span className={`badge ${vBadge[v.voucher_type]||'badge-gray'}`} style={{ textTransform:'capitalize' }}>{v.voucher_type}</span></td>
                  <td style={{ color:'var(--text-4)', fontSize:'var(--fs-xs)', whiteSpace:'nowrap' }}>{fmtDate(v.date)}</td>
                  <td style={{ textAlign:'right' }}>
                    <span className={['sales','receipt'].includes(v.voucher_type)?'cr':'dr'}>
                      {['sales','receipt'].includes(v.voucher_type)?'+':'-'}₹{fmt(v.amount)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Entry Modal */}
      {modal && (
        <div className="overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">New Journal Entry</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setModal(false)}><X size={17}/></button>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label className="field-label">Voucher Type</label>
                <select className="input select">
                  <option>Sales Invoice</option><option>Purchase Invoice</option>
                  <option>Payment Voucher</option><option>Receipt Voucher</option>
                  <option>Journal Voucher</option><option>Contra</option>
                </select>
              </div>
              <div className="input-group">
                <div className="field-group">
                  <label className="field-label">Date</label>
                  <input type="date" className="input" defaultValue="2024-03-28"/>
                </div>
                <div className="field-group">
                  <label className="field-label">Reference No.</label>
                  <input type="text" className="input" placeholder="INV-0001"/>
                </div>
              </div>
              <div className="field-group">
                <label className="field-label">Narration</label>
                <input type="text" className="input" placeholder="Describe the transaction"/>
              </div>
              <div className="field-group">
                <label className="field-label">Amount (₹)</label>
                <input type="number" className="input" placeholder="0.00"/>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => setModal(false)}>Post Voucher</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
