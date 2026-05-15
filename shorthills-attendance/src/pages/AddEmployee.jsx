import { useState } from 'react';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { auth, secondaryAuth, db } from '../firebase';
import Navbar from '../components/Navbar';

export default function AddEmployee() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ employeeCode: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    let newUser = null;
    try {
      // Use secondary auth so admin session is not replaced by new employee session
      const credential = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password);
      newUser = credential.user;

      await setDoc(doc(db, 'employees', newUser.uid), {
        employeeId: form.employeeCode.trim(),
        email: form.email.trim().toLowerCase(),
        profileComplete: false,
        createdAt: serverTimestamp(),
      });

      await secondaryAuth.signOut();
      setSuccess(`Employee account created! Code: ${form.employeeCode} — They must complete profile setup on first login.`);
      setForm({ employeeCode: '', email: '', password: '' });
    } catch (err) {
      if (newUser && err.code !== 'auth/email-already-in-use') {
        try { await deleteUser(newUser); } catch {}
      }
      await secondaryAuth.signOut();
      const msgs = {
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'permission-denied': 'Firestore permission denied. Check your Firestore security rules.',
      };
      setError(msgs[err.code] || `Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Navbar user={auth.currentUser} role="admin" />

      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6 animate-fade-in">
          <button onClick={() => navigate('/admin/dashboard')}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ background: 'var(--surface-s)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Add New Employee</h1>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              Employee will complete their profile (face, details) on first login
            </p>
          </div>
        </div>

        <div className="card animate-fade-in">
          {success && (
            <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 mb-6">
              <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-emerald-400 text-sm">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Employee Code <span className="text-red-400">*</span></label>
              <input
                type="text"
                name="employeeCode"
                value={form.employeeCode}
                onChange={handleChange}
                placeholder="e.g. EMP001"
                required
                className="input-field"
              />
            </div>

            <div>
              <label className="label">Work Email <span className="text-red-400">*</span></label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="employee@company.com"
                required
                className="input-field"
              />
            </div>

            <div>
              <label className="label">Password <span className="text-red-400">*</span></label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Minimum 6 characters"
                required
                minLength={6}
                className="input-field"
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                Share this temporary password with the employee.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3">
              <p className="text-violet-400 text-xs flex items-start gap-2">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                On first login the employee will set up their joining date, mobile, and capture their face photo for attendance verification.
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => navigate('/admin/dashboard')} className="btn-secondary flex-1">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating...
                  </>
                ) : 'Add Employee'}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-3)' }}>
          Made with ♥ by Pratham Jain &nbsp;|&nbsp; Garvix AI © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
