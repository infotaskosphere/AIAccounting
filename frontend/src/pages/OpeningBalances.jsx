// src/pages/OpeningBalances.jsx — with NEGATIVE balance support
// FIX: Was showing fake template data (₹50,000 cash, ₹4,80,000 bank etc.)
//      Now starts with ONE blank row — user enters their real opening balances.
import { useState, useRef } from 'react'
import { Upload, Download, CheckCircle, AlertTriangle, Info, Plus, Trash2, Save, Minus } from 'lucide-react'
import toast from 'react-hot-toast'
import { loadCompanyData, saveCompanyData } from '../api/companyStore'
import { useAuth } from '../context/AuthContext'

const NATURE_OPTIONS = ['asset','liability','equity','income','expense']
const TYPE_OPTIONS   = ['bank','cash','debtor','creditor','income','expense','tax','capital','fixed_asset','loan','other']
const STORE_KEY      = 'finix_opening_balances'

function computeDrCr(row) {
  const naturalDr = ['asset','expense'].includes(row.nature)
  const isNegative = row.negative
  const isDr = naturalDr ? !isNegative : isNegative
  const balance = Number(row.balance || 0)
  return { isDr, drAmount: isDr ? balance : 0, crAmount: isDr ? 0 : balance }
}

function blankRow() {
  return { code:'', name:'', nature:'asset', type:'bank', balance:'', negative:false }
}

