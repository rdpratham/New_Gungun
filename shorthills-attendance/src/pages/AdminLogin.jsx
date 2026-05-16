import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '../firebase';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

/* ── Animated 3D background ──────────────────────────────────── */
function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      <div className="absolute inset-0"
           style={{ background: 'radial-gradient(ellipse at 70% 30%, #0a0520 0%, #040d1a 40%, #000a10 100%)' }} />

      {/* Orb 1 — violet */}
      <div className="absolute animate-orb2"
           style={{ width: '750px', height: '750px', borderRadius: '50%', top: '-300px', right: '-200px',
                    background: 'radial-gradient(circle, rgba(124,58,237,0.32) 0%, rgba(109,40,217,0.1) 40%, transparent 70%)',
                    filter: 'blur(45px)' }} />
      {/* Orb 2 — blue */}
      <div className="absolute animate-orb1"
           style={{ width: '600px', height: '600px', borderRadius: '50%', bottom: '-200px', left: '-150px',
                    background: 'radial-gradient(circle, rgba(59,130,246,0.28) 0%, rgba(37,99,235,0.08) 40%, transparent 70%)',
                    filter: 'blur(50px)' }} />
      {/* Orb 3 — teal center */}
      <div className="absolute animate-orb3"
           style={{ width: '350px', height: '350px', borderRadius: '50%', top: '45%', left: '30%',
                    background: 'radial-gradient(circle, rgba(6,182,212,0.18) 0%, transparent 65%)',
                    filter: 'blur(35px)' }} />
      {/* Orb 4 — emerald accent */}
      <div className="absolute animate-orb4"
           style={{ width: '280px', height: '280px', borderRadius: '50%', bottom: '20%', right: '20%',
                    background: 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 65%)',
                    filter: 'blur(30px)' }} />

      {/* Rotating rings */}
      <div className="absolute animate-rotate-halo"
           style={{ width: '800px', height: '800px', borderRadius: '50%', top: '50%', left: '50%',
                    marginTop: '-400px', marginLeft: '-400px',
                    border: '1px solid rgba(124,58,237,0.07)' }} />
      <div style={{ position: 'absolute', width: '1100px', height: '1100px', borderRadius: '50%',
                    top: '50%', left: '50%', marginTop: '-550px', marginLeft: '-550px',
                    border: '1px solid rgba(59,130,246,0.05)',
                    animation: 'rotateHalo 30s linear infinite reverse' }} />

      {/* Dot grid */}
      <div className="absolute inset-0"
           style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                    animation: 'gridMove 10s linear infinite' }} />

      {/* Top shimmer */}
      <div className="absolute top-0 left-0 right-0 h-px animate-shimmer"
           style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.7), rgba(124,58,237,0.7), transparent)' }} />

      {/* Particles */}
      {[
        { top: '12%', left: '15%',  size: '4px', color: '#7c3aed', delay: '0s' },
        { top: '75%', left: '12%',  size: '3px', color: '#3b82f6', delay: '2s' },
        { top: '25%', left: '85%',  size: '5px', color: '#06b6d4', delay: '0.5s' },
        { top: '85%', left: '75%',  size: '3px', color: '#7c3aed', delay: '1.5s' },
        { top: '50%', left: '5%',   size: '4px', color: '#3b82f6', delay: '3s' },
        { top: '18%', left: '60%',  size: '3px', color: '#10b981', delay: '1s' },
        { top: '60%', left: '90%',  size: '4px', color: '#a78bfa', delay: '2.5s' },
      ].map((p, i) => (
        <div key={i} className="absolute rounded-full animate-pulse"
             style={{ top: p.top, left: p.left, width: p.size, height: p.size,
                      background: p.color, boxShadow: `0 0 8px ${p.color}`,
                      animationDelay: p.delay, animationDuration: '3.5s' }} />
      ))}
    </div>
  );
}

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (email.toLowerCase() !== ADMIN_EMAIL?.toLowerCase()) {
      setError('This portal is for admin only. Use the employee login instead.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin/dashboard');
    } catch (err) {
      const msgs = {
        'auth/wrong-password':     'Incorrect password.',
        'auth/user-not-found':     'Admin account not found.',
        'auth/invalid-credential': 'Invalid email or password.',
        'auth/too-many-requests':  'Too many failed attempts. Try again later.',
      };
      setError(msgs[err.code] || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <AnimatedBackground />

      <div className="w-full max-w-md animate-fade-in relative" style={{ zIndex: 1 }}>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-5">
            <div className="absolute inset-0 rounded-2xl animate-glow" />
            <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center text-white text-4xl font-black shadow-2xl"
                 style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #7c3aed 60%, #0891b2 100%)',
                          boxShadow: '0 0 40px rgba(29,78,216,0.5), 0 0 80px rgba(124,58,237,0.2)' }}>
              A
            </div>
          </div>
          <h1 className="text-4xl font-black tracking-tight"
              style={{ background: 'linear-gradient(135deg, #93c5fd, #c4b5fd, #67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Garvix Ops
          </h1>
          <p className="mt-2 text-sm font-medium" style={{ color: 'rgba(148,163,184,0.8)' }}>
            Admin Control Panel
          </p>
        </div>

        {/* Glassmorphism card */}
        <div className="relative rounded-3xl overflow-hidden"
             style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(24px) saturate(1.5)',
                      border: '1px solid rgba(59,130,246,0.25)',
                      boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)' }}>

          <div className="h-1 w-full"
               style={{ background: 'linear-gradient(90deg, #1d4ed8, #7c3aed, #06b6d4)' }} />

          <div className="p-7">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                   style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.3)' }}>
                <svg className="w-4 h-4" fill="none" stroke="#60a5fa" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: '#fff' }}>Admin Sign In</h2>
                <p className="text-xs" style={{ color: 'rgba(148,163,184,0.7)' }}>Secure admin access only</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label">Admin Email</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" fill="none" stroke="rgba(148,163,184,0.6)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                         placeholder="admin@garvix.ai" required autoComplete="email"
                         className="input-field pl-10"
                         style={{ background: 'rgba(15,23,42,0.8)', borderColor: 'rgba(59,130,246,0.2)' }} />
                </div>
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" fill="none" stroke="rgba(148,163,184,0.6)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                         placeholder="••••••••" required autoComplete="current-password"
                         className="input-field pl-10 pr-12"
                         style={{ background: 'rgba(15,23,42,0.8)', borderColor: 'rgba(59,130,246,0.2)' }} />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                          style={{ color: 'rgba(148,163,184,0.6)' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#60a5fa'}
                          onMouseLeave={e => e.currentTarget.style.color = 'rgba(148,163,184,0.6)'}>
                    {showPass
                      ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    }
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl px-4 py-3"
                     style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading}
                      className="w-full py-3 rounded-xl font-bold text-white transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)',
                               boxShadow: loading ? 'none' : '0 8px 30px rgba(29,78,216,0.4)' }}
                      onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 8px 40px rgba(29,78,216,0.6)'; }}
                      onMouseLeave={e => { if (!loading) e.currentTarget.style.boxShadow = '0 8px 30px rgba(29,78,216,0.4)'; }}>
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Signing in...</>
                  : <>Sign In as Admin <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
                }
              </button>
            </form>

            <div className="mt-5 pt-4 border-t text-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <Link to="/login"
                    className="text-sm transition-colors"
                    style={{ color: 'rgba(148,163,184,0.6)' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#60a5fa'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(148,163,184,0.6)'}>
                Employee login →
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'rgba(100,116,139,0.6)' }}>
          Made with ♥ by Pratham Jain &nbsp;|&nbsp; Garvix Ops © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
