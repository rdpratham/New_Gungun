import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';

export default function Navbar({ user, role }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate(role === 'admin' ? '/admin/login' : '/login');
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-white/5"
         style={{ background: 'rgba(7, 13, 26, 0.85)', backdropFilter: 'blur(20px)' }}>
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
                Garvix AI
              </span>
              <div className="text-gray-500 text-xs mt-0.5">Attendance System</div>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            {user && (
              <>
                <div className="hidden sm:block text-right">
                  <div className="text-sm text-white font-medium truncate max-w-[180px]">
                    {user.displayName || user.email}
                  </div>
                  <div className="text-xs text-violet-400 capitalize">{role}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 bg-white/5 hover:bg-red-500/20 border border-white/10
                             hover:border-red-500/40 text-gray-300 hover:text-red-300
                             px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
