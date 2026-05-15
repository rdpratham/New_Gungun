import { useState, useRef, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { useTheme } from '../context/ThemeContext';

export default function Navbar({ user, role, avatarSrc, onViewProfile }) {
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    try { sessionStorage.clear(); } catch {}
    await signOut(auth);
    navigate(role === 'admin' ? '/admin/login' : '/login');
  };

  const handleViewProfile = () => {
    setDropdownOpen(false);
    onViewProfile?.();
  };

  return (
    <nav className="sticky top-0 z-40 border-b"
         style={{ borderColor: 'var(--border)', background: 'var(--surface)', backdropFilter: 'blur(20px)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-lg animate-glow"
                 style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)' }}>
              G
            </div>
            <div>
              <span className="font-bold text-lg leading-none bg-clip-text text-transparent"
                    style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #60a5fa)' }}>
                Garvix Ops
              </span>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Daily Task Buddy</div>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button onClick={toggle} title={isDark ? 'Light mode' : 'Dark mode'}
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105"
                    style={{ background: 'var(--surface-s)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              {isDark ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Avatar dropdown */}
            {user && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(v => !v)}
                  className="w-9 h-9 rounded-xl overflow-hidden border-2 transition-all duration-200 hover:scale-105 flex items-center justify-center font-bold text-sm"
                  style={{ borderColor: dropdownOpen ? '#7c3aed' : 'var(--border)', background: 'linear-gradient(135deg,#7c3aed22,#3b82f622)', color: '#a78bfa' }}
                >
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{(user.displayName || user.email || 'U').charAt(0).toUpperCase()}</span>
                  )}
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-11 w-52 rounded-xl shadow-xl border overflow-hidden z-50 animate-fade-in"
                       style={{ background: 'var(--surface-s)', borderColor: 'var(--border)' }}>
                    {/* User info */}
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-s)' }}>
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>
                        {user.displayName || user.email}
                      </p>
                      <p className="text-xs capitalize mt-0.5" style={{ color: 'var(--text-3)' }}>{role}</p>
                    </div>
                    {/* View Profile */}
                    <button
                      onClick={handleViewProfile}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
                      style={{ color: 'var(--text-2)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; }}
                    >
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      View Profile
                    </button>
                    {/* Logout */}
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left border-t"
                      style={{ color: '#f87171', borderColor: 'var(--border-s)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
