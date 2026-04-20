// src/components/Topbar.jsx — FIXED: working notifications
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import finixLogo from '../assets/logo.png'
import {
  LayoutDashboard, BookOpen, ArrowLeftRight, FileText,
  Users, Building2, Settings, Bell, ChevronDown,
  LogOut, UserCircle, Plus, Check, BarChart2, HelpCircle,
  RefreshCw, FileSpreadsheet, CreditCard, Briefcase,
  PieChart, TrendingUp, Receipt, List, Upload, GitMerge, X
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ModeToggle } from './LaymanModeToggle'

const NAV = [
  { key:'dashboard', label:'Dashboard', icon:LayoutDashboard, to:'/', exact:true },
  { key:'accounting', label:'Accounting', icon:BookOpen, children:[
    { label:'Journal & Ledger',  icon:List,            to:'/journal',       desc:'All vouchers and entries' },
    { label:'Chart of Accounts', icon:FileSpreadsheet, to:'/accounts',      desc:'Account master list' },
    { label:'Trial Balance',     icon:BarChart2,       to:'/trial-balance', desc:'Dr/Cr summary' },
    { label:'Opening Balances',  icon:BarChart2,       to:'/opening-balances', desc:'Migrate from another software' },
  ]},
  { key:'banking', label:'Banking', icon:CreditCard, children:[
    { label:'Bank Accounts',      icon:Briefcase,      to:'/bank?tab=accounts',  desc:'Manage bank accounts' },
    { label:'Reconciliation',     icon:RefreshCw,      to:'/bank?tab=reconcile', desc:'Match transactions' },
    { label:'Import Statement',   icon:ArrowLeftRight, to:'/bank?tab=import',    desc:'Upload CSV/Excel/PDF' },
    { label:'Smart Reconcile',    icon:GitMerge,       to:'/reconcile',          desc:'AI-powered bank matching', badge:'AI' },
    { label:'Upload & Auto-Post', icon:Upload,         to:'/upload',             desc:'Zero manual entry pipeline', badge:'AI' },
  ]},
  { key:'compliance', label:'GST & Tax', icon:Receipt, children:[
    { label:'GST Reports',   icon:FileText, to:'/gst', desc:'GSTR-1, GSTR-3B' },
    { label:'GSTR-1 Filing', icon:FileText, to:'/gst', desc:'Outward supplies' },
    { label:'TDS / TCS',     icon:Receipt,  to:'/gst', desc:'Tax deducted at source' },
  ]},
  { key:'payroll', label:'Payroll', icon:Users, children:[
    { label:'Salary Processing', icon:Users,      to:'/payroll?tab=salary',    desc:'Run monthly payroll' },
    { label:'Employee Master',   icon:UserCircle, to:'/payroll?tab=employees', desc:'Manage employees' },
    { label:'PF / ESIC / TDS',   icon:FileText,   to:'/payroll?tab=statutory', desc:'Statutory compliance' },
  ]},
  { key:'reports', label:'Reports', icon:PieChart, children:[
    { label:'P&L Statement', icon:TrendingUp,     to:'/reports?tab=pl',            desc:'Profit & loss' },
    { label:'Balance Sheet', icon:BarChart2,      to:'/reports?tab=balance-sheet', desc:'Assets & liabilities' },
    { label:'Cash Flow',     icon:ArrowLeftRight, to:'/reports?tab=cashflow',       desc:'Inflow / outflow' },
  ]},
]

const MOCK_NOTIFICATIONS = [
  { id:1, type:'warning', title:'Bank Reconciliation Pending', body:'4 transactions unmatched for March 2024', time:'2 min ago', read:false, action:'/reconcile' },
  { id:2, type:'info',    title:'GSTR-1 Due Soon',            body:'Filing deadline: April 11, 2024',         time:'1 hr ago',  read:false, action:'/gst' },
  { id:3, type:'success', title:'Payroll Processed',          body:'March 2024 payroll posted successfully',  time:'3 hrs ago', read:true,  action:'/payroll' },
  { id:4, type:'warning', title:'Outstanding Receivables',    body:'₹1,85,000 overdue for 60+ days',         time:'1 day ago', read:true,  action:'/reports' },
]

const NOTIF_ICON = { warning:'⚠️', info:'ℹ️', success:'✅', error:'❌' }

