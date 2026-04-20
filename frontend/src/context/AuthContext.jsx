// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

// Compute current Indian FY dynamically
function currentFY() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1=Jan
  // Indian FY: April–March. If month >= 4, FY is year–(year+1), else (year-1)–year
  const fyStart = month >= 4 ? year : year - 1
  const fyEnd   = String(fyStart + 1).slice(-2)
  return `FY ${fyStart}-${fyEnd}`
}

const DEFAULT_COMPANIES = [
  {
    id: 'co-1',
    name: 'Acme Corp Pvt Ltd',
    type: 'Private Limited',
    gstin: '29AABCA1234C1ZX',
    fy: currentFY(),
    color: '#2563EB',
    initials: 'AC',
  },
  {
    id: 'co-2',
    name: 'Beta Traders',
    type: 'Partnership Firm',
    gstin: '27AACBT5678D1ZY',
    fy: currentFY(),
    color: '#7C3AED',
    initials: 'BT',
  },
]

const DEMO_USERS = [
  { email: 'admin@finix.in',  password: 'admin123', name: 'Admin User', role: 'admin' },
  { email: 'demo@finix.in',   password: 'demo123',  name: 'Demo User',  role: 'accountant' },
]

export function AuthProvider({ children }) {
  const [user,          setUser]      = useState(null)
  const [companies,     setCompanies] = useState([])
  const [activeCompany, setActive]    = useState(null)
  const [loading,       setLoading]   = useState(true)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('finix_session')
      if (saved) {
        const { user, companies, activeId } = JSON.parse(saved)
        // Patch legacy companies that have hardcoded FY
        const patched = (companies || []).map(c => ({
          ...c,
          fy: c.fy || currentFY(),
        }))
        setUser(user)
        setCompanies(patched)
        setActive(patched.find(c => c.id === activeId) || patched[0])
      }
    } catch (e) {
      // corrupted session — wipe it
      localStorage.removeItem('finix_session')
    }
    setLoading(false)
  }, [])

  const persist = (u, cos, activeId) => {
    localStorage.setItem('finix_session', JSON.stringify({ user: u, companies: cos, activeId }))
  }

  const login = (email, password) => {
    const found = DEMO_USERS.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    )
    if (!found) return { error: 'Invalid email or password' }
    const cos   = [...DEFAULT_COMPANIES]
    const first = cos[0]
    setUser(found); setCompanies(cos); setActive(first)
    persist(found, cos, first.id)
    return { success: true }
  }

  const logout = () => {
    setUser(null); setCompanies([]); setActive(null)
    localStorage.removeItem('finix_session')
  }

  const switchCompany = (company) => {
    setActive(company)
    const saved = JSON.parse(localStorage.getItem('finix_session') || '{}')
    localStorage.setItem('finix_session', JSON.stringify({ ...saved, activeId: company.id }))
  }

  const addCompany = (data) => {
    // data.fy comes from the Companies form (e.g. "2025-26")
    // Prefix "FY " if not already there
    const fyLabel = data.fy
      ? (data.fy.startsWith('FY ') ? data.fy : `FY ${data.fy}`)
      : currentFY()

    const newCo = {
      id:       `co-${Date.now()}`,
      name:     data.name,
      type:     data.type || 'Private Limited',
      gstin:    data.gstin || '',
      fy:       fyLabel,
      color:    data.color || '#059669',
      initials: data.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    }
    const updated = [...companies, newCo]
    setCompanies(updated)
    persist(user, updated, activeCompany?.id)
    return newCo
  }

  const updateCompany = (id, data) => {
    const fyLabel = data.fy
      ? (data.fy.startsWith('FY ') ? data.fy : `FY ${data.fy}`)
      : currentFY()
    const updated = companies.map(c =>
      c.id === id ? { ...c, ...data, fy: fyLabel } : c
    )
    setCompanies(updated)
    if (activeCompany?.id === id) {
      const next = updated.find(c => c.id === id)
      setActive(next)
    }
    persist(user, updated, activeCompany?.id)
  }

  const deleteCompany = (id) => {
    const updated = companies.filter(c => c.id !== id)
    setCompanies(updated)
    if (activeCompany?.id === id) {
      setActive(updated[0] || null)
      persist(user, updated, updated[0]?.id)
    } else {
      persist(user, updated, activeCompany?.id)
    }
  }

  return (
    <AuthContext.Provider value={{
      user, companies, activeCompany, loading,
      login, logout, switchCompany, addCompany, updateCompany, deleteCompany,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
