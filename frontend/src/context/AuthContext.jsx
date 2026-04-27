// src/context/AuthContext.jsx  — FIXED v3
// ─────────────────────────────────────────────────────────────────────────────
// THREE SEPARATE localStorage keys so data NEVER gets mixed or wiped:
//
//   finix_users      → all registered users (survives logout, login, refresh)
//   finix_companies  → all companies + their active selection (survives logout)
//   finix_session    → who is currently logged in (cleared on logout)
//
// BUG FIXES vs previous version:
//   ✅ login() no longer resets companies to DEFAULT mock data
//   ✅ company data persists across logout → login cycles
//   ✅ users persist across browser refresh
//   ✅ manthan.mda@gmail.com (or any email) just needs one Sign Up
//   ✅ company settings (GSTIN, name etc.) saved immediately, not lost
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

// ── Storage keys (separate so they never overwrite each other) ────────────
const KEY_USERS     = 'finix_users'       // [{id,email,password,name,role,status,createdAt}]
const KEY_COMPANIES = 'finix_companies'   // {list:[...], activeId:'co-xxx'}
const KEY_SESSION   = 'finix_session'     // {userId, email, name, role}

// ── Helpers ───────────────────────────────────────────────────────────────
function readJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback }
  catch (_) { return fallback }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch (_) {}
}

function currentFY() {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth() + 1
  const s = m >= 4 ? y : y - 1
  return `FY ${s}-${String(s + 1).slice(-2)}`
}

