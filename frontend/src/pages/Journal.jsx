// src/pages/Journal.jsx — FIXED: modal centered + voucher PDF upload
import { useState, useMemo, useRef } from 'react'
import { Search, Plus, Filter, Download, RotateCcw, X, ChevronLeft, ChevronRight, Upload, FileText, Zap, CheckCircle } from 'lucide-react'
import { getCompanyData } from '../api/mockData'
import { useAuth } from '../context/AuthContext'
import { fmt, fmtDate } from '../utils/format'
import toast from 'react-hot-toast'

const TYPES = ['all', 'sales', 'purchase', 'receipt', 'payment', 'journal']
const PAGE_SIZE = 6

const voucherBadge = { sales:'badge-green', purchase:'badge-red', receipt:'badge-blue', payment:'badge-amber', journal:'badge-gray' }
const sourceBadge  = { manual:'badge-gray', invoice_webhook:'badge-purple', bank_import:'badge-blue', payment_gateway:'badge-green', ai_suggested:'badge-blue' }

// ── Invoice data extracted from the PDF (MS Advisory Services LLP demo) ──
const DEMO_PARSED = {
  type:'purchase', date:'2026-04-15', reference:'INV - MSA/26-27/005',
  party:'MS Advisory Services LLP', narration:'Annual Compliance Services (Jan, Feb, Mar 2026)',
  amount:'9900', cgst:'0', sgst:'0', igst:'0', total:'9900',
}

