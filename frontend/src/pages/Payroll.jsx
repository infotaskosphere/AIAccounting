// src/pages/Payroll.jsx
import { useState } from 'react'
import { UserPlus, Play, Download, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { mockPayroll } from '../api/mockData'
import { fmt } from '../utils/format'

const months = ['January 2024','February 2024','March 2024']

export default function Payroll() {
  const [period, setPeriod] = useState('March 2024')
  const [payroll, setPayroll] = useState(mockPayroll)
  const [running, setRunning] = useState(false)
  const [expanded, setExpanded] = useState(null)

  const runPayroll = () => {
    setRunning(true)
    setTimeout(() => {
      setRunning(false)
      toast.success(`Payroll for ${period} processed · Journal entry auto-created`)
    }, 2000)
  }

  const { employees, totals } = payroll

  return (
    <div className="page-enter">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Payroll</h1>
          <p>Salary computation · TDS, PF, ESIC · Auto journal entry</p>
        </div>
        <div className="flex gap-2">
          <select value={period} onChange={e => setPeriod(e.target.value)} style={{ width: 180 }}>
            {months.map(m => <option key={m}>{m}</option>)}
          </select>
          <button className="btn btn-outline"><UserPlus size={14} /> Add Employee</button>
          <button className="btn btn-accent" onClick={runPayroll} disabled={running}>
            {running ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Play size={14} />}
            Run Payroll
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Summary row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Gross Salary', value: totals.gross, color: '#1a1a1a' },
            { label: 'PF (Employee + Employer)', value: totals.pf_employee * 2, color: '#7c3aed' },
            { label: 'ESIC', value: totals.esic_employee * 2, color: '#2563eb' },
            { label: 'TDS', value: totals.tds, color: '#d97706' },
            { label: 'Net Payable', value: totals.net, color: '#16a34a' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9b9590', marginBottom: 5 }}>{s.label}</div>
              <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.35rem', color: s.color }}>₹{fmt(s.value)}</div>
            </div>
          ))}
        </div>

        {/* Journal entry preview */}
        <div className="card mb-3">
          <div className="card-header">
            <h3>Auto-Generated Journal Entry</h3>
            <span className="badge badge-blue">Preview</span>
          </div>
          <div className="card-body" style={{ padding: '12px 24px' }}>
            <table style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th>Account</th>
                  <th className="text-right">Dr (₹)</th>
                  <th className="text-right">Cr (₹)</th>
                  <th>Narration</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { acc: '8001 · Salaries & Wages', dr: totals.gross, cr: 0, note: 'Gross salary — March 2024' },
                  { acc: '8001 · Salaries & Wages', dr: totals.pf_employee, cr: 0, note: 'Employer PF contribution' },
                  { acc: '8001 · Salaries & Wages', dr: totals.esic_employee, cr: 0, note: 'Employer ESIC contribution' },
                  { acc: '3300 · Salary Payable', dr: 0, cr: totals.net, note: 'Net salary payable' },
                  { acc: '3201 · PF Payable', dr: 0, cr: totals.pf_employee * 2, note: 'Employee + Employer PF' },
                  { acc: '3202 · ESIC Payable', dr: 0, cr: totals.esic_employee * 2, note: 'Employee + Employer ESIC' },
                  { acc: '3200 · TDS Payable', dr: 0, cr: totals.tds, note: 'TDS deducted' },
                ].map((r, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ fontSize: '0.78rem' }}>{r.acc}</td>
                    <td className="amount dr">{r.dr > 0 ? `₹${fmt(r.dr)}` : '—'}</td>
                    <td className="amount cr">{r.cr > 0 ? `₹${fmt(r.cr)}` : '—'}</td>
                    <td style={{ color: '#9b9590', fontSize: '0.78rem' }}>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Employee table */}
        <div className="card">
          <div className="card-header">
            <h3>Employee Payroll — {period}</h3>
            <button className="btn btn-outline btn-sm"><Download size={13} /> Export</button>
          </div>
          <div className="table-wrap" style={{ borderRadius: 0, border: 'none', boxShadow: 'none', borderTop: '1px solid #e5e1d8' }}>
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Employee</th>
                  <th className="text-right">Basic</th>
                  <th className="text-right">HRA</th>
                  <th className="text-right">Gross</th>
                  <th className="text-right">PF</th>
                  <th className="text-right">ESIC</th>
                  <th className="text-right">TDS</th>
                  <th className="text-right">Net Pay</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <>
                    <tr key={emp.id} style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === emp.id ? null : emp.id)}>
                      <td style={{ width: 36 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 6, background: '#e0e7ff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.7rem', fontWeight: 600, color: '#4338ca' }}>
                          {emp.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{emp.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#9b9590' }}>{emp.designation}</div>
                      </td>
                      <td className="amount">₹{fmt(emp.basic)}</td>
                      <td className="amount">₹{fmt(emp.hra)}</td>
                      <td className="amount" style={{ fontWeight: 600 }}>₹{fmt(emp.gross)}</td>
                      <td className="amount" style={{ color: '#7c3aed' }}>₹{fmt(emp.pf)}</td>
                      <td className="amount" style={{ color: '#2563eb' }}>{emp.esic > 0 ? `₹${fmt(emp.esic)}` : '—'}</td>
                      <td className="amount" style={{ color: '#d97706' }}>{emp.tds > 0 ? `₹${fmt(emp.tds)}` : '—'}</td>
                      <td className="amount" style={{ color: '#16a34a', fontWeight: 700 }}>₹{fmt(emp.net)}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px' }}>
                          {expanded === emp.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      </td>
                    </tr>
                    {expanded === emp.id && (
                      <tr key={`${emp.id}-detail`} style={{ background: '#f7f5f0' }}>
                        <td colSpan={10} style={{ padding: '14px 24px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9b9590' }}>Earnings</div>
                              {[['Basic', emp.basic], ['HRA', emp.hra], ['Special Allowance', emp.special], ['Gross', emp.gross]].map(([l, v]) => (
                                <div key={l} className="flex justify-between" style={{ padding: '4px 0', borderBottom: '1px solid #ede9e0', fontSize: '0.857rem' }}>
                                  <span style={{ color: '#5a5750' }}>{l}</span>
                                  <span style={{ fontWeight: l === 'Gross' ? 600 : 400 }}>₹{fmt(v)}</span>
                                </div>
                              ))}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9b9590' }}>Deductions</div>
                              {[['PF (12% of Basic)', emp.pf], ['ESIC (0.75%)', emp.esic], ['TDS', emp.tds]].map(([l, v]) => (
                                <div key={l} className="flex justify-between" style={{ padding: '4px 0', borderBottom: '1px solid #ede9e0', fontSize: '0.857rem' }}>
                                  <span style={{ color: '#5a5750' }}>{l}</span>
                                  <span style={{ color: '#dc2626' }}>{v > 0 ? `₹${fmt(v)}` : '—'}</span>
                                </div>
                              ))}
                              <div className="flex justify-between" style={{ padding: '8px 0', fontSize: '0.9rem', fontWeight: 700 }}>
                                <span>Net Payable</span>
                                <span style={{ color: '#16a34a' }}>₹{fmt(emp.net)}</span>
                              </div>
                            </div>
                          </div>
                          <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }}>
                            <Download size={12} /> Download Payslip
                          </button>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f0ede6', fontWeight: 700 }}>
                  <td colSpan={2} style={{ padding: '13px 16px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total ({employees.length} employees)</td>
                  <td colSpan={2}></td>
                  <td className="amount">₹{fmt(totals.gross)}</td>
                  <td className="amount" style={{ color: '#7c3aed' }}>₹{fmt(totals.pf_employee)}</td>
                  <td className="amount" style={{ color: '#2563eb' }}>₹{fmt(totals.esic_employee)}</td>
                  <td className="amount" style={{ color: '#d97706' }}>₹{fmt(totals.tds)}</td>
                  <td className="amount" style={{ color: '#16a34a' }}>₹{fmt(totals.net)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
