import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import AddEmployee from './pages/AddEmployee'
import EmployeeLogin from './pages/EmployeeLogin'
import EmployeeAttendance from './pages/EmployeeAttendance'

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL

function ProtectedRoute({ children, requiredRole }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'authorized' | 'unauthorized'
  const [role, setRole] = useState(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatus('unauthorized')
        return
      }
      if (user.email === ADMIN_EMAIL) {
        setRole('admin')
        setStatus('authorized')
      } else {
        const snap = await getDoc(doc(db, 'employees', user.uid))
        if (snap.exists()) {
          setRole('employee')
          setStatus('authorized')
        } else {
          setStatus('unauthorized')
        }
      }
    })
    return unsub
  }, [])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-electric-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (status === 'unauthorized') {
    return <Navigate to={requiredRole === 'admin' ? '/admin/login' : '/login'} replace />
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to={role === 'admin' ? '/admin/dashboard' : '/attendance'} replace />
  }

  return children
}

function RootRedirect() {
  const [dest, setDest] = useState(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setDest('/login'); return }
      if (user.email === ADMIN_EMAIL) { setDest('/admin/dashboard'); return }
      const snap = await getDoc(doc(db, 'employees', user.uid))
      setDest(snap.exists() ? '/attendance' : '/login')
    })
    return unsub
  }, [])

  if (!dest) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-electric-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  return <Navigate to={dest} replace />
}

export default function App() {
  return (
    <BrowserRouter basename="/new_gungun">
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/login" element={<EmployeeLogin />} />

        <Route path="/admin/dashboard" element={
          <ProtectedRoute requiredRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/add-employee" element={
          <ProtectedRoute requiredRole="admin">
            <AddEmployee />
          </ProtectedRoute>
        } />
        <Route path="/attendance" element={
          <ProtectedRoute requiredRole="employee">
            <EmployeeAttendance />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
