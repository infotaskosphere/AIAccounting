// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Sidebar from './components/Sidebar'
import Navbar  from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Journal   from './pages/Journal'
import Bank      from './pages/Bank'
import GST       from './pages/GST'
import Payroll   from './pages/Payroll'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#0F172A',
            color: '#F8FAFC',
            fontSize: '0.85rem',
            borderRadius: '10px',
            padding: '11px 16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            fontFamily: "'Figtree', sans-serif",
          },
        }}
      />
      <div className="app-shell">
        <Sidebar />
        <div className="main-wrapper">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/"        element={<Dashboard />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/bank"    element={<Bank />} />
              <Route path="/gst"     element={<GST />} />
              <Route path="/payroll" element={<Payroll />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
