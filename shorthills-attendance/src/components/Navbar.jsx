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
    <nav className="bg-navy-800 border-b border-navy-700 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-electric-500 rounded-lg flex items-center justify-center font-bold text-white text-sm">
              S
            </div>
            <div>
              <span className="text-white font-bold text-lg leading-none">Attendance-US</span>
              <div className="text-electric-400 text-xs">Attendance System</div>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {user && (
              <>
                <div className="hidden sm:block text-right">
                  <div className="text-sm text-white font-medium truncate max-w-[180px]">
                    {user.displayName || user.email}
                  </div>
                  <div className="text-xs text-electric-400 capitalize">{role}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 bg-navy-700 hover:bg-red-600 text-gray-300 hover:text-white
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
