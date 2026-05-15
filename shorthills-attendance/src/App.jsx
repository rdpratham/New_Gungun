import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AddEmployee from './pages/AddEmployee';
import EmployeeLogin from './pages/EmployeeLogin';
import EmployeeAttendance from './pages/EmployeeAttendance';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center">
      <div className="text-center animate-fade-in">
        <div className="text-4xl font-bold text-electric-500 mb-2">Shorthills AI</div>
        <div className="text-gray-400 mb-6">Attendance System</div>
        <div className="w-8 h-8 border-4 border-electric-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  );
}

function ProtectedRoute({ user, role, requiredRole, children }) {
  if (!user) return <Navigate to={requiredRole === 'admin' ? '/admin/login' : '/login'} replace />;
  if (role && role !== requiredRole) {
    return <Navigate to={role === 'admin' ? '/admin/dashboard' : '/attendance'} replace />;
  }
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        if (firebaseUser.email === ADMIN_EMAIL) {
          setRole('admin');
        } else {
          try {
            const empSnap = await getDoc(doc(db, 'employees', firebaseUser.uid));
            setRole(empSnap.exists() ? 'employee' : null);
          } catch {
            setRole(null);
          }
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <Router>
      <Routes>
        {/* Root redirect */}
        <Route
          path="/"
          element={
            user
              ? <Navigate to={role === 'admin' ? '/admin/dashboard' : '/attendance'} replace />
              : <Navigate to="/login" replace />
          }
        />

        {/* Admin routes */}
        <Route path="/admin/login" element={
          user && role === 'admin'
            ? <Navigate to="/admin/dashboard" replace />
            : <AdminLogin />
        } />
        <Route path="/admin/dashboard" element={
          <ProtectedRoute user={user} role={role} requiredRole="admin">
            <AdminDashboard user={user} />
          </ProtectedRoute>
        } />
        <Route path="/admin/add-employee" element={
          <ProtectedRoute user={user} role={role} requiredRole="admin">
            <AddEmployee />
          </ProtectedRoute>
        } />

        {/* Employee routes */}
        <Route path="/login" element={
          user && role === 'employee'
            ? <Navigate to="/attendance" replace />
            : <EmployeeLogin />
        } />
        <Route path="/attendance" element={
          <ProtectedRoute user={user} role={role} requiredRole="employee">
            <EmployeeAttendance user={user} />
          </ProtectedRoute>
        } />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
