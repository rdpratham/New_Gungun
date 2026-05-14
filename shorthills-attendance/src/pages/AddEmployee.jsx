import { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, storage } from '../firebase';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';

export default function AddEmployee() {
  const [form, setForm] = useState({ employeeId: '', name: '', email: '', password: '' });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Photo must be under 5MB.'); return; }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError('');
  };

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!photo) { setError('Please upload an employee photo.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;

    try {
      // Save admin credentials before creating employee (Firebase switches auth context)
      const savedAdminEmail = adminEmail;
      const savedAdminPwd = sessionStorage.getItem('_adm');

      // Create employee auth account
      const userCred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const uid = userCred.user.uid;

      // Upload photo to Firebase Storage
      const photoRef = ref(storage, `employees/${form.employeeId}/profile.jpg`);
      await uploadBytes(photoRef, photo);
      const photoURL = await getDownloadURL(photoRef);

      // Save employee data to Firestore
      await setDoc(doc(db, 'employees', uid), {
        employeeId: form.employeeId.trim(),
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        photoURL,
        createdAt: serverTimestamp(),
      });

      setSuccess(`Employee "${form.name}" added successfully! Redirecting...`);
      setForm({ employeeId: '', name: '', email: '', password: '' });
      setPhoto(null);
      setPhotoPreview('');

      // Re-sign in as admin so session is restored
      if (savedAdminEmail && savedAdminPwd) {
        await signInWithEmailAndPassword(auth, savedAdminEmail, savedAdminPwd);
      }

      setTimeout(() => navigate('/admin/dashboard'), 1500);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('This email is already registered.');
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-900">
      <Navbar title="Add Employee" />
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/dashboard')} className="text-gray-400 hover:text-white transition-colors text-sm">
            ← Back
          </button>
          <h1 className="text-white text-2xl font-bold">Add New Employee</h1>
        </div>

        <div className="bg-navy-800 border border-navy-700 rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Photo Upload */}
            <div className="flex items-center gap-5">
              <div className="w-24 h-24 rounded-2xl bg-navy-700 overflow-hidden flex-shrink-0 border border-navy-600">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm text-center p-2">No photo</div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Profile Photo *</label>
                <label className="cursor-pointer px-4 py-2 bg-navy-700 hover:bg-navy-600 text-white rounded-xl text-sm transition-colors inline-block border border-navy-600">
                  Choose Photo
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                </label>
                <p className="text-gray-500 text-xs mt-1">Max 5MB · JPG or PNG</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Employee ID *</label>
                <input
                  name="employeeId"
                  value={form.employeeId}
                  onChange={handleChange}
                  required
                  placeholder="EMP001"
                  className="w-full bg-navy-700 border border-navy-600 focus:border-electric-500 text-white placeholder-gray-500 rounded-xl px-4 py-3 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Full Name *</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="John Smith"
                  className="w-full bg-navy-700 border border-navy-600 focus:border-electric-500 text-white placeholder-gray-500 rounded-xl px-4 py-3 outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Work Email *</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="employee@shorthillsai.com"
                className="w-full bg-navy-700 border border-navy-600 focus:border-electric-500 text-white placeholder-gray-500 rounded-xl px-4 py-3 outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Login Password *</label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
                placeholder="Minimum 6 characters"
                className="w-full bg-navy-700 border border-navy-600 focus:border-electric-500 text-white placeholder-gray-500 rounded-xl px-4 py-3 outline-none transition-colors"
              />
            </div>

            {error && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
            )}
            {success && (
              <div className="px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">{success}</div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/admin/dashboard')}
                className="flex-1 py-3 bg-navy-700 hover:bg-navy-600 text-white font-medium rounded-xl transition-colors border border-navy-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-electric-500 hover:bg-electric-600 disabled:bg-navy-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Creating...</>
                ) : 'Add Employee'}
              </button>
            </div>
          </form>
        </div>
        <p className="text-center text-gray-600 text-xs pb-4">Made by Pratham Jain</p>
      </div>
    </div>
  );
}
