import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AddEmployee from './pages/AddEmployee';
import EmployeeLogin from './pages/EmployeeLogin';
import EmployeeAttendance from './pages/EmployeeAttendance';

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
        if (firebaseUser.email === adminEmail) {
          setRole('admin');
        } else {
          const empDoc = await getDoc(doc(db, 'employees', firebaseUser.uid));
          setRole(empDoc.exists() ? 'employee' : null);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-electric-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg font-semibold">Shorthills AI</p>
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router basename="/new_gungun/shorthills-attendance">
      <Routes>
        <Route path="/" element={
          user && role === 'admin' ? <Navigate to="/admin/dashboard" replace /> :
          user && role === 'employee' ? <Navigate to="/attendance" replace /> :
          <Navigate to="/login" replace />
        } />
        <Route path="/admin/login" element={
          user && role === 'admin' ? <Navigate to="/admin/dashboard" replace /> : <AdminLogin />
        } />
        <Route path="/admin/dashboard" element={
          user && role === 'admin' ? <AdminDashboard user={user} /> : <Navigate to="/admin/login" replace />
        } />
        <Route path="/admin/add-employee" element={
          user && role === 'admin' ? <AddEmployee user={user} /> : <Navigate to="/admin/login" replace />
        } />
        <Route path="/login" element={
          user && role === 'employee' ? <Navigate to="/attendance" replace /> :
          user && role === 'admin' ? <Navigate to="/admin/dashboard" replace /> :
          <EmployeeLogin />
        } />
        <Route path="/attendance" element={
          user && role === 'employee' ? <EmployeeAttendance user={user} /> : <Navigate to="/login" replace />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
