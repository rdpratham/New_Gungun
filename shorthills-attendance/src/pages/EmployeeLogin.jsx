import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';

/* ── Animated 3D background ──────────────────────────────────── */
function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {/* Base deep-space gradient */}
      <div className="absolute inset-0"
           style={{ background: 'radial-gradient(ellipse at 25% 25%, #0f0524 0%, #040d1a 40%, #000810 100%)' }} />

      {/* Orb 1 — violet, top-left */}
      <div className="absolute animate-orb1"
           style={{ width: '700px', height: '700px', borderRadius: '50%', top: '-250px', left: '-200px',
                    background: 'radial-gradient(circle, rgba(124,58,237,0.35) 0%, rgba(109,40,217,0.12) 40%, transparent 70%)',
                    filter: 'blur(40px)' }} />

      {/* Orb 2 — blue, bottom-right */}
      <div className="absolute animate-orb2"
           style={{ width: '650px', height: '650px', borderRadius: '50%', bottom: '-200px', right: '-150px',
                    background: 'radial-gradient(circle, rgba(59,130,246,0.32) 0%, rgba(37,99,235,0.1) 40%, transparent 70%)',
                    filter: 'blur(50px)' }} />

      {/* Orb 3 — cyan, center */}
      <div className="absolute animate-orb3"
           style={{ width: '400px', height: '400px', borderRadius: '50%', top: '40%', left: '55%', transform: 'translate(-50%,-50%)',
                    background: 'radial-gradient(circle, rgba(6,182,212,0.2) 0%, transparent 65%)',
                    filter: 'blur(35px)' }} />

      {/* Orb 4 — pink accent, top-right */}
      <div className="absolute animate-orb4"
           style={{ width: '300px', height: '300px', borderRadius: '50%', top: '10%', right: '15%',
                    background: 'radial-gradient(circle, rgba(168,85,247,0.22) 0%, transparent 65%)',
                    filter: 'blur(30px)' }} />

      {/* Rotating halo ring */}
      <div className="absolute animate-rotate-halo"
           style={{ width: '900px', height: '900px', borderRadius: '50%', top: '50%', left: '50%',
                    marginTop: '-450px', marginLeft: '-450px',
                    border: '1px solid rgba(124,58,237,0.08)',
                    boxShadow: 'inset 0 0 80px rgba(124,58,237,0.04)' }} />

      {/* Moving dot grid */}
      <div className="absolute inset-0"
           style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
                    backgroundSize: '36px 36px',
                    animation: 'gridMove 8s linear infinite' }} />

      {/* Noise / grain overlay for texture */}
      <div className="absolute inset-0 opacity-[0.03]"
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'repeat', backgroundSize: '128px 128px' }} />

      {/* Top shimmer strip */}
      <div className="absolute top-0 left-0 right-0 h-px animate-shimmer"
           style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.6), rgba(59,130,246,0.6), transparent)' }} />

      {/* Floating mini particles */}
      {[
        { top: '15%', left: '10%', size: '4px', color: '#a78bfa', delay: '0s' },
        { top: '70%', left: '8%',  size: '3px', color: '#60a5fa', delay: '1.5s' },
        { top: '30%', left: '90%', size: '5px', color: '#34d399', delay: '0.8s' },
        { top: '80%', left: '80%', size: '3px', color: '#a78bfa', delay: '2s' },
        { top: '55%', left: '25%', size: '4px', color: '#60a5fa', delay: '3s' },
        { top: '20%', left: '70%', size: '3px', color: '#f472b6', delay: '1s' },
      ].map((p, i) => (
        <div key={i}
             className="absolute rounded-full animate-pulse"
             style={{ top: p.top, left: p.left, width: p.size, height: p.size,
                      background: p.color, boxShadow: `0 0 8px ${p.color}`,
                      animationDelay: p.delay, animationDuration: '3s' }} />
      ))}
    </div>
  );
}

export default function EmployeeLogin() {
  const navigate = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
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
        'auth/wrong-password':      'Incorrect password.',
        'auth/user-not-found':      'No account found with this email.',
        'auth/invalid-credential':  'Invalid email or password.',
        'auth/too-many-requests':   'Too many attempts. Try again later.',
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
            {/* Glow ring around logo */}
            <div className="absolute inset-0 rounded-2xl animate-glow" />
            <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center text-white text-4xl font-black shadow-2xl"
                 style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 60%, #06b6d4 100%)',
                          boxShadow: '0 0 40px rgba(124,58,237,0.5), 0 0 80px rgba(59,130,246,0.2)' }}>
              G
            </div>
          </div>
          <h1 className="text-4xl font-black tracking-tight"
              style={{ background: 'linear-gradient(135deg, #c4b5fd, #93c5fd, #67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Garvix Ops
          </h1>
          <p className="mt-2 text-sm font-medium" style={{ color: 'rgba(148,163,184,0.8)' }}>
            Daily Task Buddy
          </p>
        </div>

        {/* Card with glassmorphism */}
        <div className="relative rounded-3xl overflow-hidden"
             style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(24px) saturate(1.5)',
                      border: '1px solid rgba(124,58,237,0.25)',
                      boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)' }}>

          {/* Card top gradient strip */}
          <div className="h-1 w-full"
               style={{ background: 'linear-gradient(90deg, #7c3aed, #3b82f6, #06b6d4)' }} />

          <div className="p-7">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                   style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)' }}>
                <svg className="w-4 h-4" fill="none" stroke="#a78bfa" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: '#fff' }}>Employee Sign In</h2>
                <p className="text-xs" style={{ color: 'rgba(148,163,184,0.7)' }}>Access your workspace</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label">Work Email</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" fill="none" stroke="rgba(148,163,184,0.6)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                         placeholder="yourname@garvix.ai" required autoComplete="email"
                         className="input-field pl-10"
                         style={{ background: 'rgba(15,23,42,0.8)', borderColor: 'rgba(124,58,237,0.2)' }} />
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
                         style={{ background: 'rgba(15,23,42,0.8)', borderColor: 'rgba(124,58,237,0.2)' }} />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                          style={{ color: 'rgba(148,163,184,0.6)' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#a78bfa'}
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
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
                               boxShadow: loading ? 'none' : '0 8px 30px rgba(124,58,237,0.4)' }}
                      onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 8px 40px rgba(124,58,237,0.6)'; }}
                      onMouseLeave={e => { if (!loading) e.currentTarget.style.boxShadow = '0 8px 30px rgba(124,58,237,0.4)'; }}>
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Signing in...</>
                  : <>Sign In <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
                }
              </button>
            </form>

            {/* Shift info */}
            <div className="mt-5 rounded-xl px-4 py-3"
                 style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
              <div className="flex items-center justify-center gap-2 mb-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="#a78bfa" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-semibold" style={{ color: '#a78bfa' }}>Shift: 5:00 PM – 2:00 AM IST</p>
              </div>
              <div className="flex justify-center gap-4 text-xs" style={{ color: 'rgba(100,116,139,0.9)' }}>
                <span>Sign In: 4:30 – 5:30 PM</span>
                <span>·</span>
                <span>Sign Out: 1:30 – 2:30 AM</span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t text-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <Link to="/admin/login"
                    className="text-sm transition-colors"
                    style={{ color: 'rgba(148,163,184,0.6)' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#a78bfa'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(148,163,184,0.6)'}>
                Admin login →
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
