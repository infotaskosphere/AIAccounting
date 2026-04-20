// src/components/SmartAssistant.jsx
// Floating conversational AI assistant panel
import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Zap, ChevronRight, Loader } from 'lucide-react'
import { assistantApi } from '../api/client'

const QUICK = [
  "What is my profit this month?",
  "What's my bank balance?",
  "How much GST do I owe?",
  "Show pending payments",
  "Top expenses this month",
]

function Bubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display:'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom:10 }}>
      {!isUser && (
        <div style={{ width:26, height:26, borderRadius:'50%', background:'linear-gradient(135deg,#2563EB,#7C3AED)', display:'flex', alignItems:'center', justifyContent:'center', marginRight:8, flexShrink:0, marginTop:2 }}>
          <Zap size={12} color="#fff" />
        </div>
      )}
      <div style={{
        maxWidth:'80%', padding:'9px 12px', borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        background: isUser ? 'linear-gradient(135deg,#2563EB,#1D4ED8)' : 'var(--surface)',
        color: isUser ? '#fff' : 'var(--text)',
        fontSize:13, lineHeight:1.5,
        boxShadow: isUser ? 'none' : 'var(--shadow-sm)',
        border: isUser ? 'none' : '1px solid var(--border)',
        whiteSpace:'pre-wrap',
      }}>
        {msg.content}
        {msg.data && msg.data.tool_used && (
          <div style={{ marginTop:6, fontSize:11, opacity:.7, fontStyle:'italic' }}>
            📊 Data from: {msg.data.tool_used.replace(/_/g,' ')}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SmartAssistant() {
  const [open,    setOpen]    = useState(false)
  const [input,   setInput]   = useState('')
  const [msgs,    setMsgs]    = useState([
    { role:'assistant', content:'👋 Hi! I\'m FINIX Assistant. Ask me anything about your finances.\n\nTry: "What is my profit this month?"' }
  ])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [msgs, loading])

  const send = async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')

    const history = msgs.slice(1).map(m => ({ role: m.role, content: m.content }))
    setMsgs(prev => [...prev, { role:'user', content: msg }])
    setLoading(true)

    try {
      const res = await assistantApi.chat(msg, history)
      const d = res.data?.data || res.data
      setMsgs(prev => [...prev, {
        role:'assistant',
        content: d.response || 'Sorry, I couldn\'t process that.',
        data: d,
      }])
    } catch {
      setMsgs(prev => [...prev, { role:'assistant', content:'I had trouble connecting. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position:'fixed', bottom:24, right:24, zIndex:1000,
            width:52, height:52, borderRadius:'50%', border:'none', cursor:'pointer',
            background:'linear-gradient(135deg,#2563EB,#7C3AED)',
            boxShadow:'0 4px 20px rgba(37,99,235,.4)',
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'transform .2s, box-shadow .2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform='scale(1.08)'; e.currentTarget.style.boxShadow='0 6px 24px rgba(37,99,235,.5)' }}
          onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 4px 20px rgba(37,99,235,.4)' }}
          title="Ask FINIX Assistant"
        >
          <MessageCircle size={22} color="#fff" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div style={{
          position:'fixed', bottom:24, right:24, zIndex:1000,
          width:360, height:520, borderRadius:16,
          background:'var(--surface)', border:'1px solid var(--border)',
          boxShadow:'0 20px 60px rgba(0,0,0,.15)',
          display:'flex', flexDirection:'column', overflow:'hidden',
          animation:'slideUp .25s ease',
        }}>
          {/* Header */}
          <div style={{
            padding:'12px 16px', background:'linear-gradient(135deg,#2563EB,#7C3AED)',
            display:'flex', alignItems:'center', justifyContent:'space-between',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Zap size={14} color="#fff" />
              </div>
              <div>
                <div style={{ color:'#fff', fontWeight:600, fontSize:13 }}>FINIX Assistant</div>
                <div style={{ color:'rgba(255,255,255,.7)', fontSize:11 }}>AI-powered accounting help</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,.8)', display:'flex', alignItems:'center' }}>
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex:1, overflowY:'auto', padding:'12px 12px 0', display:'flex', flexDirection:'column' }}>
            {msgs.map((m, i) => <Bubble key={i} msg={m} />)}
            {loading && (
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <div style={{ width:26, height:26, borderRadius:'50%', background:'linear-gradient(135deg,#2563EB,#7C3AED)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Zap size={12} color="#fff" />
                </div>
                <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'12px 12px 12px 2px', padding:'9px 12px', display:'flex', gap:4 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'var(--text-4)', animation:`bounce .8s ${i*0.15}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick questions */}
          {msgs.length <= 2 && (
            <div style={{ padding:'8px 12px', borderTop:'1px solid var(--border)' }}>
              <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:6, fontWeight:500 }}>QUICK QUESTIONS</div>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {QUICK.slice(0,3).map((q,i) => (
                  <button key={i} onClick={() => send(q)} style={{
                    display:'flex', alignItems:'center', gap:6, padding:'5px 8px',
                    background:'var(--surface-2)', border:'1px solid var(--border)',
                    borderRadius:6, cursor:'pointer', fontSize:12, color:'var(--text-2)',
                    textAlign:'left', transition:'background .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--primary-l)'}
                  onMouseLeave={e => e.currentTarget.style.background='var(--surface-2)'}
                  >
                    <ChevronRight size={10} color="var(--accent)" />
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div style={{ padding:'10px 12px', borderTop:'1px solid var(--border)', display:'flex', gap:8 }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about your finances..."
              rows={1}
              style={{
                flex:1, resize:'none', border:'1px solid var(--border)', borderRadius:8,
                padding:'8px 10px', fontSize:13, fontFamily:'var(--font)',
                background:'var(--surface-2)', color:'var(--text)', outline:'none',
                lineHeight:1.4,
              }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              style={{
                width:36, height:36, borderRadius:8, border:'none', cursor:'pointer',
                background: input.trim() ? 'var(--accent)' : 'var(--border)',
                display:'flex', alignItems:'center', justifyContent:'center',
                alignSelf:'flex-end', transition:'background .15s', flexShrink:0,
              }}
            >
              {loading ? <Loader size={14} color="#fff" /> : <Send size={14} color={input.trim() ? '#fff' : 'var(--text-4)'} />}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes bounce { 0%,80%,100% { transform:translateY(0); } 40% { transform:translateY(-4px); } }
      `}</style>
    </>
  )
}
