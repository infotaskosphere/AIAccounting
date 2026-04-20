// src/components/LaymanModeToggle.jsx
// Dual-mode system: Accountant Mode ↔ Simple Mode
import { createContext, useContext, useState } from 'react'
import { Eye, Code2 } from 'lucide-react'

const ModeCtx = createContext({ isSimple: false, toggle: () => {} })

export function ModeProvider({ children }) {
  const [isSimple, setIsSimple] = useState(
    () => localStorage.getItem('ui_mode') === 'simple'
  )
  const toggle = () => {
    setIsSimple(v => {
      const next = !v
      localStorage.setItem('ui_mode', next ? 'simple' : 'accountant')
      return next
    })
  }
  return <ModeCtx.Provider value={{ isSimple, toggle }}>{children}</ModeCtx.Provider>
}

export function useMode() { return useContext(ModeCtx) }

export function ModeToggle() {
  const { isSimple, toggle } = useMode()
  return (
    <button
      onClick={toggle}
      title={isSimple ? 'Switch to Accountant Mode' : 'Switch to Simple Mode'}
      style={{
        display:'flex', alignItems:'center', gap:6, padding:'4px 10px',
        border:'1px solid var(--border)', borderRadius:16,
        background: isSimple ? 'var(--primary-l)' : 'var(--surface)',
        color: isSimple ? 'var(--accent)' : 'var(--text-3)',
        cursor:'pointer', fontSize:12, fontWeight:500, transition:'all .15s',
        fontFamily:'var(--font)',
      }}
    >
      {isSimple ? <Eye size={12} /> : <Code2 size={12} />}
      {isSimple ? 'Simple Mode' : 'Expert Mode'}
    </button>
  )
}

// Renders children only in accountant/expert mode
export function AccountantOnly({ children }) {
  const { isSimple } = useMode()
  return isSimple ? null : <>{children}</>
}

// Renders children only in simple mode
export function SimpleOnly({ children }) {
  const { isSimple } = useMode()
  return isSimple ? <>{children}</> : null
}

// Shows different content per mode
export function ModeSwitch({ simple, accountant }) {
  const { isSimple } = useMode()
  return isSimple ? <>{simple}</> : <>{accountant}</>
}
