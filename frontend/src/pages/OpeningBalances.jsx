// src/pages/OpeningBalances.jsx — with NEGATIVE balance support
import { useState, useRef } from 'react'
import { Upload, Download, CheckCircle, AlertTriangle, Info, Plus, Trash2, X, Save, Minus } from 'lucide-react'
import toast from 'react-hot-toast'

const NATURE_OPTIONS  = ['asset','liability','equity','income','expense']
const TYPE_OPTIONS    = ['bank','cash','debtor','creditor','income','expense','tax','capital','fixed_asset','other']

function computeDrCr(row) {
  const naturalDr = ['asset','expense'].includes(row.nature)
  const isNegative = row.negative
  const isDr = naturalDr ? !isNegative : isNegative
  const balance = Number(row.balance || 0)
  return { isDr, drAmount: isDr ? balance : 0, crAmount: isDr ? 0 : balance }
}

const TEMPLATE_ROWS = [
  { code:'1001', name:'Cash in Hand',        nature:'asset',     type:'cash',    balance:50000,   negative:false },
  { code:'1002', name:'Bank - SBI Current',  nature:'asset',     type:'bank',    balance:480000,  negative:false },
  { code:'1003', name:'Bank OD Account',     nature:'asset',     type:'bank',    balance:120000,  negative:true  },
  { code:'2001', name:'Share Capital',       nature:'liability', type:'capital', balance:500000,  negative:false },
  { code:'3001', name:'Sales Account',       nature:'income',    type:'income',  balance:1200000, negative:false },
  { code:'4001', name:'Purchase Account',    nature:'expense',   type:'expense', balance:800000,  negative:false },
]

