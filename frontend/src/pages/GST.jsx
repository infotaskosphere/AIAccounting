// src/pages/GST.jsx
import { useState } from 'react'
import { Download, FileText, CheckSquare, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { mockGSTSummary } from '../api/mockData'
import { fmt } from '../utils/format'

const periods = ['January 2024','February 2024','March 2024','April 2024']

export default function GST() {
  const [period, setPeriod] = useState('March 2024')
  const [activeReturn, setActiveReturn] = useState('gstr1')
  const data = mockGSTSummary

  const handleDownload = (type) => toast.success(`${type} JSON downloaded`)

  return (
    <div className="page-enter">
      <div className="page-header">
        <div className="page-header-left">
          <h1>GST Reports</h1>
          <p>GSTR-1 · GSTR-3B · Input Tax Credit · Auto-generated from transactions</p>
        </div>
        <div className="flex gap-2">
          <select value={period} onChange={e => setPeriod(e.target.value)} style={{ width: 180 }}>
            {periods.map(p => <option key={p}>{p}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => handleDownload(activeReturn.toUpperCase())}>
            <Download size={14} /> Download JSON
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Filing status banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 20px', borderRadius: 10, marginBottom: 20,
          background: '#fef3c7', border: '1px solid #fde68a',
          color: '#92400e', fontSize: '0.875rem',
        }}>
          <AlertTriangle size={16} />
          <span><strong>GSTR-1 for {period}</strong> is due on April 11, 2024. 
            All {data.b2b_count} B2B and {data.b2c_count} B2C invoices are ready.</span>
          <button className="btn btn-sm btn-primary" style={{ marginLeft: 'auto' }}>
            File Now
          </button>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <SummaryCard title="Output Tax (Sales)" data={data.output} color="#dc2626" />
          <SummaryCard title="Input Tax Credit (Purchases)" data={data.input} color="#16a34a" />
          <div className="card" style={{ padding: '20px 22px' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9b9590', marginBottom: 12 }}>
              Net GST Payable
            </div>
            {[
              { label: 'CGST', value: data.net_payable.cgst },
              { label: 'SGST', value: data.net_payable.sgst },
              { label: 'IGST', value: data.net_payable.igst },
            ].map(r => (
              <div key={r.label} className="flex justify-between" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: '0.857rem', color: '#5a5750' }}>{r.label}</span>
                <span style={{ fontWeight: 600, color: r.value > 0 ? '#dc2626' : '#9b9590' }}>₹{fmt(r.value)}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #e5e1d8', paddingTop: 10, marginTop: 4 }}>
              <div className="flex justify-between">
                <span style={{ fontWeight: 600 }}>Total Payable</span>
                <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.2rem', color: '#dc2626' }}>
                  ₹{fmt(data.net_payable.total)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Return tabs */}
        <div className="card">
          <div className="card-header" style={{ paddingBottom: 0 }}>
            <div className="flex gap-2">
              {[
                { id: 'gstr1', label: 'GSTR-1 (Outward Supplies)' },
                { id: 'gstr3b', label: 'GSTR-3B (Summary)' },
                { id: 'itc', label: 'ITC Reconciliation' },
              ].map(tab => (
                <button key={tab.id}
                  className={`btn btn-sm ${activeReturn === tab.id ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActiveReturn(tab.id)} style={{ borderRadius: '6px 6px 0 0' }}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeReturn === 'gstr1' && (
            <div>
              <div style={{ padding: '16px 24px', background: '#f7f5f0', borderBottom: '1px solid #e5e1d8' }}>
                <div className="flex gap-4">
                  {[
                    { label: 'B2B Invoices', count: data.b2b_count, color: '#2563eb' },
                    { label: 'B2C Invoices', count: data.b2c_count, color: '#7c3aed' },
                    { label: 'Exports', count: 0, color: '#16a34a' },
                    { label: 'Nil Rated', count: 0, color: '#9b9590' },
                  ].map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                      <span style={{ fontSize: '0.8rem', color: '#5a5750' }}>{s.label}: <strong>{s.count}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="table-wrap" style={{ borderRadius: 0, border: 'none', boxShadow: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Invoice No.</th>
                      <th>Party Name</th>
                      <th>GSTIN</th>
                      <th className="text-right">Taxable Value</th>
                      <th className="text-right">CGST</th>
                      <th className="text-right">SGST</th>
                      <th className="text-right">IGST</th>
                      <th className="text-right">Invoice Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.map(t => (
                      <tr key={t.invoice_no}>
                        <td className="mono">{t.invoice_no}</td>
                        <td style={{ fontWeight: 500 }}>{t.party}</td>
                        <td className="mono" style={{ fontSize: '0.78rem', color: '#9b9590' }}>{t.gstin}</td>
                        <td className="amount">₹{fmt(t.taxable)}</td>
                        <td className="amount" style={{ color: '#dc2626' }}>₹{fmt(t.cgst)}</td>
                        <td className="amount" style={{ color: '#dc2626' }}>₹{fmt(t.sgst)}</td>
                        <td className="amount" style={{ color: '#9b9590' }}>—</td>
                        <td className="amount" style={{ fontWeight: 600 }}>₹{fmt(t.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f7f5f0', fontWeight: 600 }}>
                      <td colSpan={3} style={{ padding: '12px 16px', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total</td>
                      <td className="amount">₹{fmt(data.output.taxable)}</td>
                      <td className="amount" style={{ color: '#dc2626' }}>₹{fmt(data.output.cgst)}</td>
                      <td className="amount" style={{ color: '#dc2626' }}>₹{fmt(data.output.sgst)}</td>
                      <td className="amount">—</td>
                      <td className="amount">₹{fmt(data.output.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {activeReturn === 'gstr3b' && (
            <div className="card-body">
              <div className="grid-2" style={{ gap: 20 }}>
                {/* Table 3.1 */}
                <div>
                  <h4 style={{ marginBottom: 12 }}>3.1 — Outward Supplies</h4>
                  <GSTR3BTable rows={[
                    { label: 'Taxable outward supplies (B2B+B2C)', taxable: data.output.taxable, cgst: data.output.cgst, sgst: data.output.sgst, igst: data.output.igst },
                    { label: 'Zero-rated supplies (exports)', taxable: 0, cgst: 0, sgst: 0, igst: 0 },
                    { label: 'Nil/exempt supplies', taxable: 0, cgst: 0, sgst: 0, igst: 0 },
                  ]} />
                </div>
                {/* Table 4 */}
                <div>
                  <h4 style={{ marginBottom: 12 }}>4 — Eligible ITC</h4>
                  <GSTR3BTable rows={[
                    { label: 'Import of goods', taxable: 0, cgst: 0, sgst: 0, igst: 0 },
                    { label: 'All other ITC', taxable: data.input.taxable, cgst: data.input.cgst, sgst: data.input.sgst, igst: data.input.igst },
                  ]} />
                </div>
              </div>
              {/* Net payable */}
              <div style={{ marginTop: 24, padding: '16px 20px', background: '#fef3c7', borderRadius: 10, border: '1px solid #fde68a' }}>
                <h4 style={{ marginBottom: 12 }}>6.1 — Tax Payable (after ITC)</h4>
                <div className="flex gap-8">
                  {[
                    { label: 'CGST Payable', value: data.net_payable.cgst },
                    { label: 'SGST Payable', value: data.net_payable.sgst },
                    { label: 'IGST Payable', value: data.net_payable.igst },
                    { label: 'Total', value: data.net_payable.total, bold: true },
                  ].map(r => (
                    <div key={r.label}>
                      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#92400e', marginBottom: 3 }}>{r.label}</div>
                      <div style={{ fontFamily: r.bold ? 'DM Serif Display, serif' : 'inherit', fontSize: r.bold ? '1.2rem' : '1rem', fontWeight: r.bold ? 400 : 600, color: '#92400e' }}>
                        ₹{fmt(r.value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeReturn === 'itc' && (
            <div className="card-body">
              <p className="text-sm text-muted mb-3">
                Input Tax Credit available vs claimed. Discrepancies highlighted in amber.
              </p>
              <div className="table-wrap" style={{ borderRadius: 8 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th className="text-right">As per GSTR-2B</th>
                      <th className="text-right">As per Books</th>
                      <th className="text-right">Difference</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { acc: 'Input CGST', gstr: 38400, books: 38400, diff: 0 },
                      { acc: 'Input SGST', gstr: 38400, books: 38400, diff: 0 },
                      { acc: 'Input IGST', gstr: 0,     books: 0,     diff: 0 },
                    ].map(r => (
                      <tr key={r.acc}>
                        <td style={{ fontWeight: 500 }}>{r.acc}</td>
                        <td className="amount">₹{fmt(r.gstr)}</td>
                        <td className="amount">₹{fmt(r.books)}</td>
                        <td className="amount" style={{ color: r.diff !== 0 ? '#d97706' : '#16a34a' }}>
                          {r.diff !== 0 ? `₹${fmt(Math.abs(r.diff))}` : '—'}
                        </td>
                        <td>
                          <span className={`badge ${r.diff === 0 ? 'badge-green' : 'badge-amber'}`}>
                            {r.diff === 0 ? 'Reconciled' : 'Mismatch'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ title, data, color }) {
  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <div style={{ width: 3, height: 16, borderRadius: 2, background: color }} />
        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9b9590', fontWeight: 500 }}>{title}</span>
      </div>
      {[
        { label: 'Taxable Value', value: data.taxable },
        { label: 'CGST', value: data.cgst },
        { label: 'SGST', value: data.sgst },
        { label: 'IGST', value: data.igst },
      ].map(r => (
        <div key={r.label} className="flex justify-between" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: '0.8rem', color: '#5a5750' }}>{r.label}</span>
          <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>₹{fmt(r.value)}</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid #e5e1d8', paddingTop: 8, marginTop: 4 }}>
        <div className="flex justify-between">
          <span style={{ fontWeight: 600, fontSize: '0.857rem' }}>Total</span>
          <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.1rem', color }}>₹{fmt(data.total)}</span>
        </div>
      </div>
    </div>
  )
}

function GSTR3BTable({ rows }) {
  return (
    <table style={{ fontSize: '0.8rem' }}>
      <thead>
        <tr>
          <th>Nature of Supply</th>
          <th className="text-right">CGST</th>
          <th className="text-right">SGST</th>
          <th className="text-right">IGST</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{ maxWidth: 180, paddingRight: 8 }}>{r.label}</td>
            <td className="amount">₹{fmt(r.cgst)}</td>
            <td className="amount">₹{fmt(r.sgst)}</td>
            <td className="amount">₹{fmt(r.igst)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
