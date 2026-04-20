// src/pages/TrialBalance.jsx — Trial Balance from real vouchers (zero/empty when no data)
import { useState } from 'react'
import { Download, Search, AlertCircle, CheckCircle, Info } from 'lucide-react'
import { fmt } from '../utils/format'
import { computeFinancials } from '../api/companyStore'
import { useAuth } from '../context/AuthContext'

const Col = ({ children, right, bold, mono, small, color }) => (
  <td style={{
    padding:'8px 14px', textAlign: right ? 'right' : 'left',
    fontWeight: bold ? 700 : 400,
    fontFamily: mono ? 'var(--font-mono)' : 'inherit',
    fontSize: small ? '0.72rem' : '0.82rem',
    color: color || 'var(--text)',
    borderBottom:'1px solid var(--border)',
  }}>{children}</td>
)

function NumCell({ v, bold, border, highlight }) {
  return (
    <td style={{
      padding:'8px 14px', textAlign:'right',
      fontFamily:'var(--font-mono)', fontSize:'0.82rem',
      fontWeight: bold ? 700 : 400,
      borderRight: border ? '1px solid var(--border)' : undefined,
      background: highlight ? 'var(--primary-l)' : undefined,
      color: v === 0 ? 'var(--text-4)' : 'var(--text)',
    }}>
      {v === 0 ? '—' : fmt(v)}
    </td>
  )
}

const th = {
  padding:'9px 14px', fontSize:'0.72rem', fontWeight:700,
  textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-3)',
  textAlign:'left', whiteSpace:'nowrap',
}

export default function TrialBalance() {
  const { activeCompany } = useAuth()
  const [search, setSearch] = useState('')

  const fin = computeFinancials(activeCompany?.id)
  const hasData = fin.hasRealData
  const tbData  = fin.trialBalance  // empty array when no vouchers

  const filtered = tbData.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.code.includes(search)
  )

  const totClDr = filtered.reduce((s,r) => s + r.clDr, 0)
  const totClCr = filtered.reduce((s,r) => s + r.clCr, 0)
  const totTxDr = filtered.reduce((s,r) => s + r.txDr, 0)
  const totTxCr = filtered.reduce((s,r) => s + r.txCr, 0)
  const balanced = hasData && Math.abs(totClDr - totClCr) < 1

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Trial Balance</h1>
          <p className="page-subtitle">
            {activeCompany?.name} · {activeCompany?.fy} · All amounts in ₹
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Download size={15}/> Export PDF</button>
          <button className="btn btn-secondary"><Download size={15}/> Export Excel</button>
        </div>
      </div>

      {/* No data state */}
      {!hasData && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 18px', background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:10, marginBottom:16 }}>
          <Info size={16} color="#D97706"/>
          <div>
            <div style={{ fontWeight:700, fontSize:13, color:'#92400E' }}>No transactions yet</div>
            <div style={{ fontSize:12, color:'#B45309', marginTop:2 }}>
              Post vouchers from the Dashboard to populate your Trial Balance. The table will show real debit/credit entries once data is entered.
            </div>
          </div>
        </div>
      )}

      {/* Balanced indicator — only show when there's real data */}
      {hasData && (
        <div className={`alert-banner ${balanced ? 'success' : 'error'}`} style={{ marginBottom:20 }}>
          {balanced ? <CheckCircle size={15}/> : <AlertCircle size={15}/>}
          <span className="alert-msg">
            {balanced
              ? `Trial Balance is balanced — Total Dr = Total Cr = ₹${fmt(totClDr)}`
              : `Trial Balance is NOT balanced — Dr: ₹${fmt(totClDr)} | Cr: ₹${fmt(totClCr)} | Diff: ₹${fmt(Math.abs(totClDr - totClCr))}`}
          </span>
        </div>
      )}

      {/* Search */}
      <div className="card" style={{ padding:'10px 14px', marginBottom:16, display:'flex', gap:10 }}>
        <div style={{ position:'relative', flex:1 }}>
          <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-4)' }}/>
          <input className="input" style={{ paddingLeft:32 }} placeholder="Search accounts…"
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
      </div>

      {/* Table */}
      {hasData ? (
        <div className="card" style={{ overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
            <thead>
              <tr style={{ background:'var(--surface-2)' }}>
                <th rowSpan={2} style={{ ...th, width:80, borderRight:'1px solid var(--border)' }}>Code</th>
                <th rowSpan={2} style={{ ...th, borderRight:'1px solid var(--border)' }}>Account Name</th>
                <th rowSpan={2} style={{ ...th, borderRight:'1px solid var(--border)' }}>Group</th>
                <th colSpan={2} style={{ ...th, textAlign:'center', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>Opening Balance</th>
                <th colSpan={2} style={{ ...th, textAlign:'center', borderRight:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>Transactions</th>
                <th colSpan={2} style={{ ...th, textAlign:'center', borderBottom:'1px solid var(--border)' }}>Closing Balance</th>
              </tr>
              <tr style={{ background:'var(--surface-2)' }}>
                {['Dr','Cr','Dr','Cr','Dr','Cr'].map((h,i) => (
                  <th key={i} style={{ ...th, textAlign:'right', borderRight: i===1||i===3 ? '1px solid var(--border)' : undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.code} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'8px 14px', fontFamily:'var(--font-mono)', fontSize:'0.78rem', color:'var(--text-3)', borderRight:'1px solid var(--border)' }}>{r.code}</td>
                  <td style={{ padding:'8px 14px', fontSize:'0.82rem', fontWeight:500, borderRight:'1px solid var(--border)' }}>{r.name}</td>
                  <td style={{ padding:'8px 14px', fontSize:'0.75rem', color:'var(--text-3)', borderRight:'1px solid var(--border)' }}>{r.group}</td>
                  <NumCell v={r.opDr}/><NumCell v={r.opCr} border/>
                  <NumCell v={r.txDr}/><NumCell v={r.txCr} border/>
                  <NumCell v={r.clDr} bold/><NumCell v={r.clCr} bold/>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background:'var(--surface-2)', borderTop:'2px solid var(--border)' }}>
                <td colSpan={3} style={{ padding:'10px 14px', fontWeight:700, fontSize:'0.82rem' }}>TOTAL</td>
                <NumCell v={filtered.reduce((s,r)=>s+r.opDr,0)} bold/>
                <NumCell v={filtered.reduce((s,r)=>s+r.opCr,0)} bold border/>
                <NumCell v={totTxDr} bold/>
                <NumCell v={totTxCr} bold border/>
                <NumCell v={totClDr} bold highlight/>
                <NumCell v={totClCr} bold highlight/>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="card" style={{ padding:'64px 0', textAlign:'center', color:'var(--text-3)' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:12 }}>📊</div>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>Trial Balance will appear here</div>
          <div style={{ fontSize:12 }}>Post your first sales or purchase entry from the Dashboard</div>
        </div>
      )}
    </div>
  )
}
