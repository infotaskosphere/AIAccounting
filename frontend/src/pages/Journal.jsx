// src/pages/Journal.jsx
import { useState, useMemo } from 'react'
import { Search, Plus, Filter, Download, RotateCcw, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { mockVouchers } from '../api/mockData'
import { fmt, fmtDate } from '../utils/format'

const TYPES = ['all', 'sales', 'purchase', 'receipt', 'payment', 'journal']
const PAGE_SIZE = 6

const voucherBadge = {
  sales:    'badge-green',
  purchase: 'badge-red',
  receipt:  'badge-blue',
  payment:  'badge-amber',
  journal:  'badge-gray',
}

const sourceBadge = {
  manual:          'badge-gray',
  invoice_webhook: 'badge-purple',
  bank_import:     'badge-blue',
  payment_gateway: 'badge-green',
  ai_suggested:    'badge-blue',
}

export default function Journal() {
  const [search, setSearch]       = useState('')
  const [typeFilter, setType]     = useState('all')
  const [page, setPage]           = useState(1)
  const [showModal, setShowModal] = useState(false)

  const filtered = useMemo(() => {
    return mockVouchers.filter(v => {
      const matchType   = typeFilter === 'all' || v.voucher_type === typeFilter
      const matchSearch = !search || v.narration.toLowerCase().includes(search.toLowerCase()) ||
                          v.voucher_no.toLowerCase().includes(search.toLowerCase())
      return matchType && matchSearch
    })
  }, [search, typeFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const totalDr = filtered.filter(v => ['payment', 'purchase'].includes(v.voucher_type))
                           .reduce((s, v) => s + v.amount, 0)
  const totalCr = filtered.filter(v => ['sales', 'receipt'].includes(v.voucher_type))
                           .reduce((s, v) => s + v.amount, 0)

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Journal & Ledger</h1>
          <p className="page-subtitle">All vouchers, journal entries and ledger accounts</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Download size={15} /> Export</button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={15} /> New Voucher
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Vouchers', value: filtered.length, color: 'var(--primary)' },
          { label: 'Total Credit',   value: `₹${fmt(totalCr)}`, color: 'var(--success)' },
          { label: 'Total Debit',    value: `₹${fmt(totalDr)}`, color: 'var(--danger)' },
          { label: 'Net Position',   value: `₹${fmt(totalCr - totalDr)}`, color: totalCr >= totalDr ? 'var(--success)' : 'var(--danger)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ flex: 1, padding: '14px 18px' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: 5 }}>
              {s.label}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.03em', color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Search vouchers..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>

        {/* Type tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 4 }}>
          {TYPES.map(t => (
            <button
              key={t}
              className={typeFilter === t ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
              style={{ textTransform: 'capitalize', minWidth: 60 }}
              onClick={() => { setType(t); setPage(1) }}
            >
              {t}
            </button>
          ))}
        </div>

        {(search || typeFilter !== 'all') && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setType('all'); setPage(1) }}>
            <RotateCcw size={13} /> Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Voucher No.</th>
              <th>Date</th>
              <th>Narration</th>
              <th>Type</th>
              <th>Source</th>
              <th style={{ textAlign: 'right' }}>Amount (₹)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
                  No vouchers found
                </td>
              </tr>
            ) : paged.map(v => (
              <tr key={v.id} style={{ cursor: 'pointer' }}>
                <td>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>
                    {v.voucher_no}
                  </span>
                </td>
                <td style={{ color: 'var(--text-3)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                  {fmtDate(v.date)}
                </td>
                <td style={{ maxWidth: 260 }}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.875rem' }}>
                    {v.narration}
                  </span>
                </td>
                <td>
                  <span className={`badge ${voucherBadge[v.voucher_type] || 'badge-gray'}`} style={{ textTransform: 'capitalize' }}>
                    {v.voucher_type}
                  </span>
                </td>
                <td>
                  <span className={`badge ${sourceBadge[v.source] || 'badge-gray'}`} style={{ textTransform: 'capitalize', fontSize: '0.68rem' }}>
                    {v.source?.replace('_', ' ')}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span className={['sales', 'receipt'].includes(v.voucher_type) ? 'amt-cr' : 'amt-dr'}>
                    {['sales', 'receipt'].includes(v.voucher_type) ? '+' : '-'}₹{fmt(v.amount)}
                  </span>
                </td>
                <td>
                  <span className="badge badge-green">Posted</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderTop: '1px solid var(--border)',
            fontSize: '0.82rem', color: 'var(--text-2)'
          }}>
            <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  className={page === i + 1 ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                  style={{ minWidth: 32 }}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Voucher Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">New Voucher</span>
              <button className="icon-btn" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Voucher Type</label>
                <select className="input select">
                  <option>Sales Invoice</option>
                  <option>Purchase Invoice</option>
                  <option>Payment Voucher</option>
                  <option>Receipt Voucher</option>
                  <option>Journal Voucher</option>
                  <option>Contra</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" className="input" defaultValue="2024-03-28" />
                </div>
                <div className="form-group">
                  <label className="form-label">Reference</label>
                  <input type="text" className="input" placeholder="INV-0001" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Narration</label>
                <input type="text" className="input" placeholder="Describe the transaction..." />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <input type="number" className="input" placeholder="0.00" />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setShowModal(false)}>Post Voucher</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
