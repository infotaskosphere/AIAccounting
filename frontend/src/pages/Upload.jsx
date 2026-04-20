// src/pages/Upload.jsx
// Guided upload wizard: drag-drop → parse → AI classify → confirm → post
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { uploadApi, bankApi } from '../api/client'
import {
  Upload as UploadIcon, CheckCircle, AlertCircle, Loader,
  FileText, Table2, File, Zap, ArrowRight, RefreshCw, ChevronDown
} from 'lucide-react'
import toast from 'react-hot-toast'

const STEPS = ['Choose File', 'Processing', 'AI Results', 'Done']

function StepIndicator({ current }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:32, justifyContent:'center' }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ display:'flex', alignItems:'center' }}>
          <div style={{
            display:'flex', flexDirection:'column', alignItems:'center', gap:4,
          }}>
            <div style={{
              width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:12, fontWeight:700,
              background: i < current ? 'var(--success)' : i === current ? 'var(--accent)' : 'var(--border)',
              color: i <= current ? '#fff' : 'var(--text-3)',
              transition:'all .2s',
            }}>
              {i < current ? <CheckCircle size={14} /> : i + 1}
            </div>
            <span style={{ fontSize:10, color: i === current ? 'var(--accent)' : 'var(--text-3)', fontWeight: i === current ? 600 : 400, whiteSpace:'nowrap' }}>{s}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{ width:60, height:2, background: i < current ? 'var(--success)' : 'var(--border)', margin:'0 8px', marginTop:-14, transition:'background .2s' }} />
          )}
        </div>
      ))}
    </div>
  )
}

function FileTypeIcon({ name = '' }) {
  if (name.endsWith('.pdf'))       return <File size={32} color="#EF4444" />
  if (name.match(/\.xlsx?$/))      return <Table2 size={32} color="#16A34A" />
  return <FileText size={32} color="#2563EB" />
}

function ResultRow({ item, onCorrect, accounts }) {
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState(item.account_id)
  const confColor = item.confidence >= 0.85 ? 'var(--success)' : item.confidence >= 0.65 ? 'var(--warning)' : 'var(--danger)'

  return (
    <tr style={{ borderBottom:'1px solid var(--border)' }}>
      <td style={{ padding:'8px 12px', fontSize:12, color:'var(--text-2)', maxWidth:200 }}>
        <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.narration}</div>
      </td>
      <td style={{ padding:'8px 12px', fontSize:12, textAlign:'right', fontFamily:'var(--mono)', fontWeight:600 }}>
        ₹{Number(item.amount || 0).toLocaleString('en-IN')}
      </td>
      <td style={{ padding:'8px 12px' }}>
        {editing ? (
          <select
            value={selected}
            onChange={e => { setSelected(e.target.value); setEditing(false); onCorrect(item, e.target.value) }}
            style={{ fontSize:11, border:'1px solid var(--accent)', borderRadius:4, padding:'2px 4px', background:'var(--surface)' }}
            autoFocus
          >
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        ) : (
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:12 }}>{item.account_name}</span>
            <button onClick={() => setEditing(true)} style={{ background:'none', border:'1px solid var(--border)', borderRadius:3, padding:'1px 5px', fontSize:10, cursor:'pointer', color:'var(--text-3)' }}>Edit</button>
          </div>
        )}
      </td>
      <td style={{ padding:'8px 12px', textAlign:'center' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color: confColor, fontWeight:600 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background: confColor }} />
          {Math.round((item.confidence || 0) * 100)}%
        </div>
      </td>
      <td style={{ padding:'8px 12px', textAlign:'center' }}>
        <span style={{ fontSize:10, padding:'2px 6px', borderRadius:10,
          background: item.requires_review ? 'var(--warning-l)' : 'var(--success-l)',
          color: item.requires_review ? 'var(--warning)' : 'var(--success)',
          border: `1px solid ${item.requires_review ? 'var(--warning-b)' : 'var(--success-b)'}`,
          fontWeight:600,
        }}>
          {item.requires_review ? '⚠ Review' : '✓ Auto'}
        </span>
      </td>
    </tr>
  )
}

