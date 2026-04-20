// src/components/Topbar.jsx  (v2 — UPGRADED)
// Added: Mode toggle, Upload nav, Reconcile nav, AI badge
import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, Users, BarChart2, CreditCard,
  FileText, Briefcase, BarChart, Building2, LogOut,
  ChevronDown, Menu, X, Upload, GitMerge, Zap
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ModeToggle } from './LaymanModeToggle'

const NAV_ACCOUNTANT = [
  { to:'/',            icon: LayoutDashboard, label:'Dashboard' },
  { to:'/upload',      icon: Upload,          label:'Upload',    badge:'AI', isNew: true },
  { to:'/reconcile',   icon: GitMerge,        label:'Reconcile', badge:'AI', isNew: true },
  { to:'/journal',     icon: BookOpen,        label:'Journal' },
  { to:'/accounts',    icon: Users,           label:'Accounts' },
  { to:'/bank',        icon: CreditCard,      label:'Bank' },
  { to:'/trial-balance', icon: BarChart2,     label:'Trial Balance' },
  { to:'/reports',     icon: BarChart,        label:'Reports' },
  { to:'/gst',         icon: FileText,        label:'GST' },
  { to:'/payroll',     icon: Briefcase,       label:'Payroll' },
  { to:'/companies',   icon: Building2,       label:'Companies' },
]

const NAV_SIMPLE = [
  { to:'/',         icon: LayoutDashboard, label:'Home' },
  { to:'/upload',   icon: Upload,          label:'Upload File', badge:'AI' },
  { to:'/reports',  icon: BarChart,        label:'Reports' },
]

export default function Topbar() {
  const { user, activeCompany, companies, switchCompany, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [coMenu, setCoMenu] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const coRef = useRef(null)

  // Close menus on outside click
  useEffect(() => {
    const fn = (e) => { if (coRef.current && !coRef.current.contains(e.target)) setCoMenu(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }
  const path = location.pathname

  return (
    <>
      <header style={{
        height: 'var(--topbar-h)', background:'var(--surface)',
        borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', padding:'0 16px',
        position:'sticky', top:0, zIndex:200,
        boxShadow:'var(--shadow-xs)',
      }}>

        {/* Logo */}
        <Link to="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none', marginRight:20, flexShrink:0 }}>
          <div style={{
            width:26, height:26, borderRadius:6,
            background:'linear-gradient(135deg,#2563EB,#7C3AED)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <Zap size={14} color="#fff" />
          </div>
          <span style={{ fontSize:15, fontWeight:800, color:'var(--text)', letterSpacing:'-.3px' }}>FINIX</span>
          <span style={{ fontSize:10, padding:'1px 5px', background:'var(--primary-l)', color:'var(--accent)', borderRadius:4, fontWeight:700 }}>AI</span>
        </Link>

        {/* Desktop Nav */}
        <nav style={{ display:'flex', gap:2, flex:1, overflowX:'auto', scrollbarWidth:'none' }}>
          {NAV_ACCOUNTANT.map(({ to, icon: Icon, label, badge }) => {
            const active = to === '/' ? path === '/' : path.startsWith(to)
            return (
              <Link key={to} to={to} style={{
                display:'flex', alignItems:'center', gap:5, padding:'5px 8px',
                borderRadius:'var(--r-md)', textDecoration:'none', whiteSpace:'nowrap',
                fontSize:'var(--fs-sm)', fontWeight: active ? 600 : 400,
                color: active ? 'var(--accent)' : 'var(--text-3)',
                background: active ? 'var(--primary-l)' : 'transparent',
                transition:'all var(--dur)',
                flexShrink:0,
              }}>
                <Icon size={13} />
                {label}
                {badge && (
                  <span style={{ fontSize:9, padding:'1px 4px', borderRadius:3, background:'linear-gradient(135deg,#2563EB,#7C3AED)', color:'#fff', fontWeight:700 }}>{badge}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Right side */}
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0, marginLeft:12 }}>
          {/* Mode Toggle */}
          <ModeToggle />

          {/* Company Switcher */}
          {companies?.length > 0 && (
            <div ref={coRef} style={{ position:'relative' }}>
              <button
                onClick={() => setCoMenu(v => !v)}
                style={{
                  display:'flex', alignItems:'center', gap:6, padding:'5px 10px',
                  border:'1px solid var(--border)', borderRadius:'var(--r-md)',
                  background:'var(--surface-2)', cursor:'pointer',
                  fontSize:'var(--fs-sm)', fontWeight:500, color:'var(--text-2)',
                  maxWidth:160,
                }}
              >
                <Building2 size={12} />
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
                  {activeCompany?.name || 'Company'}
                </span>
                <ChevronDown size={11} />
              </button>
              {coMenu && (
                <div style={{
                  position:'absolute', top:'calc(100% + 4px)', right:0, minWidth:200,
                  background:'var(--surface)', border:'1px solid var(--border)',
                  borderRadius:'var(--r-lg)', boxShadow:'var(--shadow-dropdown)', zIndex:300,
                  overflow:'hidden',
                }}>
                  <div style={{ padding:'6px 12px', fontSize:10, fontWeight:700, color:'var(--text-4)', textTransform:'uppercase', borderBottom:'1px solid var(--border)' }}>Companies</div>
                  {companies.map(co => (
                    <button key={co.id} onClick={() => { switchCompany(co); setCoMenu(false) }} style={{
                      display:'block', width:'100%', textAlign:'left', padding:'8px 14px',
                      border:'none', background: activeCompany?.id === co.id ? 'var(--primary-l)' : 'transparent',
                      color: activeCompany?.id === co.id ? 'var(--accent)' : 'var(--text)',
                      cursor:'pointer', fontSize:'var(--fs-sm)',
                    }}>
                      {co.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* User / Logout */}
          <button onClick={handleLogout} title="Logout" style={{
            display:'flex', alignItems:'center', gap:5, padding:'5px 10px',
            border:'1px solid var(--border)', borderRadius:'var(--r-md)',
            background:'transparent', cursor:'pointer',
            fontSize:'var(--fs-sm)', color:'var(--text-3)',
          }}>
            <LogOut size={12} />
            <span style={{ display:'none', whiteSpace:'nowrap' }}>{user?.email?.split('@')[0]}</span>
          </button>
        </div>
      </header>
    </>
  )
}
