import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import Navbar from '../components/Navbar';

// Compress image to base64 (no Firebase Storage needed)
function fileToCompressedBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 300;
        const ratio = Math.min(1, maxW / img.width);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AddEmployee() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ employeeId: '', name: '', email: '', password: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Photo must be under 5MB.'); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!photoFile) { setError('Please upload an employee photo.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      // 1. Compress photo to base64
      const photoBase64 = await fileToCompressedBase64(photoFile);

      // 2. Create Firebase Auth user
      const { user: newUser } = await createUserWithEmailAndPassword(auth, form.email, form.password);

      // 3. Update display name
      await updateProfile(newUser, { displayName: form.name });

      // 4. Save to Firestore with base64 photo (no Storage needed)
      await setDoc(doc(db, 'employees', newUser.uid), {
        employeeId: form.employeeId.trim(),
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        photoURL: photoBase64,
        createdAt: serverTimestamp(),
      });

      setSuccess(`Employee "${form.name}" added successfully!`);
      setForm({ employeeId: '', name: '', email: '', password: '' });
      setPhotoFile(null);
      setPhotoPreview(null);

      await auth.signOut();
      navigate('/admin/login');
    } catch (err) {
      const msgs = {
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
      };
      setError(msgs[err.code] || `Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-900">
      <Navbar user={auth.currentUser} role="admin" />

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6 animate-fade-in">
          <button onClick={() => navigate('/admin/dashboard')} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Add New Employee</h1>
            <p className="text-gray-400 text-sm">Create employee account and profile</p>
          </div>
        </div>

        <div className="card animate-fade-in">
          {success && (
            <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 mb-6">
              <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Photo upload */}
            <div>
              <label className="label">Profile Photo <span className="text-red-400">*</span></label>
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-navy-900 border-2 border-dashed border-navy-600 flex-shrink-0 flex items-center justify-center">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <label className="cursor-pointer">
                    <div className="btn-secondary inline-flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload Photo
                    </div>
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                  </label>
                  <p className="text-xs text-gray-500 mt-2">JPG, PNG up to 5MB</p>
                  {photoFile && <p className="text-xs text-electric-400 mt-1">{photoFile.name}</p>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Employee ID <span className="text-red-400">*</span></label>
                <input type="text" name="employeeId" value={form.employeeId} onChange={handleChange}
                  placeholder="e.g. EMP001" required className="input-field" />
              </div>
              <div>
                <label className="label">Full Name <span className="text-red-400">*</span></label>
                <input type="text" name="name" value={form.name} onChange={handleChange}
                  placeholder="John Doe" required className="input-field" />
              </div>
            </div>

            <div>
              <label className="label">Work Email <span className="text-red-400">*</span></label>
              <input type="email" name="email" value={form.email} onChange={handleChange}
                placeholder="john@shorthillsai.com" required className="input-field" />
            </div>

            <div>
              <label className="label">Password <span className="text-red-400">*</span></label>
              <input type="password" name="password" value={form.password} onChange={handleChange}
                placeholder="Minimum 6 characters" required minLength={6} className="input-field" />
              <p className="text-xs text-gray-500 mt-1">Share this password with the employee.</p>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3">
              <p className="text-yellow-400 text-xs">
                ⚠️ After adding an employee, you will be redirected to login again. This is normal — just log back in.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => navigate('/admin/dashboard')} className="btn-secondary flex-1">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating Account...
                  </>
                ) : 'Add Employee'}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-gray-700 text-xs mt-6">
          Made with ♥ by Pratham Jain &nbsp;|&nbsp; Shorthills AI © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
