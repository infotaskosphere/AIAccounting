// src/components/Sidebar.jsx
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, ArrowLeftRight,
  FileText, Users, Building2, Settings,
  Zap, ChevronLeft, ChevronRight
} from 'lucide-react'

const navItems = [
  { label: 'Dashboard',       icon: LayoutDashboard, to: '/',         end: true },
  { label: 'Journal & Ledger',icon: BookOpen,        to: '/journal' },
  { label: 'Bank & Reconcile',icon: ArrowLeftRight,  to: '/bank' },
  { label: 'GST Reports',     icon: FileText,        to: '/gst' },
  { label: 'Payroll',         icon: Users,           to: '/payroll' },
]

const bottomItems = [
  { label: 'Accounts',  icon: Building2, to: '/accounts' },
  { label: 'Settings',  icon: Settings,  to: '/settings' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">
          <Zap size={16} color="#fff" fill="#fff" />
        </div>
        <div className="logo-text">
          <div className="logo-wordmark">FINIX</div>
          <div className="logo-tagline">Intelligent Finance</div>
        </div>
      </div>

      {/* Main Nav */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">Main Menu</div>
        <nav style={{ marginBottom: 20 }}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <item.icon size={17} className="nav-icon" />
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-section-label">Settings</div>
        <nav>
          {bottomItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <item.icon size={17} className="nav-icon" />
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Company + Collapse */}
      <div className="sidebar-bottom">
        <div className="company-pill">
          <div className="company-avatar">AC</div>
          <div className="company-info">
            <div className="company-name">Acme Corp Pvt Ltd</div>
            <div className="company-plan">Pro · FY 2024-25</div>
          </div>
        </div>

        <button
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <ChevronRight size={16} />
            : <><ChevronLeft size={16} /><span className="nav-label" style={{ fontSize: '0.78rem' }}>Collapse</span></>
          }
        </button>
      </div>
    </aside>
  )
}
