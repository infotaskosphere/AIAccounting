// src/pages/Login.jsx — Enhanced India-first login with logo
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, LogIn, AlertCircle, Shield, Zap } from 'lucide-react'
import finixLogo from '../assets/logo.png'

export default function Login() {
  const { login } = useAuth()
  const [form,    setForm]    = useState({ email: '', password: '' })
  const [show,    setShow]    = useState(false)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 600))
    const res = login(form.email, form.password)
    if (res.error) setError(res.error)
    setLoading(false)
  }

  const DEMO_ACCOUNTS = [
    { label:'Admin', email:'admin@finix.in', password:'admin123', role:'Full Access' },
    { label:'Accountant', email:'ravi@finix.in', password:'ravi123', role:'Accountant' },
    { label:'Auditor', email:'priya@finix.in', password:'priya123', role:'Read Only' },
  ]

  return (
    <div className="login-shell">
      <div style={{ width:'100%', maxWidth:440 }}>
        <div className="login-card">
          {/* Logo header */}
          <div className="login-header" style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'28px 24px 20px' }}>
            <img src={finixLogo} alt="FINIX" style={{ height:44, width:'auto', display:'block', marginBottom:10 }}/>
            <div style={{ fontSize:10, letterSpacing:'.12em', color:'rgba(255,255,255,.55)', fontWeight:600 }}>AI ACCOUNTING SOFTWARE FOR INDIA</div>
          </div>

          <div className="login-body">
            <div className="login-title">Welcome back</div>
            <div className="login-sub" style={{ marginBottom:20 }}>Sign in to your FINIX account</div>

            {error && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px', background:'var(--danger-l)', border:'1px solid var(--danger-b)', borderRadius:'var(--r-md)', marginBottom:16, fontSize:'var(--fs-sm)', color:'var(--danger)' }}>
                <AlertCircle size={14}/>{error}
              </div>
            )}

            <form onSubmit={handle}>
              <div className="field-group">
                <label className="field-label">Email Address</label>
                <input type="email" className="input" placeholder="you@company.in" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required autoFocus/>
              </div>
              <div className="field-group" style={{ marginBottom:8 }}>
                <label className="field-label">Password</label>
                <div style={{ position:'relative' }}>
                  <input type={show ? 'text' : 'password'} className="input" placeholder="Enter your password" value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required style={{ paddingRight:36 }}/>
                  <button type="button" onClick={() => setShow(s => !s)}
                    style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-4)', background:'none', border:'none', cursor:'pointer', display:'flex' }}>
                    {show ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>
              <div style={{ textAlign:'right', marginBottom:18 }}>
                <button type="button" style={{ fontSize:'var(--fs-xs)', color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font)' }}>
                  Forgot password?
                </button>
              </div>
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width:'100%', justifyContent:'center' }}>
                {loading
                  ? <span style={{ width:15, height:15, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'white', borderRadius:'50%', display:'inline-block', animation:'spin .7s linear infinite' }}/>
                  : <LogIn size={15}/>}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="login-divider">DEMO ACCOUNTS</div>

            <div style={{ display:'grid', gap:8 }}>
              {DEMO_ACCOUNTS.map(d => (
                <button key={d.email} type="button" className="btn btn-secondary" style={{ width:'100%', justifyContent:'space-between', fontSize:12 }}
                  onClick={() => setForm({ email: d.email, password: d.password })}>
                  <span style={{ fontWeight:600 }}>{d.label}</span>
                  <span style={{ color:'var(--text-3)', fontSize:11 }}>{d.role} · {d.email}</span>
                </button>
              ))}
            </div>

            {/* Trust badges */}
            <div style={{ marginTop:20, display:'flex', gap:12, justifyContent:'center' }}>
              {[
                { icon:Shield, text:'GST Compliant' },
                { icon:Zap,    text:'AI-Powered' },
              ].map(b => (
                <div key={b.text} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-4)' }}>
                  <b.icon size={12}/>{b.text}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ textAlign:'center', marginTop:16, fontSize:'var(--fs-xs)', color:'rgba(255,255,255,.45)' }}>
          © 2026 FINIX · Intelligent Finance Software for India
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