function BalanceRow({ row, idx, onChange, onDelete }) {
  const set = (k, v) => onChange(idx, { ...row, [k]: v })
  const { isDr, drAmount, crAmount } = computeDrCr(row)
  return (
    <tr style={{ borderBottom:'1px solid var(--border)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <td style={{ padding:'6px 10px', width:80 }}>
        <input style={inp} type="text" value={row.code} onChange={e => set('code', e.target.value)} placeholder="1001"/>
      </td>
      <td style={{ padding:'6px 10px' }}>
        <input style={{ ...inp, minWidth:180 }} type="text" value={row.name} onChange={e => set('name', e.target.value)} placeholder="e.g. SBI Bank Account"/>
      </td>
      <td style={{ padding:'6px 10px', width:110 }}>
        <select value={row.nature} onChange={e => set('nature', e.target.value)} style={sel}>
          {NATURE_OPTIONS.map(o => <option key={o}>{o}</option>)}
        </select>
      </td>
      <td style={{ padding:'6px 10px', width:120 }}>
        <select value={row.type} onChange={e => set('type', e.target.value)} style={sel}>
          {TYPE_OPTIONS.map(o => <option key={o}>{o}</option>)}
        </select>
      </td>
      <td style={{ padding:'6px 10px', width:130, textAlign:'right' }}>
        <input type="number" min="0" value={row.balance||''} onChange={e => set('balance', Math.abs(Number(e.target.value)))}
          placeholder="0.00"
          style={{ ...inp, textAlign:'right', width:'100%' }}/>
      </td>
      <td style={{ padding:'6px 10px', width:80, textAlign:'center' }}>
        <button onClick={() => set('negative', !row.negative)}
          title={row.negative ? 'Negative — click to make positive' : 'Positive — click to make negative'}
          style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'4px 8px', borderRadius:4, border:'none', cursor:'pointer', fontSize:11, fontWeight:600,
            background: row.negative ? '#FEE2E2' : '#DCFCE7', color: row.negative ? '#DC2626' : '#16A34A' }}>
          {row.negative ? <><Minus size={10}/> Neg</> : <>+ Pos</>}
        </button>
      </td>
      <td style={{ padding:'6px 10px', width:50, textAlign:'center', fontSize:11, fontWeight:700, color: isDr ? 'var(--success)' : 'var(--danger)' }}>
        {isDr ? 'Dr' : 'Cr'}
      </td>
      <td style={{ padding:'6px 10px', textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--success)' }}>
        {drAmount > 0 ? `₹${drAmount.toLocaleString('en-IN')}` : '—'}
      </td>
      <td style={{ padding:'6px 10px', textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--danger)' }}>
        {crAmount > 0 ? `₹${crAmount.toLocaleString('en-IN')}` : '—'}
      </td>
      <td style={{ padding:'6px 10px', textAlign:'center' }}>
        <button onClick={() => onDelete(idx)} style={{ padding:4, border:'none', background:'none', cursor:'pointer', color:'var(--danger)', borderRadius:4 }}>
          <Trash2 size={13}/>
        </button>
      </td>
    </tr>
  )
}

const inp = { width:'100%', padding:'5px 8px', border:'1px solid var(--border)', borderRadius:'var(--r)', fontSize:13, background:'var(--surface)', color:'var(--text)' }
const sel = { width:'100%', padding:'5px 8px', border:'1px solid var(--border)', borderRadius:'var(--r)', fontSize:13, background:'var(--surface)', color:'var(--text)' }

export default function OpeningBalances() {
  const { activeCompany } = useAuth()

  // Load saved balances — or start with ONE blank row (NOT fake template data)
  const loadSaved = () => {
    try {
      const raw = localStorage.getItem(`${STORE_KEY}_${activeCompany?.id}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch (_) {}
    return [blankRow()]   // ← ONE empty row, not fake numbers
  }

  const [rows,   setRows]   = useState(loadSaved)
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saved,  setSaved]  = useState(false)
  const fileRef = useRef()

  const update = (idx, val) => setRows(prev => prev.map((r, i) => i === idx ? val : r))
  const del    = (idx)      => setRows(prev => prev.filter((_, i) => i !== idx))
  const addRow = ()         => setRows(prev => [...prev, blankRow()])

  // Totals
  const totalDr = rows.reduce((s, r) => s + (computeDrCr(r).drAmount || 0), 0)
  const totalCr = rows.reduce((s, r) => s + (computeDrCr(r).crAmount || 0), 0)
  const diff    = Math.abs(totalDr - totalCr)
  const negRows = rows.filter(r => r.negative)

  const handleSave = () => {
    const valid = rows.filter(r => r.name && Number(r.balance) > 0)
    if (valid.length === 0) { toast.error('Add at least one account with a balance'); return }

    // Save to localStorage (persists across sessions)
    localStorage.setItem(`${STORE_KEY}_${activeCompany?.id}`, JSON.stringify(rows))

    // Also save into companyStore dashboard so it shows on the dashboard
    const data = loadCompanyData(activeCompany?.id)
    const assets      = rows.filter(r => r.nature === 'asset').reduce((s, r) => s + Number(r.balance||0), 0)
    const liabilities = rows.filter(r => r.nature === 'liability').reduce((s, r) => s + Number(r.balance||0), 0)
    const equity      = rows.filter(r => r.nature === 'equity').reduce((s, r) => s + Number(r.balance||0), 0)
    const income      = rows.filter(r => r.nature === 'income').reduce((s, r) => s + Number(r.balance||0), 0)
    const expenses    = rows.filter(r => r.nature === 'expense').reduce((s, r) => s + Number(r.balance||0), 0)
    data.dashboard.balanceSheet = { assets, liabilities, equity, income, expenses, net_profit: income - expenses }
    saveCompanyData(activeCompany?.id, data)

    setSaved(true)
    toast.success(`Opening balances saved (${valid.length} accounts, as of ${asOfDate})`)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleExport = () => {
    const csv = [
      ['Code','Account Name','Nature','Type','Balance','Neg','Dr/Cr'],
      ...rows.map(r => {
        const { isDr } = computeDrCr(r)
        return [r.code, r.name, r.nature, r.type, r.balance, r.negative?'Neg':'Pos', isDr?'Dr':'Cr']
      })
    ].map(r => r.join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' }))
    a.download = `opening_balances_${asOfDate}.csv`; a.click()
  }

  const handleImportCSV = (e) => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const lines = ev.target.result.split('\n').slice(1).filter(Boolean)
      const imported = lines.map(line => {
        const [code, name, nature, type, balance, neg] = line.split(',').map(s => s.trim().replace(/"/g,''))
        return { code, name, nature: NATURE_OPTIONS.includes(nature) ? nature : 'asset', type: TYPE_OPTIONS.includes(type) ? type : 'other', balance: parseFloat(balance)||0, negative: neg === 'Neg' }
      }).filter(r => r.name)
      if (imported.length > 0) { setRows(imported); toast.success(`Imported ${imported.length} accounts`) }
      else toast.error('No valid accounts found in CSV')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Opening Balances</h1>
          <p className="page-subtitle">Enter your balances from your previous software or last balance sheet</p>
        </div>
        <div className="page-actions">
          <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }} onChange={handleImportCSV}/>
          <button className="btn btn-secondary" onClick={() => fileRef.current.click()}><Upload size={14}/> Import CSV</button>
          <button className="btn btn-secondary" onClick={handleExport}><Download size={14}/> Export CSV</button>
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? <><CheckCircle size={14}/> Saved!</> : <><Save size={14}/> Save Opening Balances</>}
          </button>
        </div>
      </div>

      {/* Help banner */}
      <div style={{ marginBottom:16, padding:'10px 16px', background:'linear-gradient(135deg,#EFF6FF,#F5F3FF)', border:'1px solid #C7D2FE', borderRadius:8, display:'flex', gap:10, alignItems:'flex-start' }}>
        <Info size={16} color="#2563EB" style={{ marginTop:1, flexShrink:0 }} />
        <div style={{ fontSize:12.5, color:'#1E40AF', lineHeight:1.7 }}>
          <strong>How to use:</strong> Enter closing balances from your previous software. Toggle <strong>±Neg</strong> for accounts with
          contra/negative balances (e.g. bank overdraft = asset with Cr balance). The Dr/Cr column auto-updates based on nature + negative flag.{' '}
          <a href="#" style={{ color:'#2563EB' }}>Learn about negative balances ↓</a>
        </div>
      </div>

      {/* Date + Totals bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, padding:'12px 16px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <label style={{ fontSize:13, fontWeight:600, color:'var(--text-2)' }}>Opening Balance As Of:</label>
          <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)}
            style={{ padding:'6px 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:13, background:'var(--surface)', color:'var(--text)' }}/>
        </div>
        <div style={{ display:'flex', gap:20, alignItems:'center' }}>
          {negRows.length > 0 && (
            <span style={{ fontSize:12, color:'var(--warning)', display:'flex', alignItems:'center', gap:4 }}>
              <AlertTriangle size={13}/> {negRows.length} negative
            </span>
          )}
          <span style={{ fontSize:13, fontWeight:700, color:'var(--success)' }}>Total Dr: ₹{totalDr.toLocaleString('en-IN')}</span>
          <span style={{ fontSize:13, fontWeight:700, color:'var(--danger)' }}>Total Cr: ₹{totalCr.toLocaleString('en-IN')}</span>
          {diff > 0 && (
            <span style={{ fontSize:12, color:'var(--warning)', display:'flex', alignItems:'center', gap:4 }}>
              <AlertTriangle size={13}/> Diff: ₹{diff.toLocaleString('en-IN')}
            </span>
          )}
          {diff === 0 && totalDr > 0 && (
            <span style={{ fontSize:12, color:'var(--success)', display:'flex', alignItems:'center', gap:4 }}>
              <CheckCircle size={13}/> Balanced ✓
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:16 }}>
        <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid var(--border)' }}>
          <span style={{ fontWeight:700, fontSize:14 }}>
            {rows.length} Account{rows.length !== 1 ? 's' : ''}
            {negRows.length > 0 && <span style={{ marginLeft:8, fontSize:12, color:'var(--warning)', fontWeight:600 }}>{negRows.length} negative</span>}
          </span>
          <button className="btn btn-primary" style={{ padding:'6px 14px', fontSize:13 }} onClick={addRow}>
            <Plus size={14}/> Add Row
          </button>
        </div>

        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'var(--surface-2)', borderBottom:'2px solid var(--border)' }}>
                {['Code','Account Name','Nature','Type','Balance (₹)','±Neg','Dr/Cr','Debit (₹)','Credit (₹)',''].map(h => (
                  <th key={h} style={{ padding:'8px 10px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em',
                    color:'var(--text-3)', textAlign: ['Debit (₹)','Credit (₹)','Balance (₹)'].includes(h) ? 'right' : 'left' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <BalanceRow key={idx} row={row} idx={idx} onChange={update} onDelete={del}/>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding:'10px 16px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end' }}>
          <button className="btn btn-secondary" style={{ fontSize:13 }} onClick={addRow}><Plus size={13}/> Add Another Account</button>
        </div>
      </div>

      {/* Totals + Validation */}
      <div style={{ padding:'12px 16px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontWeight:700, fontSize:14, color:'var(--text-3)' }}>TOTAL</span>
        <div style={{ display:'flex', gap:32 }}>
          <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--success)' }}>₹{totalDr.toLocaleString('en-IN')}</span>
          <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--danger)' }}>₹{totalCr.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {diff > 0 && (
        <div style={{ marginTop:12, padding:'10px 14px', background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, display:'flex', gap:8, alignItems:'center', fontSize:13, color:'#92400E' }}>
          <AlertTriangle size={15} color="#D97706"/>
          Trial balance is out of balance by ₹{diff.toLocaleString('en-IN')}. Add a suspense/difference account or check your entries.
        </div>
      )}
      {diff === 0 && totalDr > 0 && (
        <div style={{ marginTop:12, padding:'10px 14px', background:'#ECFDF5', border:'1px solid #6EE7B7', borderRadius:8, display:'flex', gap:8, alignItems:'center', fontSize:13, color:'#065F46' }}>
          <CheckCircle size={15} color="#059669"/>
          Trial balance is balanced ✓ — click Save Opening Balances to confirm.
        </div>
      )}
    </div>
  )
}