function VoucherModal({ onClose }) {
  const [tab, setTab]         = useState('manual')   // 'manual' | 'upload'
  const [form, setForm]       = useState({ type:'sales', date: new Date().toISOString().slice(0,10), reference:'', narration:'', amount:'', cgst:'', sgst:'', igst:'' })
  const [parsing, setParsing] = useState(false)
  const [parsed,  setParsed]  = useState(null)
  const [posted,  setPosted]  = useState(false)
  const fileRef               = useRef()

  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const handleFile = async (file) => {
    if (!file) return
    if (!file.name.match(/\.(pdf|png|jpg|jpeg)$/i)) { toast.error('Upload a PDF or image invoice'); return }
    setParsing(true)
    // Simulate AI parsing (in production calls /api/v1/upload/invoice)
    await new Promise(r => setTimeout(r, 1800))
    setParsed(DEMO_PARSED)
    setForm(f=>({...f, ...DEMO_PARSED}))
    setParsing(false)
    toast.success('Invoice data extracted! Review and post.')
  }

  const handlePost = () => {
    if (!form.narration.trim()) { toast.error('Narration required'); return }
    if (!form.amount || isNaN(form.amount) || Number(form.amount)<=0) { toast.error('Enter a valid amount'); return }
    setPosted(true)
    setTimeout(onClose, 1500)
    toast.success('Voucher posted successfully!')
  }

  if (posted) return (
    <div className="modal-overlay">
      <div className="modal" style={{maxWidth:360,textAlign:'center',padding:32}}>
        <CheckCircle size={48} color="var(--success)" style={{margin:'0 auto 12px'}}/>
        <div style={{fontWeight:700,fontSize:16,marginBottom:6}}>Voucher Posted!</div>
        <div style={{fontSize:13,color:'var(--text-3)'}}>Journal entry created successfully.</div>
      </div>
    </div>
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:560}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">New Voucher</span>
          <button className="icon-btn" onClick={onClose}><X size={18}/></button>
        </div>

        {/* Tab selector */}
        <div style={{display:'flex',gap:2,padding:'10px 16px',borderBottom:'1px solid var(--border)',background:'var(--surface-2)'}}>
          {[{key:'manual',label:'Manual Entry',icon:FileText},{key:'upload',label:'Upload Invoice (AI)',icon:Zap}].map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)}
              style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                background:tab===t.key?'var(--accent)':'transparent',
                color:tab===t.key?'#fff':'var(--text-3)',transition:'all .15s'}}>
              <t.icon size={12}/>{t.label}
              {t.key==='upload'&&<span style={{fontSize:9,padding:'1px 4px',borderRadius:3,background:'linear-gradient(135deg,#2563EB,#7C3AED)',color:'#fff',fontWeight:700}}>AI</span>}
            </button>
          ))}
        </div>

        <div className="modal-body" style={{display:'grid',gap:12}}>

          {/* ── UPLOAD TAB ── */}
          {tab==='upload'&&(
            <div>
              {!parsed&&!parsing&&(
                <div
                  onClick={()=>fileRef.current?.click()}
                  style={{border:'2px dashed var(--border-2)',borderRadius:10,padding:32,textAlign:'center',cursor:'pointer',background:'var(--surface-2)',transition:'all .2s'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.background='var(--primary-l)'}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border-2)';e.currentTarget.style.background='var(--surface-2)'}}>
                  <Upload size={36} color="var(--text-4)" style={{margin:'0 auto 10px'}}/>
                  <div style={{fontWeight:600,marginBottom:4}}>Drop invoice here or click to browse</div>
                  <div style={{fontSize:12,color:'var(--text-3)'}}>Supports PDF, JPG, PNG · AI extracts all fields automatically</div>
                  <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])}/>
                </div>
              )}
              {parsing&&(
                <div style={{textAlign:'center',padding:32}}>
                  <div style={{width:40,height:40,borderRadius:'50%',border:'3px solid var(--border)',borderTopColor:'var(--accent)',animation:'spin .8s linear infinite',margin:'0 auto 12px'}}/>
                  <div style={{fontWeight:600,marginBottom:4}}>AI is reading your invoice…</div>
                  <div style={{fontSize:12,color:'var(--text-3)'}}>Extracting party, amount, GST, date…</div>
                </div>
              )}
              {parsed&&(
                <div style={{padding:'10px 14px',background:'var(--success-l)',borderRadius:8,border:'1px solid var(--success-b)',display:'flex',gap:8,alignItems:'flex-start',marginBottom:4}}>
                  <CheckCircle size={14} color="var(--success)" style={{flexShrink:0,marginTop:1}}/>
                  <div style={{fontSize:12}}>
                    <strong>Invoice extracted:</strong> {parsed.reference} · {parsed.party} · ₹{fmt(Number(parsed.total))}
                    <span style={{marginLeft:8,fontSize:11,color:'var(--text-3)',cursor:'pointer',textDecoration:'underline'}} onClick={()=>{setParsed(null);setForm({type:'purchase',date:new Date().toISOString().slice(0,10),reference:'',narration:'',amount:'',cgst:'',sgst:'',igst:''})}}>Upload different file</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── FORM (manual + prefilled from upload) ── */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="form-group">
              <label className="form-label">Voucher Type</label>
              <select className="input select" value={form.type} onChange={e=>set('type',e.target.value)}>
                <option value="sales">Sales Invoice</option>
                <option value="purchase">Purchase Invoice</option>
                <option value="payment">Payment Voucher</option>
                <option value="receipt">Receipt Voucher</option>
                <option value="journal">Journal Voucher</option>
                <option value="contra">Contra</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" className="input" value={form.date} onChange={e=>set('date',e.target.value)}/>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="form-group">
              <label className="form-label">Reference / Invoice No.</label>
              <input className="input" value={form.reference} onChange={e=>set('reference',e.target.value)} placeholder="INV-0001"/>
            </div>
            <div className="form-group">
              <label className="form-label">Party Name</label>
              <input className="input" value={form.party||''} onChange={e=>set('party',e.target.value)} placeholder="Customer / Vendor name"/>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Narration *</label>
            <input className="input" value={form.narration} onChange={e=>set('narration',e.target.value)} placeholder="Describe the transaction…"/>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:10}}>
            <div className="form-group">
              <label className="form-label">Amount (₹) *</label>
              <input type="number" className="input" value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder="0.00"/>
            </div>
            <div className="form-group">
              <label className="form-label">CGST (₹)</label>
              <input type="number" className="input" value={form.cgst||''} onChange={e=>set('cgst',e.target.value)} placeholder="0.00"/>
            </div>
            <div className="form-group">
              <label className="form-label">SGST (₹)</label>
              <input type="number" className="input" value={form.sgst||''} onChange={e=>set('sgst',e.target.value)} placeholder="0.00"/>
            </div>
            <div className="form-group">
              <label className="form-label">IGST (₹)</label>
              <input type="number" className="input" value={form.igst||''} onChange={e=>set('igst',e.target.value)} placeholder="0.00"/>
            </div>
          </div>

          {/* Total preview */}
          {form.amount&&(
            <div style={{padding:'8px 12px',background:'var(--surface-2)',borderRadius:6,border:'1px solid var(--border)',display:'flex',gap:16,fontSize:12}}>
              <span>Taxable: <strong style={{fontFamily:'var(--font-mono)'}}>₹{fmt(Number(form.amount))}</strong></span>
              <span>GST: <strong style={{fontFamily:'var(--font-mono)'}}>₹{fmt((Number(form.cgst)||0)+(Number(form.sgst)||0)+(Number(form.igst)||0))}</strong></span>
              <span>Total: <strong style={{fontFamily:'var(--font-mono)',color:'var(--success)',fontSize:13}}>₹{fmt(Number(form.amount)+(Number(form.cgst)||0)+(Number(form.sgst)||0)+(Number(form.igst)||0))}</strong></span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handlePost}><Plus size={13}/> Post Voucher</button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default function Journal() {
  const { activeCompany } = useAuth()
  const [search, setSearch]       = useState('')
  const [typeFilter, setType]     = useState('all')
  const [page, setPage]           = useState(1)
  const [showModal, setShowModal] = useState(false)

  const vouchers = getCompanyData(activeCompany?.id).vouchers
  const filtered = useMemo(()=> vouchers.filter(v=>{
    const matchType   = typeFilter==='all'||v.voucher_type===typeFilter
    const matchSearch = !search||v.narration.toLowerCase().includes(search.toLowerCase())||v.voucher_no.toLowerCase().includes(search.toLowerCase())
    return matchType&&matchSearch
  }),[search,typeFilter,vouchers])

  const totalPages = Math.ceil(filtered.length/PAGE_SIZE)
  const paged      = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)
  const totalDr    = filtered.filter(v=>['payment','purchase'].includes(v.voucher_type)).reduce((s,v)=>s+v.amount,0)
  const totalCr    = filtered.filter(v=>['sales','receipt'].includes(v.voucher_type)).reduce((s,v)=>s+v.amount,0)

  return (
    <div className="page-enter">
      <div className="page-header">
        <div><h1 className="page-title">Journal & Ledger</h1><p className="page-subtitle">All vouchers, journal entries and ledger accounts</p></div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Download size={15}/> Export</button>
          <button className="btn btn-primary" onClick={()=>setShowModal(true)}><Plus size={15}/> New Voucher</button>
        </div>
      </div>

      <div style={{display:'flex',gap:12,marginBottom:20}}>
        {[{label:'Total Vouchers',value:filtered.length,color:'var(--primary)'},{label:'Total Credit',value:`₹${fmt(totalCr)}`,color:'var(--success)'},{label:'Total Debit',value:`₹${fmt(totalDr)}`,color:'var(--danger)'},{label:'Net Position',value:`₹${fmt(totalCr-totalDr)}`,color:totalCr>=totalDr?'var(--success)':'var(--danger)'}].map(s=>(
          <div key={s.label} className="card" style={{flex:1,padding:'14px 18px'}}>
            <div style={{fontSize:'0.72rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--text-3)',marginBottom:5}}>{s.label}</div>
            <div style={{fontFamily:'var(--font-display)',fontSize:'1.3rem',fontWeight:800,letterSpacing:'-0.03em',color:s.color}}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center'}}>
        <div style={{position:'relative',flex:1,maxWidth:320}}>
          <Search size={15} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)'}}/>
          <input className="input" style={{paddingLeft:36}} placeholder="Search vouchers…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/>
        </div>
        <div style={{display:'flex',gap:4,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:4}}>
          {TYPES.map(t=>(
            <button key={t} className={typeFilter===t?'btn btn-primary btn-sm':'btn btn-ghost btn-sm'} style={{textTransform:'capitalize',minWidth:60}} onClick={()=>{setType(t);setPage(1)}}>{t}</button>
          ))}
        </div>
        {(search||typeFilter!=='all')&&<button className="btn btn-ghost btn-sm" onClick={()=>{setSearch('');setType('all');setPage(1)}}><RotateCcw size={13}/> Reset</button>}
      </div>

      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Voucher No.</th><th>Date</th><th>Narration</th><th>Type</th><th>Source</th><th style={{textAlign:'right'}}>Amount (₹)</th><th>Status</th></tr></thead>
          <tbody>
            {paged.length===0?(<tr><td colSpan={7} style={{textAlign:'center',padding:'48px 0',color:'var(--text-3)'}}><div style={{fontSize:'2rem',marginBottom:8}}>📭</div>No vouchers found</td></tr>)
            :paged.map(v=>(
              <tr key={v.id} style={{cursor:'pointer'}}>
                <td><span style={{fontFamily:'var(--font-mono)',fontSize:'0.82rem',color:'var(--primary)',fontWeight:600}}>{v.voucher_no}</span></td>
                <td style={{color:'var(--text-3)',fontSize:'0.82rem',whiteSpace:'nowrap'}}>{fmtDate(v.date)}</td>
                <td style={{maxWidth:260}}><span style={{display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:'0.875rem'}}>{v.narration}</span></td>
                <td><span className={`badge ${voucherBadge[v.voucher_type]||'badge-gray'}`} style={{textTransform:'capitalize'}}>{v.voucher_type}</span></td>
                <td><span className={`badge ${sourceBadge[v.source]||'badge-gray'}`} style={{textTransform:'capitalize',fontSize:'0.68rem'}}>{v.source?.replace('_',' ')}</span></td>
                <td style={{textAlign:'right'}}><span className={['sales','receipt'].includes(v.voucher_type)?'amt-cr':'amt-dr'}>{['sales','receipt'].includes(v.voucher_type)?'+':'-'}₹{fmt(v.amount)}</span></td>
                <td><span className="badge badge-green">Posted</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages>1&&(
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderTop:'1px solid var(--border)',fontSize:'0.82rem',color:'var(--text-2)'}}>
            <span>Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,filtered.length)} of {filtered.length}</span>
            <div style={{display:'flex',gap:6}}>
              <button className="btn btn-ghost btn-sm" disabled={page===1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={14}/></button>
              {Array.from({length:totalPages},(_,i)=><button key={i} className={page===i+1?'btn btn-primary btn-sm':'btn btn-ghost btn-sm'} style={{minWidth:32}} onClick={()=>setPage(i+1)}>{i+1}</button>)}
              <button className="btn btn-ghost btn-sm" disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}><ChevronRight size={14}/></button>
            </div>
          </div>
        )}
      </div>

      {showModal&&<VoucherModal onClose={()=>setShowModal(false)}/>}
    </div>
  )
}
