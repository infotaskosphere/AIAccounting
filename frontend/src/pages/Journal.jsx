// src/pages/Journal.jsx
import { useState } from 'react'
import { Plus, Trash2, RotateCcw, Search, Filter, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { mockVouchers, mockAccounts } from '../api/mockData'
import { fmt } from '../utils/format'

const voucherTypes = ['journal','payment','receipt','sales','purchase','contra']

const sourceLabel = {
  manual: { label: 'Manual', color: 'badge-gray' },
  invoice_webhook: { label: 'Invoice', color: 'badge-blue' },
  bank_import: { label: 'Bank Import', color: 'badge-amber' },
  payment_gateway: { label: 'Gateway', color: 'badge-green' },
  ai_suggested: { label: 'AI', color: 'badge-blue' },
}

const typeColor = {
  sales: 'badge-green', purchase: 'badge-red',
  receipt: 'badge-blue', payment: 'badge-amber',
  journal: 'badge-gray', contra: 'badge-gray',
}

export default function Journal() {
  const [tab, setTab] = useState('list')
  const [vouchers, setVouchers] = useState(mockVouchers)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)

  // New voucher form state
  const [form, setForm] = useState({
    voucher_type: 'journal',
    date: new Date().toISOString().split('T')[0],
    narration: '',
    reference: '',
  })
  const [lines, setLines] = useState([
    { account_id: '', dr_amount: '', cr_amount: '', narration: '' },
    { account_id: '', dr_amount: '', cr_amount: '', narration: '' },
  ])

  const totalDr = lines.reduce((s, l) => s + (parseFloat(l.dr_amount) || 0), 0)
  const totalCr = lines.reduce((s, l) => s + (parseFloat(l.cr_amount) || 0), 0)
  const isBalanced = Math.abs(totalDr - totalCr) < 0.01 && totalDr > 0

  const addLine = () => setLines(l => [...l, { account_id: '', dr_amount: '', cr_amount: '', narration: '' }])
  const removeLine = (i) => setLines(l => l.filter((_, idx) => idx !== i))
  const updateLine = (i, field, val) => setLines(l => l.map((ln, idx) => idx === i ? { ...ln, [field]: val } : ln))

  const handleSubmit = () => {
    if (!isBalanced) return toast.error('Voucher must balance: Dr = Cr')
    const newVoucher = {
      id: `v${Date.now()}`,
      voucher_no: `JV-2024-${String(vouchers.length + 1).padStart(4,'0')}`,
      voucher_type: form.voucher_type,
      date: form.date,
      narration: form.narration,
      amount: totalDr,
      status: 'posted',
      source: 'manual',
    }
    setVouchers(v => [newVoucher, ...v])
    toast.success(`${newVoucher.voucher_no} posted successfully`)
    setShowForm(false)
    resetForm()
  }

  const resetForm = () => {
    setForm({ voucher_type: 'journal', date: new Date().toISOString().split('T')[0], narration: '', reference: '' })
    setLines([
      { account_id: '', dr_amount: '', cr_amount: '', narration: '' },
      { account_id: '', dr_amount: '', cr_amount: '', narration: '' },
    ])
  }

  const reverseVoucher = (v) => {
    toast.success(`Reversal entry created for ${v.voucher_no}`)
  }

  const filtered = vouchers.filter(v =>
    v.narration.toLowerCase().includes(search.toLowerCase()) ||
    v.voucher_no.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page-enter">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Journal & Ledger</h1>
          <p>Double-entry accounting · All vouchers · Audit trail</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={15} /> New Entry
        </button>
      </div>

      <div className="page-body">
        {/* New voucher form */}
        {showForm && (
          <div className="card mb-3 fade-up">
            <div className="card-header">
              <h3>New Journal Entry</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); resetForm() }}>Cancel</button>
            </div>
            <div className="card-body">
              {/* Form header fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: 12, marginBottom: 20 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Type</label>
                  <select value={form.voucher_type} onChange={e => setForm(f => ({ ...f, voucher_type: e.target.value }))}>
                    {voucherTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Reference No.</label>
                  <input type="text" placeholder="INV-001" value={form.reference}
                    onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Narration</label>
                  <input type="text" placeholder="Purpose of this entry..." value={form.narration}
                    onChange={e => setForm(f => ({ ...f, narration: e.target.value }))} />
                </div>
              </div>

              {/* Journal lines */}
              <table style={{ marginBottom: 12 }}>
                <thead>
                  <tr>
                    <th style={{ width: '35%' }}>Account</th>
                    <th>Narration</th>
                    <th style={{ width: '130px' }}>Dr (₹)</th>
                    <th style={{ width: '130px' }}>Cr (₹)</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i}>
                      <td>
                        <select value={line.account_id} onChange={e => updateLine(i, 'account_id', e.target.value)}
                          style={{ margin: 0 }}>
                          <option value="">— Select account —</option>
                          {mockAccounts.map(a => (
                            <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input type="text" placeholder="Optional note" value={line.narration}
                          onChange={e => updateLine(i, 'narration', e.target.value)} style={{ margin: 0 }} />
                      </td>
                      <td>
                        <input type="number" placeholder="0.00" value={line.dr_amount}
                          onChange={e => { updateLine(i, 'dr_amount', e.target.value); if (e.target.value) updateLine(i, 'cr_amount', '') }}
                          style={{ margin: 0, textAlign: 'right' }} />
                      </td>
                      <td>
                        <input type="number" placeholder="0.00" value={line.cr_amount}
                          onChange={e => { updateLine(i, 'cr_amount', e.target.value); if (e.target.value) updateLine(i, 'dr_amount', '') }}
                          style={{ margin: 0, textAlign: 'right' }} />
                      </td>
                      <td>
                        {lines.length > 2 && (
                          <button className="btn btn-ghost btn-sm" onClick={() => removeLine(i)} style={{ padding: '4px' }}>
                            <Trash2 size={13} color="#dc2626" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr style={{ background: '#faf9f6' }}>
                    <td colSpan={2} style={{ fontWeight: 500, fontSize: '0.8rem', color: '#9b9590', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</td>
                    <td className="amount" style={{ color: totalDr > 0 ? '#1a1a1a' : '#9b9590' }}>₹{fmt(totalDr)}</td>
                    <td className="amount" style={{ color: totalCr > 0 ? '#1a1a1a' : '#9b9590' }}>₹{fmt(totalCr)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>

              <div className="flex items-center justify-between">
                <button className="btn btn-outline btn-sm" onClick={addLine}>
                  <Plus size={13} /> Add Line
                </button>
                <div className="flex gap-2 items-center">
                  {totalDr > 0 && (
                    <span style={{ fontSize: '0.8rem', color: isBalanced ? '#16a34a' : '#dc2626', fontWeight: 500 }}>
                      {isBalanced ? '✓ Balanced' : `⚠ Difference: ₹${fmt(Math.abs(totalDr - totalCr))}`}
                    </span>
                  )}
                  <button className="btn btn-primary" onClick={handleSubmit} disabled={!isBalanced}>
                    Post Entry
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Voucher list */}
        <div className="card">
          <div className="card-header" style={{ paddingBottom: 16 }}>
            <h3>All Vouchers</h3>
            <div className="flex gap-2">
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9b9590' }} />
                <input type="text" placeholder="Search vouchers..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: 30, width: 220, margin: 0 }} />
              </div>
              <button className="btn btn-outline btn-sm"><Filter size={13} /> Filter</button>
            </div>
          </div>
          <div style={{ padding: 0 }}>
            <div className="table-wrap" style={{ borderRadius: 0, border: 'none', boxShadow: 'none', borderTop: '1px solid #e5e1d8' }}>
              <table>
                <thead>
                  <tr>
                    <th>Voucher No.</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Narration</th>
                    <th>Source</th>
                    <th className="text-right">Amount (₹)</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(v => (
                    <tr key={v.id}>
                      <td className="mono">{v.voucher_no}</td>
                      <td style={{ color: '#5a5750' }}>{v.date}</td>
                      <td><span className={`badge ${typeColor[v.voucher_type]}`}>{v.voucher_type}</span></td>
                      <td style={{ maxWidth: 240 }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
                          {v.narration}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${sourceLabel[v.source]?.color || 'badge-gray'}`}>
                          {sourceLabel[v.source]?.label || v.source}
                        </span>
                      </td>
                      <td className="amount">₹{fmt(v.amount)}</td>
                      <td><span className={v.status === 'posted' ? 'badge badge-green' : 'badge badge-gray'}>{v.status}</span></td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn btn-ghost btn-sm" title="View" style={{ padding: '4px 6px' }}>
                            <Eye size={13} />
                          </button>
                          <button className="btn btn-ghost btn-sm" title="Reverse" onClick={() => reverseVoucher(v)} style={{ padding: '4px 6px' }}>
                            <RotateCcw size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card-footer flex justify-between items-center">
            <span className="text-sm text-muted">{filtered.length} entries</span>
            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm">← Prev</button>
              <button className="btn btn-ghost btn-sm">Next →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
