// src/pages/Dashboard.jsx
import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { TrendingUp, TrendingDown, AlertTriangle, Info, CheckCircle, ArrowRight } from 'lucide-react'
import { mockDashboard } from '../api/mockData'
import { fmt, fmtCr } from '../utils/format'

const COLORS = { inflow: '#2563eb', outflow: '#e5e7eb' }

const voucherTypeColor = {
  sales: 'badge-green', purchase: 'badge-red',
  receipt: 'badge-blue', payment: 'badge-amber',
  journal: 'badge-gray',
}

export default function Dashboard() {
  const [data, setData] = useState(mockDashboard)

  const bs = data.balanceSheet

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Good morning, Acme Corp</h1>
          <p>Financial snapshot for FY 2024-25 · March 2024</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline">Export PDF</button>
          <button className="btn btn-primary">+ New Entry</button>
        </div>
      </div>

      <div className="page-body">
        {/* Alerts */}
        {data.alerts.map((alert, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 16px', borderRadius: 8, marginBottom: 8,
            background: alert.type === 'warning' ? '#fef3c7'
              : alert.type === 'success' ? '#dcfce7' : '#dbeafe',
            fontSize: '0.85rem',
            color: alert.type === 'warning' ? '#92400e'
              : alert.type === 'success' ? '#15803d' : '#1e40af',
          }}>
            {alert.type === 'warning' && <AlertTriangle size={14} />}
            {alert.type === 'info'    && <Info size={14} />}
            {alert.type === 'success' && <CheckCircle size={14} />}
            <span style={{ flex: 1 }}>{alert.message}</span>
            {alert.action && (
              <button style={{ fontWeight: 500, background: 'none', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                color: 'inherit', fontSize: 'inherit' }}>
                {alert.action} <ArrowRight size={12} />
              </button>
            )}
          </div>
        ))}

        {/* Metric cards */}
        <div className="metric-grid" style={{ marginTop: 20 }}>
          <MetricCard label="Total Revenue" value={fmtCr(bs.income)}
            sub="+18% vs last year" trend="up" accent="#2563eb" />
          <MetricCard label="Net Profit" value={fmtCr(bs.net_profit)}
            sub={`Margin ${((bs.net_profit/bs.income)*100).toFixed(1)}%`} trend="up" accent="#16a34a" />
          <MetricCard label="Total Assets" value={fmtCr(bs.assets)}
            sub="Including receivables" trend="up" accent="#7c3aed" />
          <MetricCard label="Net Payables" value={fmtCr(bs.liabilities)}
            sub="Creditors + tax liabilities" trend="down" accent="#dc2626" />
        </div>

        {/* Charts row */}
        <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
          {/* Cash flow chart */}
          <div className="card">
            <div className="card-header">
              <h3>Cash Flow — Last 6 Months</h3>
              <span className="badge badge-blue">Monthly</span>
            </div>
            <div className="card-body" style={{ paddingTop: 12 }}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.cashflow} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="inflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="outflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9b9590' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9b9590' }} axisLine={false} tickLine={false}
                    tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} />
                  <Tooltip formatter={(v) => [`₹${fmt(v)}`, '']}
                    contentStyle={{ border: '1px solid #e5e1d8', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="inflow" name="Inflow"
                    stroke="#2563eb" strokeWidth={2} fill="url(#inflow)" />
                  <Area type="monotone" dataKey="outflow" name="Outflow"
                    stroke="#dc2626" strokeWidth={2} fill="url(#outflow)" />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* P&L bar chart */}
          <div className="card">
            <div className="card-header">
              <h3>Income vs Expenses</h3>
              <span className="badge badge-green">FY 2024-25</span>
            </div>
            <div className="card-body" style={{ paddingTop: 12 }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.cashflow} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ede6" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9b9590' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9b9590' }} axisLine={false} tickLine={false}
                    tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} />
                  <Tooltip formatter={(v) => [`₹${fmt(v)}`, '']}
                    contentStyle={{ border: '1px solid #e5e1d8', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="inflow" name="Income" fill="#2563eb" radius={[4,4,0,0]} />
                  <Bar dataKey="outflow" name="Expenses" fill="#e5e1d8" radius={[4,4,0,0]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Balance Sheet summary + Recent transactions */}
        <div className="grid-2" style={{ gap: 20 }}>
          {/* Mini balance sheet */}
          <div className="card">
            <div className="card-header"><h3>Balance Sheet Summary</h3></div>
            <div className="card-body" style={{ padding: '16px 24px' }}>
              {[
                { label: 'Total Assets', value: bs.assets, color: '#2563eb' },
                { label: 'Total Liabilities', value: bs.liabilities, color: '#dc2626' },
                { label: 'Owner\'s Equity', value: bs.equity, color: '#16a34a' },
              ].map(row => (
                <div key={row.label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 0', borderBottom: '1px solid #f0ede6'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 3, height: 18, borderRadius: 2, background: row.color }} />
                    <span style={{ fontSize: '0.875rem', color: '#5a5750' }}>{row.label}</span>
                  </div>
                  <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.1rem' }}>
                    {fmtCr(row.value)}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 }}>
                <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>Net Profit (YTD)</span>
                <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.1rem', color: '#16a34a' }}>
                  {fmtCr(bs.net_profit)}
                </span>
              </div>
            </div>
          </div>

          {/* Recent vouchers */}
          <div className="card">
            <div className="card-header">
              <h3>Recent Transactions</h3>
              <a href="/journal" style={{ fontSize: '0.8rem', color: '#2563eb', textDecoration: 'none' }}>
                View all →
              </a>
            </div>
            <div style={{ padding: '8px 0' }}>
              {data.recentVouchers.map(v => (
                <div key={v.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 24px', borderBottom: '1px solid #f7f5f0'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.857rem', fontWeight: 500, marginBottom: 2,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {v.narration}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9b9590' }}>
                      {v.voucher_no} · {v.date}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem',
                      color: ['receipt','sales'].includes(v.voucher_type) ? '#16a34a' : '#dc2626' }}>
                      {['receipt','sales'].includes(v.voucher_type) ? '+' : '−'}₹{fmt(v.amount)}
                    </div>
                    <span className={`badge ${voucherTypeColor[v.voucher_type]}`} style={{ marginTop: 3 }}>
                      {v.voucher_type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, trend, accent }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className={`metric-sub ${trend}`}>
        {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {sub}
      </div>
    </div>
  )
}
