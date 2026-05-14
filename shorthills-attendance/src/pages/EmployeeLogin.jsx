import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function EmployeeLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/attendance');
    } catch (err) {
      if (err.code === 'auth/invalid-credential') setError('Invalid email or password.');
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-electric-500 rounded-2xl flex items-center justify-center font-bold text-white text-2xl mx-auto mb-4">SA</div>
          <h1 className="text-white text-3xl font-bold">Shorthills AI</h1>
          <p className="text-gray-400 mt-1">Employee Portal</p>
        </div>

        <div className="bg-navy-800 border border-navy-700 rounded-2xl p-8">
          <h2 className="text-white text-xl font-semibold mb-6">Employee Login</h2>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Work Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@shorthillsai.com"
                className="w-full bg-navy-700 border border-navy-600 focus:border-electric-500 text-white placeholder-gray-500 rounded-xl px-4 py-3 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-navy-700 border border-navy-600 focus:border-electric-500 text-white placeholder-gray-500 rounded-xl px-4 py-3 outline-none transition-colors"
              />
            </div>
            {error && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-electric-500 hover:bg-electric-600 disabled:bg-navy-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Logging in...</>
              ) : 'Login'}
            </button>
          </form>
          <p className="text-center text-gray-500 text-sm mt-6">
            Admin?{' '}
            <a href="/admin/login" className="text-electric-400 hover:text-electric-300 transition-colors">Go to Admin Login</a>
          </p>
        </div>
        <p className="text-center text-gray-600 text-xs mt-6">Made by Pratham Jain</p>
      </div>
    </div>
  );
}