function BalanceRow({ row, idx, onChange, onDelete }) {
  const set = (k,v) => onChange(idx,{...row,[k]:v})
  const { isDr, drAmount, crAmount } = computeDrCr(row)
  return (
    <tr style={{ borderBottom:'1px solid var(--border)' }}
      onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
      <td style={{ padding:'6px 10px', width:80 }}>
        <input className="ob-table" type="text" value={row.code} onChange={e=>set('code',e.target.value)} placeholder="1001"/>
      </td>
      <td style={{ padding:'6px 10px' }}>
        <input className="ob-table" type="text" value={row.name} onChange={e=>set('name',e.target.value)} placeholder="Account name"/>
      </td>
      <td style={{ padding:'6px 10px', width:110 }}>
        <select value={row.nature} onChange={e=>set('nature',e.target.value)}
          style={{ width:'100%', padding:'5px 8px', border:'1px solid var(--border)', borderRadius:'var(--r)', fontSize:'var(--fs-sm)', background:'var(--surface)' }}>
          {NATURE_OPTIONS.map(o=><option key={o}>{o}</option>)}
        </select>
      </td>
      <td style={{ padding:'6px 10px', width:120 }}>
        <select value={row.type} onChange={e=>set('type',e.target.value)}
          style={{ width:'100%', padding:'5px 8px', border:'1px solid var(--border)', borderRadius:'var(--r)', fontSize:'var(--fs-sm)', background:'var(--surface)' }}>
          {TYPE_OPTIONS.map(o=><option key={o}>{o}</option>)}
        </select>
      </td>
      <td style={{ padding:'6px 10px', width:100, textAlign:'right' }}>
        <input type="number" min="0" value={row.balance||''} onChange={e=>set('balance',Math.abs(Number(e.target.value)))}
          placeholder="0.00" style={{ textAlign:'right', width:'100%', padding:'5px 8px', border:'1px solid var(--border)', borderRadius:'var(--r)', fontSize:'var(--fs-sm)', background:'var(--surface)' }}/>
      </td>
      <td style={{ padding:'6px 10px', width:80, textAlign:'center' }}>
        <button
          onClick={()=>set('negative',!row.negative)}
          title={row.negative ? 'Negative balance — click to make positive' : 'Positive balance — click to make negative'}
          style={{
            display:'inline-flex', alignItems:'center', gap:4,
            padding:'4px 8px', borderRadius:4, border:'none', cursor:'pointer', fontSize:11, fontWeight:600,
            background: row.negative ? 'var(--danger-l)' : 'var(--success-l)',
            color: row.negative ? 'var(--danger)' : 'var(--success)',
          }}>
          {row.negative ? <><Minus size={10}/> Neg</> : <>+ Pos</>}
        </button>
      </td>
      <td style={{ padding:'6px 10px', width:50, textAlign:'center', fontSize:11, fontWeight:700, color: isDr?'var(--success)':'var(--danger)' }}>
        {isDr ? 'Dr' : 'Cr'}
      </td>
      <td style={{ padding:'6px 10px', textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--success)' }}>
        {drAmount>0?`₹${drAmount.toLocaleString('en-IN')}`:'—'}
      </td>
      <td style={{ padding:'6px 10px', textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--danger)' }}>
        {crAmount>0?`₹${crAmount.toLocaleString('en-IN')}`:'—'}
      </td>
      <td style={{ padding:'6px 10px', textAlign:'center' }}>
        <button onClick={()=>onDelete(idx)} style={{ padding:4, border:'none', background:'none', cursor:'pointer', color:'var(--danger)', borderRadius:4 }}>
          <Trash2 size={13}/>
        </button>
      </td>
    </tr>
  )
}

export default function OpeningBalances() {
  const [rows,    setRows]    = useState(TEMPLATE_ROWS.map(r=>({...r,id:Math.random()})))
  const [asOfDate,setAsOfDate]= useState(() => { const d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10) })
  const [saved,   setSaved]   = useState(false)
  const [showHelp,setShowHelp]= useState(false)
  const fileRef               = useRef()

  const addRow = () => setRows(r=>[...r,{id:Math.random(),code:'',name:'',nature:'asset',type:'other',balance:0,negative:false}])
  const updateRow = (idx,row) => setRows(r=>r.map((x,i)=>i===idx?row:x))
  const deleteRow = (idx) => setRows(r=>r.filter((_,i)=>i!==idx))

  const totalDr = rows.reduce((s,r) => s + computeDrCr(r).drAmount, 0)
  const totalCr = rows.reduce((s,r) => s + computeDrCr(r).crAmount, 0)
  const diff    = totalDr - totalCr
  const balanced = Math.abs(diff) < 0.01
  const negativeCount = rows.filter(r=>r.negative).length

  const handleFile = (file) => {
    if (!file) return
    toast.success('Parsing file… (Demo: template data loaded)')
    setRows(TEMPLATE_ROWS.map(r=>({...r,id:Math.random()})))
  }

  const handleSave = () => {
    const errors = rows.filter(r=>!r.code||!r.name)
    if (errors.length>0) { toast.error(`${errors.length} rows have missing data`); return }
    if (!balanced) { toast.error(`Out of balance by ₹${Math.abs(diff).toLocaleString('en-IN')}. Dr must equal Cr.`); return }
    setSaved(true)
    toast.success(`${rows.length} opening balances saved successfully!`)
  }

  const downloadTemplate = () => {
    const header = 'Code,Account Name,Nature,Type,Balance,Negative(yes/no)\n'
    const body = TEMPLATE_ROWS.map(r=>`${r.code},${r.name},${r.nature},${r.type},${r.balance},${r.negative?'yes':'no'}`).join('\n')
    const blob = new Blob([header+body],{type:'text/csv'})
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download='opening_balances_template.csv'; a.click()
    toast.success('Template downloaded')
  }

  return (
    <div className="page-wrap page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Opening Balances</h1>
          <p className="page-sub">Migrate from Tally, Zoho, QuickBooks or any other software</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={downloadTemplate}><Download size={13}/> Download Template</button>
          <button className="btn btn-secondary" onClick={()=>fileRef.current?.click()}><Upload size={13}/> Import CSV</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saved}>{saved?<><CheckCircle size={13}/> Saved!</>:<><Save size={13}/> Save Opening Balances</>}</button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept=".csv,.xlsx" style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])}/>

      <div style={{ marginBottom:16, padding:'12px 16px', background:'var(--info-l)', borderRadius:8, border:'1px solid var(--info-b)', display:'flex', gap:10, alignItems:'flex-start' }}>
        <Info size={15} color="var(--info)" style={{ flexShrink:0, marginTop:1 }}/>
        <div style={{ fontSize:12, color:'var(--text-2)', flex:1 }}>
          <strong>How to migrate:</strong> Enter closing balances from your previous software. Toggle <strong style={{ color:'var(--danger)' }}>±Neg</strong> for accounts with <strong>contra/negative balances</strong> (e.g. bank overdraft = asset with Cr balance). The Dr/Cr column auto-updates based on nature + negative flag.
          {' '}<span style={{ color:'var(--accent)', cursor:'pointer' }} onClick={()=>setShowHelp(h=>!h)}>{showHelp?'Hide':'Learn about negative balances ↓'}</span>
        </div>
      </div>

      {showHelp && (
        <div style={{ marginBottom:16, padding:'14px 16px', background:'#FFFBEB', borderRadius:8, border:'1px solid #FDE68A' }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:'#92400E' }}>📖 When to Use Negative Balance</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, fontSize:12 }}>
            {[
              { case:'Bank Overdraft',  how:'Asset account overdrawn — toggle Neg → auto-shows Cr balance', eg:'Bank OD: ₹1,20,000 Cr' },
              { case:'Advance from Customer', how:'Liability with Dr balance (refunded excess)', eg:'Advance refunded ₹50,000' },
              { case:'Accumulated Loss', how:'Equity with Dr balance (losses exceed capital)', eg:'Loss c/f ₹3,00,000' },
              { case:'Overpaid Supplier', how:'Creditor with Dr balance (excess payment)', eg:'Supplier advance ₹20,000' },
            ].map(n=>(
              <div key={n.case} style={{ padding:'10px 12px', background:'white', borderRadius:6, border:'1px solid #FDE68A' }}>
                <div style={{ fontWeight:700, color:'#92400E', marginBottom:3 }}>⚠ {n.case}</div>
                <div style={{ color:'#78350F', marginBottom:2 }}>{n.how}</div>
                <div style={{ color:'#92400E', fontSize:11, fontStyle:'italic' }}>e.g. {n.eg}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding:'14px 18px', marginBottom:16, display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <label style={{ fontSize:12, fontWeight:600, color:'var(--text-2)', whiteSpace:'nowrap' }}>Opening Balance As Of:</label>
          <input type="date" className="input" value={asOfDate} onChange={e=>setAsOfDate(e.target.value)} style={{ width:160 }}/>
        </div>
        <div style={{ flex:1 }}/>
        <div style={{ display:'flex', gap:16, fontSize:12, alignItems:'center' }}>
          {negativeCount > 0 && (
            <span style={{ color:'var(--warning)', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
              <AlertTriangle size={12}/> {negativeCount} negative
            </span>
          )}
          <span>Total Dr: <strong style={{ fontFamily:'var(--font-mono)', color:'var(--success)' }}>₹{totalDr.toLocaleString('en-IN')}</strong></span>
          <span>Total Cr: <strong style={{ fontFamily:'var(--font-mono)', color:'var(--danger)' }}>₹{totalCr.toLocaleString('en-IN')}</strong></span>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}>
            {balanced
              ? <><CheckCircle size={13} color="var(--success)"/><span style={{ color:'var(--success)', fontWeight:600 }}>Balanced ✓</span></>
              : <><AlertTriangle size={13} color="var(--danger)"/><span style={{ color:'var(--danger)', fontWeight:600 }}>Diff: ₹{Math.abs(diff).toLocaleString('en-IN')}</span></>}
          </span>
        </div>
      </div>

      <div className="card" style={{ overflow:'hidden' }}>
        <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontWeight:600, fontSize:13 }}>{rows.length} Accounts</span>
            {negativeCount > 0 && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:'var(--warning-l)', color:'var(--warning)', fontWeight:600 }}>{negativeCount} negative</span>}
          </div>
          <button className="btn btn-primary" style={{ fontSize:12 }} onClick={addRow}><Plus size={12}/> Add Row</button>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'var(--surface-2)', fontSize:11, color:'var(--text-3)' }}>
                {['Code','Account Name','Nature','Type','Balance (₹)','±Neg','Dr/Cr','Debit (₹)','Credit (₹)',''].map((h,i)=>(
                  <th key={i} style={{ padding:'8px 10px', textAlign:['Balance (₹)','Debit (₹)','Credit (₹)'].includes(h)?'right':'±Neg'===h||'Dr/Cr'===h||i===9?'center':'left', fontWeight:600, whiteSpace:'nowrap' }}>
                    {h==='±Neg'?<span title="Toggle for overdraft / contra balances — auto-flips Dr/Cr">±Neg</span>:h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row,idx)=>(
                <BalanceRow key={row.id} row={row} idx={idx} onChange={updateRow} onDelete={deleteRow}/>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background:'var(--surface-2)', borderTop:'2px solid var(--border)' }}>
                <td colSpan={7} style={{ padding:'10px 10px', fontWeight:700, fontSize:12 }}>TOTAL</td>
                <td style={{ padding:'10px 10px', textAlign:'right', fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--success)' }}>₹{totalDr.toLocaleString('en-IN')}</td>
                <td style={{ padding:'10px 10px', textAlign:'right', fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--danger)' }}>₹{totalCr.toLocaleString('en-IN')}</td>
                <td/>
              </tr>
            </tfoot>
          </table>
        </div>
        {!balanced&&rows.length>0&&(
          <div style={{ padding:'10px 14px', background:'var(--danger-l)', borderTop:'1px solid var(--danger-b)', display:'flex', gap:8, alignItems:'center', fontSize:12, color:'var(--danger)' }}>
            <AlertTriangle size={13}/> Trial balance is out of balance by ₹{Math.abs(diff).toLocaleString('en-IN')}. Add a suspense/difference account or check your entries.
          </div>
        )}
      </div>

      <div style={{ marginTop:16, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
        {[
          { title:'From Tally', icon:'🏢', tip:'Export closing balance from Tally. Mark OD bank accounts and advance accounts as Negative.' },
          { title:'Overdraft / OD Accounts', icon:'⚠️', tip:'Bank overdraft is an Asset with Cr balance. Toggle ±Neg — Dr/Cr auto-flips to Cr. The trial balance equation stays intact.' },
          { title:'Manual Entry', icon:'✏️', tip:'Assets/Expenses = Dr normally. Liabilities/Income = Cr normally. Toggle Neg for contra balances like OD or accumulated loss.' },
        ].map(t=>(
          <div key={t.title} className="card" style={{ padding:'14px 16px' }}>
            <div style={{ fontSize:20, marginBottom:6 }}>{t.icon}</div>
            <div style={{ fontWeight:600, fontSize:13, marginBottom:4 }}>{t.title}</div>
            <div style={{ fontSize:11, color:'var(--text-3)', lineHeight:1.5 }}>{t.tip}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
