import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { ThemeProvider } from './context/ThemeContext';

import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AddEmployee from './pages/AddEmployee';
import EmployeeLogin from './pages/EmployeeLogin';
import EmployeeAttendance from './pages/EmployeeAttendance';
import EmployeeSetup from './pages/EmployeeSetup';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 text-white text-2xl font-bold animate-glow"
             style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)' }}>
          G
        </div>
        <div className="text-2xl font-bold bg-clip-text text-transparent mb-1"
             style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #60a5fa)' }}>
          Garvix AI
        </div>
        <div className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>Attendance System</div>
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  );
}

// Hard reset — wipes localStorage + signs out + redirects to login
function LogoutRoute() {
  useEffect(() => {
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
    signOut(auth).catch(() => {}).finally(() => {
      window.location.replace('/login');
    });
  }, []);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#070d1a', color: '#fff', fontSize: 14 }}>
      Signing out…
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
  const [profileComplete, setProfileComplete] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Admin is identified purely by email — never treat admin as employee
        if (firebaseUser.email === ADMIN_EMAIL) {
          setUser(firebaseUser);
          setRole('admin');
          setProfileComplete(true);
          setLoading(false);
          return;
        }

        try {
          const empSnap = await getDoc(doc(db, 'employees', firebaseUser.uid));
          if (empSnap.exists()) {
            setUser(firebaseUser);
            setRole('employee');
            setProfileComplete(empSnap.data().profileComplete !== false);
          } else {
            // Unknown user — sign them out immediately so they can't linger
            await signOut(auth);
            setUser(null);
            setRole(null);
            setProfileComplete(true);
          }
        } catch {
          setUser(firebaseUser);
          setRole(null);
          setProfileComplete(true);
        }
      } else {
        setUser(null);
        setRole(null);
        setProfileComplete(true);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return <ThemeProvider><LoadingScreen /></ThemeProvider>;

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* Emergency logout — clears any stuck session */}
          <Route path="/logout" element={<LogoutRoute />} />

          <Route
            path="/"
            element={
              user
                ? role === 'admin'
                  ? <Navigate to="/admin/dashboard" replace />
                  : role === 'employee'
                  ? profileComplete
                    ? <Navigate to="/attendance" replace />
                    : <Navigate to="/setup" replace />
                  : <Navigate to="/login" replace />
                : <Navigate to="/login" replace />
            }
          />

          <Route path="/admin/login" element={
            user && role === 'admin' ? <Navigate to="/admin/dashboard" replace /> : <AdminLogin />
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

          <Route path="/login" element={
            user && role === 'employee'
              ? profileComplete
                ? <Navigate to="/attendance" replace />
                : <Navigate to="/setup" replace />
              : <EmployeeLogin />
          } />
          <Route path="/setup" element={
            <ProtectedRoute user={user} role={role} requiredRole="employee">
              <EmployeeSetup user={user} onComplete={() => setProfileComplete(true)} />
            </ProtectedRoute>
          } />
          <Route path="/attendance" element={
            <ProtectedRoute user={user} role={role} requiredRole="employee">
              {profileComplete
                ? <EmployeeAttendance user={user} />
                : <Navigate to="/setup" replace />
              }
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}
