import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function Navbar({ title, showLogout = true }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <nav className="bg-navy-800 border-b border-navy-700 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-electric-500 rounded-lg flex items-center justify-center font-bold text-white text-sm">
          SA
        </div>
        <div>
          <span className="text-white font-bold text-lg tracking-tight">Shorthills AI</span>
          {title && <span className="text-gray-400 text-sm ml-2">— {title}</span>}
        </div>
      </div>
      {showLogout && (
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm text-gray-300 hover:text-white bg-navy-700 hover:bg-navy-600 rounded-lg transition-colors"
        >
          Logout
        </button>
      )}
    </nav>
  );
}