function useOutsideClick(ref, cb) {
  useEffect(() => {
    const h = (e) => { if(ref.current && !ref.current.contains(e.target)) cb() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  },[ref,cb])
}

export default function Topbar() {
  const { user, companies, activeCompany, switchCompany, logout } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [open,     setOpen]     = useState(null)
  const [coDrop,   setCoDrop]   = useState(false)
  const [userDrop, setUserDrop] = useState(false)
  const [notifOpen,setNotifOpen]= useState(false)
  const [notifs,   setNotifs]   = useState(MOCK_NOTIFICATIONS)
  const navRef    = useRef(null)
  const coRef     = useRef(null)
  const userRef   = useRef(null)
  const notifRef  = useRef(null)

  useOutsideClick(navRef,   ()=>setOpen(null))
  useOutsideClick(coRef,    ()=>setCoDrop(false))
  useOutsideClick(userRef,  ()=>setUserDrop(false))
  useOutsideClick(notifRef, ()=>setNotifOpen(false))

  const unreadCount = notifs.filter(n=>!n.read).length

  const markAllRead  = () => setNotifs(n=>n.map(x=>({...x,read:true})))
  const markRead     = (id) => setNotifs(n=>n.map(x=>x.id===id?{...x,read:true}:x))
  const dismiss      = (id) => setNotifs(n=>n.filter(x=>x.id!==id))

  const isActive = (item) => {
    if(item.to){ const p=item.to.split('?')[0]; return item.exact?location.pathname===p:location.pathname.startsWith(p) }
    if(item.children) return item.children.some(c=>location.pathname===c.to.split('?')[0])
    return false
  }

  const goTo = (to) => {
    const [path,query]=to.split('?')
    navigate(query?`${path}?${query}`:path)
    setOpen(null); setCoDrop(false); setNotifOpen(false)
  }

  return (
    <header className="topbar">
      <div className="tb-logo" onClick={()=>goTo('/')} style={{cursor:'pointer'}}>
        <img src={finixLogo} alt="Finix" style={{height:32,width:'auto',display:'block'}}/>
      </div>

      <nav className="tb-nav" ref={navRef}>
        {NAV.map(item=>(
          <div key={item.key} className={`tb-item${open===item.key?' open':''}`}>
            <div className={`tb-link${isActive(item)?' active':''}`}
              onClick={()=>{ if(item.to){goTo(item.to);setOpen(null)} else setOpen(open===item.key?null:item.key) }}>
              <item.icon size={14}/>{item.label}
              {item.children&&<ChevronDown size={12} className="caret"/>}
            </div>
            {item.children&&open===item.key&&(
              <div className="tb-dropdown">
                <div className="dd-header">{item.label}</div>
                {item.children.map(child=>(
                  <button key={child.to+child.label} className={`dd-item${location.pathname===child.to.split('?')[0]?' active':''}`} onClick={()=>goTo(child.to)}>
                    <child.icon size={14}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,fontWeight:600,marginBottom:1}}>
                        {child.label}
                        {child.badge&&<span style={{fontSize:9,padding:'1px 4px',borderRadius:3,background:'linear-gradient(135deg,#2563EB,#7C3AED)',color:'#fff',fontWeight:700,flexShrink:0}}>AI</span>}
                      </div>
                      <div style={{fontSize:'var(--fs-xs)',color:'var(--text-4)',fontWeight:400}}>{child.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="tb-right">
        <ModeToggle/>

        {/* Company switcher */}
        <div style={{position:'relative'}} ref={coRef}>
          <div className="company-switcher" onClick={()=>setCoDrop(d=>!d)}>
            <div className="co-dot" style={{background:activeCompany?.color||'rgba(255,255,255,.2)'}}>{activeCompany?.initials||'?'}</div>
            <div style={{overflow:'hidden'}}><div className="co-name">{activeCompany?.name||'Select Company'}</div><div className="co-fy">{activeCompany?.fy}</div></div>
            <ChevronDown size={12} style={{opacity:.7,flexShrink:0}}/>
          </div>
          {coDrop&&(
            <div className="tb-dropdown" style={{right:0,left:'auto',minWidth:240}}>
              <div className="dd-header">Switch Company</div>
              {companies.map(co=>(
                <button key={co.id} className={`dd-item${activeCompany?.id===co.id?' active':''}`} onClick={()=>{switchCompany(co);setCoDrop(false)}}>
                  <div style={{width:20,height:20,borderRadius:4,background:co.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'white',flexShrink:0}}>{co.initials}</div>
                  <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:'var(--fs-sm)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{co.name}</div><div style={{fontSize:'var(--fs-xs)',color:'var(--text-4)'}}>{co.type}</div></div>
                  {activeCompany?.id===co.id&&<Check size={13}/>}
                </button>
              ))}
              <div className="dd-sep"/>
              <button className="dd-item" onClick={()=>{goTo('/companies');setCoDrop(false)}}><Plus size={14}/><div><div style={{fontWeight:600}}>Add / Manage Companies</div></div></button>
            </div>
          )}
        </div>

        {/* ── Notifications (FIXED) ── */}
        <div style={{position:'relative'}} ref={notifRef}>
          <button className="tb-icon-btn" title="Notifications" style={{position:'relative'}} onClick={()=>setNotifOpen(v=>!v)}>
            <Bell size={16}/>
            {unreadCount>0&&<span style={{position:'absolute',top:2,right:2,width:8,height:8,borderRadius:'50%',background:'var(--danger)',border:'2px solid var(--surface)'}}/>}
          </button>
          {notifOpen&&(
            <div className="notif-panel">
              <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontWeight:700,fontSize:13}}>Notifications {unreadCount>0&&<span style={{marginLeft:5,padding:'1px 6px',borderRadius:10,background:'var(--danger)',color:'#fff',fontSize:10}}>{unreadCount}</span>}</span>
                {unreadCount>0&&<button style={{fontSize:11,color:'var(--accent)',background:'none',border:'none',cursor:'pointer',fontWeight:500}} onClick={markAllRead}>Mark all read</button>}
              </div>
              {notifs.length===0&&<div style={{padding:24,textAlign:'center',color:'var(--text-3)',fontSize:13}}>No notifications</div>}
              {notifs.map(n=>(
                <div key={n.id} className={`notif-item${n.read?'':' unread'}`} onClick={()=>{markRead(n.id);goTo(n.action)}}>
                  <span style={{fontSize:16,flexShrink:0}}>{NOTIF_ICON[n.type]}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:n.read?400:600,fontSize:12,marginBottom:2}}>{n.title}</div>
                    <div style={{fontSize:11,color:'var(--text-3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n.body}</div>
                    <div style={{fontSize:10,color:'var(--text-4)',marginTop:2}}>{n.time}</div>
                  </div>
                  <button onClick={e=>{e.stopPropagation();dismiss(n.id)}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-4)',padding:'2px',flexShrink:0}}><X size={12}/></button>
                </div>
              ))}
              <div style={{padding:'8px 14px',borderTop:'1px solid var(--border)',textAlign:'center'}}>
                <button style={{fontSize:11,color:'var(--accent)',background:'none',border:'none',cursor:'pointer'}}>View all notifications</button>
              </div>
            </div>
          )}
        </div>

        <button className="tb-icon-btn" title="Help"><HelpCircle size={16}/></button>

        {/* User dropdown */}
        <div style={{position:'relative'}} ref={userRef}>
          <button className="user-btn" onClick={()=>setUserDrop(d=>!d)}>
            <div className="user-av">{user?.name?.charAt(0)||'U'}</div>
            <span style={{maxWidth:90,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.name}</span>
            <ChevronDown size={12} style={{opacity:.7,flexShrink:0}}/>
          </button>
          {userDrop&&(
            <div className="tb-dropdown" style={{right:0,left:'auto',minWidth:200}}>
              <div style={{padding:'12px 14px',borderBottom:'1px solid var(--border)'}}>
                <div style={{fontWeight:600,fontSize:'var(--fs-sm)'}}>{user?.name}</div>
                <div style={{fontSize:'var(--fs-xs)',color:'var(--text-3)',marginTop:2}}>{user?.email}</div>
                <span className="badge badge-blue" style={{marginTop:5}}>{user?.role}</span>
              </div>
              <button className="dd-item" onClick={()=>{goTo('/companies');setUserDrop(false)}}><Building2 size={14}/><div><div style={{fontWeight:600}}>Manage Companies</div></div></button>
              <button className="dd-item" onClick={()=>{goTo('/settings');setUserDrop(false)}}><Settings size={14}/><div><div style={{fontWeight:600}}>Settings</div></div></button>
              <div className="dd-sep"/>
              <button className="dd-item" style={{color:'var(--danger)'}} onClick={logout}><LogOut size={14}/><div><div style={{fontWeight:600}}>Sign Out</div></div></button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
