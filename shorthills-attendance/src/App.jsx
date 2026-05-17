import { useEffect, useState, Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { ThemeProvider } from './context/ThemeContext';

/* ── Global Error Boundary — catches any render crash, shows error UI instead of blank screen ── */
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err) { return { error: err }; }
  componentDidCatch(err, info) { console.error('App ErrorBoundary caught:', err, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', background: '#070d1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28, color: '#fff', fontWeight: 900 }}>G</div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Something went wrong</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 24 }}>{this.state.error?.message || 'An unexpected error occurred'}</div>
            <button onClick={() => window.location.reload()} style={{ padding: '10px 28px', borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Reload App</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
          Garvix Ops
        </div>
        <div className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>Daily Task Buddy</div>
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

  if (loading) return <ErrorBoundary><ThemeProvider><LoadingScreen /></ThemeProvider></ErrorBoundary>;

  return (
    <ErrorBoundary>
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
              {profileComplete
                ? <Navigate to="/attendance" replace />
                : <EmployeeSetup user={user} onComplete={() => setProfileComplete(true)} />
              }
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
    </ErrorBoundary>
  );
}
