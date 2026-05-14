import { useNavigate } from 'react-router-dom'

export default function Navbar({ isAdmin = false, onLogout }) {
  const navigate = useNavigate()

  return (
    <nav className="bg-navy-800 border-b border-navy-700 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => navigate(isAdmin ? '/admin/dashboard' : '/attendance')}
          className="flex items-center gap-3 group"
        >
          <div className="w-9 h-9 bg-electric-500 rounded-xl flex items-center justify-center shadow-lg shadow-electric-500/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="leading-none">
            <div className="text-white font-bold text-base group-hover:text-electric-400 transition-colors">
              Shorthills AI
            </div>
            <div className="text-slate-500 text-xs">Attendance System</div>
          </div>
        </button>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {isAdmin && (
            <span className="hidden sm:inline-flex items-center gap-1.5 bg-electric-500/10 text-electric-400 text-xs font-medium px-3 py-1.5 rounded-full border border-electric-500/20">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Admin
            </span>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors px-3 py-2 rounded-lg hover:bg-navy-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Sign out</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