export default function Upload() {
  const [step,     setStep]     = useState(0)
  const [file,     setFile]     = useState(null)
  const [type,     setType]     = useState('bank')     // 'bank' | 'invoice'
  const [bankAccId, setBankAccId] = useState('')
  const [bankAccounts, setBankAccounts] = useState([])
  const [result,   setResult]   = useState(null)
  const [aiItems,  setAiItems]  = useState([])
  const [accounts, setAccounts] = useState([])
  const [posting,  setPosting]  = useState(false)

  const onDrop = useCallback(async (files) => {
    const f = files[0]
    if (!f) return
    setFile(f)

    if (type === 'bank' && bankAccounts.length === 0) {
      try {
        const res = await bankApi.getBankAccounts()
        setBankAccounts(res.data?.data || res.data || [])
      } catch {}
    }
  }, [type, bankAccounts])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls'] },
    multiple: false,
  })

  const processFile = async () => {
    if (!file) return
    if (type === 'bank' && !bankAccId) { toast.error('Select a bank account'); return }

    setStep(1)
    try {
      let res
      if (type === 'bank') {
        res = await uploadApi.bankStatement(bankAccId, file)
      } else {
        res = await uploadApi.invoice(file, 'sales')
      }
      const data = res.data?.data || res.data

      // Get AI classifications for the staged transactions
      const classifyRes = await uploadApi.getClassifiedTransactions(bankAccId || 'invoice')
      const items = classifyRes.data?.data || []
      setAiItems(items)
      setResult(data)
      setStep(2)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Processing failed')
      setStep(0)
    }
  }

  const handleCorrection = (item, newAccountId) => {
    uploadApi.correctClassification({
      narration: item.narration,
      original_account_id: item.account_id,
      corrected_account_id: newAccountId,
    }).catch(() => {})
    setAiItems(prev => prev.map(i =>
      i.narration === item.narration ? { ...i, account_id: newAccountId, manually_corrected: true } : i
    ))
  }

  const postAll = async () => {
    setPosting(true)
    try {
      await uploadApi.confirmAndPost({ items: aiItems })
      toast.success(`${aiItems.length} transactions posted successfully!`)
      setStep(3)
    } catch (err) {
      toast.error('Posting failed. Please try again.')
    } finally {
      setPosting(false)
    }
  }

  const reset = () => { setStep(0); setFile(null); setResult(null); setAiItems([]) }

  return (
    <div className="page-wrap page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Upload & Auto-Process</h1>
          <p className="page-sub">Zero manual entry — upload bank statements or invoices and let AI handle the rest</p>
        </div>
      </div>

      <div style={{ maxWidth:760, margin:'0 auto' }}>
        <StepIndicator current={step} />

        {/* Step 0: Choose File */}
        {step === 0 && (
          <div className="card" style={{ padding:32 }}>
            {/* Type selector */}
            <div style={{ display:'flex', gap:12, marginBottom:24 }}>
              {['bank', 'invoice'].map(t => (
                <button key={t} onClick={() => setType(t)} style={{
                  flex:1, padding:'12px 0', border:`2px solid ${type===t ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:13,
                  background: type===t ? 'var(--primary-l)' : 'var(--surface)',
                  color: type===t ? 'var(--accent)' : 'var(--text-2)',
                  transition:'all .15s',
                }}>
                  {t === 'bank' ? '🏦 Bank Statement' : '📄 Invoice'}
                </button>
              ))}
            </div>

            {/* Dropzone */}
            <div {...getRootProps()} style={{
              border:`2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border-2)'}`,
              borderRadius:12, padding:40, textAlign:'center', cursor:'pointer',
              background: isDragActive ? 'var(--primary-l)' : 'var(--surface-2)',
              transition:'all .2s',
            }}>
              <input {...getInputProps()} />
              {file ? (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
                  <FileTypeIcon name={file.name} />
                  <div style={{ fontWeight:600, color:'var(--text)' }}>{file.name}</div>
                  <div style={{ fontSize:12, color:'var(--text-3)' }}>{(file.size/1024).toFixed(1)} KB</div>
                </div>
              ) : (
                <div>
                  <UploadIcon size={40} color="var(--text-4)" style={{ marginBottom:12 }} />
                  <div style={{ fontWeight:600, color:'var(--text-2)', marginBottom:4 }}>
                    {isDragActive ? 'Drop it here!' : 'Drag & drop your file here'}
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-3)' }}>Supports PDF, CSV, Excel (.xlsx/.xls)</div>
                </div>
              )}
            </div>

            {/* Bank account selector */}
            {file && type === 'bank' && (
              <div style={{ marginTop:16 }}>
                <label style={{ fontSize:12, fontWeight:500, color:'var(--text-2)', display:'block', marginBottom:6 }}>Bank Account</label>
                <select
                  value={bankAccId}
                  onChange={e => setBankAccId(e.target.value)}
                  style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:13, background:'var(--surface)' }}
                >
                  <option value="">-- Select bank account --</option>
                  {bankAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.bank_name} – {a.account_number}</option>
                  ))}
                </select>
              </div>
            )}

            {file && (
              <button
                onClick={processFile}
                className="btn btn-primary"
                style={{ width:'100%', marginTop:20, padding:'10px 0', fontSize:14, justifyContent:'center' }}
              >
                <Zap size={14} />
                Process with AI
                <ArrowRight size={14} />
              </button>
            )}

            <div style={{ marginTop:20, padding:14, background:'var(--info-l)', borderRadius:8, border:'1px solid var(--info-b)', fontSize:12, color:'var(--info)', display:'flex', gap:8 }}>
              <span>💡</span>
              <span>AI will automatically classify each transaction, map to ledger accounts, and create journal entries. You can review and correct before final posting.</span>
            </div>
          </div>
        )}

        {/* Step 1: Processing */}
        {step === 1 && (
          <div className="card" style={{ padding:48, textAlign:'center' }}>
            <div style={{ width:64, height:64, borderRadius:'50%', background:'var(--primary-l)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
              <Loader size={28} color="var(--accent)" style={{ animation:'spin .8s linear infinite' }} />
            </div>
            <h3 style={{ fontWeight:700, marginBottom:8 }}>AI is analyzing your file…</h3>
            <p style={{ color:'var(--text-3)', fontSize:13 }}>Parsing transactions → Classifying with AI → Mapping to ledgers</p>
            <div style={{ marginTop:24, display:'flex', flexDirection:'column', gap:8, maxWidth:300, margin:'24px auto 0' }}>
              {['Parsing file format...','Extracting transactions...','Running AI classification...','Mapping to your ledgers...'].map((t,i) => (
                <div key={t} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--text-3)', animation:`fadeIn .3s ${i*0.4}s both` }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', animation:'pulse 1.5s infinite' }} />
                  {t}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: AI Results */}
        {step === 2 && (
          <div>
            <div style={{ display:'flex', gap:12, marginBottom:16 }}>
              {[
                { label:'Parsed', value: result?.total_parsed || aiItems.length, color:'var(--info)' },
                { label:'Auto-Ready', value: aiItems.filter(i => !i.requires_review).length, color:'var(--success)' },
                { label:'Needs Review', value: aiItems.filter(i => i.requires_review).length, color:'var(--warning)' },
              ].map(s => (
                <div key={s.label} className="card" style={{ flex:1, padding:'12px 16px', textAlign:'center' }}>
                  <div style={{ fontSize:22, fontWeight:700, color: s.color, fontFamily:'var(--mono)' }}>{s.value}</div>
                  <div style={{ fontSize:11, color:'var(--text-3)' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="card" style={{ overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontWeight:600, fontSize:13 }}>AI Classifications — Review & Confirm</span>
                <span style={{ fontSize:11, color:'var(--text-3)' }}>Click "Edit" on any row to override</span>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'var(--surface-2)', fontSize:11, color:'var(--text-3)' }}>
                      <th style={{ padding:'8px 12px', textAlign:'left', fontWeight:600 }}>Narration</th>
                      <th style={{ padding:'8px 12px', textAlign:'right', fontWeight:600 }}>Amount</th>
                      <th style={{ padding:'8px 12px', textAlign:'left', fontWeight:600 }}>Suggested Account</th>
                      <th style={{ padding:'8px 12px', textAlign:'center', fontWeight:600 }}>Confidence</th>
                      <th style={{ padding:'8px 12px', textAlign:'center', fontWeight:600 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiItems.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding:24, textAlign:'center', color:'var(--text-3)', fontSize:13 }}>No transactions to display</td></tr>
                    ) : (
                      aiItems.map((item, i) => (
                        <ResultRow key={i} item={item} onCorrect={handleCorrection} accounts={accounts} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)', display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button onClick={reset} className="btn btn-secondary">
                  <RefreshCw size={12} /> Start Over
                </button>
                <button onClick={postAll} disabled={posting} className="btn btn-primary">
                  {posting ? <Loader size={12} /> : <CheckCircle size={12} />}
                  {posting ? 'Posting...' : `Post ${aiItems.length} Transactions`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div className="card" style={{ padding:48, textAlign:'center' }}>
            <div style={{ width:64, height:64, borderRadius:'50%', background:'var(--success-l)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <CheckCircle size={32} color="var(--success)" />
            </div>
            <h3 style={{ fontWeight:700, marginBottom:8, color:'var(--success)' }}>All Done! 🎉</h3>
            <p style={{ color:'var(--text-3)', marginBottom:24 }}>
              {aiItems.length} transactions processed, classified, and posted to your ledger automatically.
            </p>
            <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
              <button onClick={reset} className="btn btn-secondary">Upload Another File</button>
              <button onClick={() => window.location.href='/reports'} className="btn btn-primary">
                View Reports <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:translateX(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }
      `}</style>
    </div>
  )
}
