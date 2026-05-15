import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';

export default function EmployeeLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      const empSnap = await getDoc(doc(db, 'employees', user.uid));
      if (!empSnap.exists()) {
        await auth.signOut();
        setError('No employee account found. Contact your admin.');
        return;
      }
      navigate('/attendance');
    } catch (err) {
      const msgs = {
        'auth/wrong-password': 'Incorrect password.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/invalid-credential': 'Invalid email or password.',
        'auth/too-many-requests': 'Too many attempts. Try again later.',
      };
      setError(msgs[err.code] || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white text-3xl font-bold animate-glow"
               style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)' }}>
            G
          </div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #60a5fa)' }}>Garvix AI</h1>
          <p className="text-gray-500 mt-1">Employee Attendance Portal</p>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-6">Employee Sign In</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Work Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname@garvix.ai"
                required
                autoComplete="email"
                className="input-field"
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="input-field pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPass ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Signing in...
                </>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 rounded-xl px-4 py-3 border border-violet-500/20 bg-violet-500/10">
            <p className="text-violet-300 text-sm text-center font-medium">
              Shift: 5:00 PM – 2:00 AM IST
            </p>
            <div className="flex justify-center gap-4 mt-1.5 text-xs text-gray-500">
              <span>Sign In: 4:30 – 5:30 PM</span>
              <span>·</span>
              <span>Sign Out: 1:30 – 2:30 AM IST</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-navy-700 text-center">
            <Link to="/admin/login" className="text-electric-400 hover:text-electric-300 text-sm transition-colors">
              Admin login →
            </Link>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Made with ♥ by Pratham Jain &nbsp;|&nbsp; Garvix AI © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