// ─────────────────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,          setUser]      = useState(null)
  const [companies,     setCompanies] = useState([])
  const [activeCompany, setActive]    = useState(null)
  const [allUsers,      setAllUsers]  = useState([])
  const [loading,       setLoading]   = useState(true)

  // ── Boot: restore session on page load / refresh ──────────────────────
  useEffect(() => {
    const session   = readJSON(KEY_SESSION, null)
    const users     = readJSON(KEY_USERS, [])
    const coStore   = readJSON(KEY_COMPANIES, { list: [], activeId: null })

    setAllUsers(users)

    if (session?.userId) {
      const found = users.find(u => u.id === session.userId && u.status === 'active')
      if (found) {
        const list    = coStore.list || []
        const active  = list.find(c => c.id === coStore.activeId) || list[0] || null
        setUser(found)
        setCompanies(list)
        setActive(active)
      } else {
        // session references a deleted/inactive user — clear it
        localStorage.removeItem(KEY_SESSION)
      }
    }
    setLoading(false)
  }, [])

  // ── Sign Up ───────────────────────────────────────────────────────────
  const signup = ({ name, email, password, role }) => {
    const users = readJSON(KEY_USERS, [])
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { error: 'An account with this email already exists' }
    }
    const newUser = {
      id:        `u-${Date.now()}`,
      email:     email.trim().toLowerCase(),
      password,
      name:      name.trim(),
      role:      role || 'accountant',
      status:    'active',
      createdAt: new Date().toISOString().slice(0, 10),
    }
    const updated = [...users, newUser]
    writeJSON(KEY_USERS, updated)
    setAllUsers(updated)
    return { success: true }
  }

  // ── Login ─────────────────────────────────────────────────────────────
  // FIXED: reads companies from finix_companies, NOT from DEFAULT_COMPANIES
  const login = (email, password) => {
    const users = readJSON(KEY_USERS, [])
    const found = users.find(
      u => u.email.toLowerCase() === email.toLowerCase() &&
           u.password === password &&
           u.status === 'active'
    )
    if (!found) return { error: 'Invalid email or password' }

    // Restore previously saved companies (NEVER reset to mock data)
    const coStore = readJSON(KEY_COMPANIES, { list: [], activeId: null })
    const list    = coStore.list || []
    const active  = list.find(c => c.id === coStore.activeId) || list[0] || null

    setUser(found)
    setAllUsers(users)
    setCompanies(list)
    setActive(active)

    // Save minimal session token
    writeJSON(KEY_SESSION, { userId: found.id, email: found.email, name: found.name, role: found.role })
    return { success: true }
  }

  // ── Logout ────────────────────────────────────────────────────────────
  // Companies and users are KEPT — only the session is cleared
  const logout = () => {
    localStorage.removeItem(KEY_SESSION)
    setUser(null)
    setCompanies([])
    setActive(null)
  }

  // ── Company helpers ───────────────────────────────────────────────────
  function saveCompanies(list, activeId) {
    writeJSON(KEY_COMPANIES, { list, activeId: activeId || list[0]?.id || null })
  }

  const switchCompany = (company) => {
    setActive(company)
    const coStore = readJSON(KEY_COMPANIES, { list: companies })
    writeJSON(KEY_COMPANIES, { ...coStore, activeId: company.id })
  }

  const addCompany = (data) => {
    const fyLabel = data.fy
      ? (data.fy.startsWith('FY ') ? data.fy : `FY ${data.fy}`)
      : currentFY()
    const newCo = {
      id:       `co-${Date.now()}`,
      name:     data.name,
      type:     data.type || 'Private Limited',
      gstin:    data.gstin || '',
      pan:      data.pan   || '',
      cin:      data.cin   || '',
      address:  data.address || '',
      city:     data.city  || '',
      state:    data.state || '',
      pincode:  data.pincode || '',
      phone:    data.phone || '',
      email:    data.email || '',
      fy:       fyLabel,
      color:    data.color || '#059669',
      initials: data.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    }
    const updated = [...companies, newCo]
    setCompanies(updated)
    if (!activeCompany) setActive(newCo)
    saveCompanies(updated, activeCompany?.id || newCo.id)
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
    const updatedActive = updated.find(c => c.id === id)
    if (activeCompany?.id === id) setActive(updatedActive)
    saveCompanies(updated, activeCompany?.id)
  }

  const deleteCompany = (id) => {
    const updated = companies.filter(c => c.id !== id)
    setCompanies(updated)
    const newActive = activeCompany?.id === id
      ? (updated[0] || null)
      : activeCompany
    setActive(newActive)
    saveCompanies(updated, newActive?.id)
  }

  // ── User management (admin only) ──────────────────────────────────────
  const addUser = (data) => {
    const newUser = {
      id:        `u-${Date.now()}`,
      email:     data.email,
      password:  data.password || 'Welcome@123',
      name:      data.name,
      role:      data.role || 'accountant',
      status:    'active',
      createdAt: new Date().toISOString().slice(0, 10),
    }
    const updated = [...allUsers, newUser]
    setAllUsers(updated)
    writeJSON(KEY_USERS, updated)
    return newUser
  }

  const updateUser = (id, data) => {
    const updated = allUsers.map(u => u.id === id ? { ...u, ...data } : u)
    setAllUsers(updated)
    writeJSON(KEY_USERS, updated)
    // If editing self, update session name/role
    if (user?.id === id) {
      const s = readJSON(KEY_SESSION, {})
      writeJSON(KEY_SESSION, { ...s, name: data.name || s.name, role: data.role || s.role })
    }
  }

  const deleteUser = (id) => {
    if (user?.id === id) return { error: 'Cannot delete yourself' }
    const updated = allUsers.filter(u => u.id !== id)
    setAllUsers(updated)
    writeJSON(KEY_USERS, updated)
  }

  const resetUserPassword = (id, newPassword) => {
    const updated = allUsers.map(u => u.id === id ? { ...u, password: newPassword } : u)
    setAllUsers(updated)
    writeJSON(KEY_USERS, updated)
  }

  return (
    <AuthContext.Provider value={{
      user, companies, activeCompany, loading, allUsers,
      login, logout, signup,
      switchCompany, addCompany, updateCompany, deleteCompany,
      addUser, updateUser, deleteUser, resetUserPassword,
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
