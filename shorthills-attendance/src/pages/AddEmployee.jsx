import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile, deleteUser } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import Navbar from '../components/Navbar';
import WebcamCapture from '../components/WebcamCapture';
import { getDescriptorFromDataURL } from '../utils/faceRecognition';

export default function AddEmployee() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ employeeId: '', name: '', email: '', password: '' });
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleCapture = (photoData) => {
    setCapturedPhoto(photoData);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!capturedPhoto?.dataURL) { setError('Please capture the employee\'s face photo using the camera.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    let newUser = null;
    try {
      // 1. Extract face descriptor for recognition
      const faceDescriptor = await getDescriptorFromDataURL(capturedPhoto.dataURL);
      if (!faceDescriptor) {
        setError('No face detected in the photo. Please retake with the employee\'s face clearly visible.');
        setLoading(false);
        return;
      }

      // 2. Compress photo to smaller base64
      const compressedPhoto = await compressDataURL(capturedPhoto.dataURL);

      // 3. Create Firebase Auth user
      const credential = await createUserWithEmailAndPassword(auth, form.email, form.password);
      newUser = credential.user;

      // 4. Update display name
      await updateProfile(newUser, { displayName: form.name });

      // 5. Save to Firestore with photo + face descriptor
      await setDoc(doc(db, 'employees', newUser.uid), {
        employeeId: form.employeeId.trim(),
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        photoURL: compressedPhoto,
        faceDescriptor,
        createdAt: serverTimestamp(),
      });

      setSuccess(`Employee "${form.name}" added with face recognition enabled!`);
      setForm({ employeeId: '', name: '', email: '', password: '' });
      setCapturedPhoto(null);

      await auth.signOut();
      navigate('/admin/login');
    } catch (err) {
      // If auth user was created but Firestore write failed, delete the orphaned auth user
      // so admin can retry without "email already exists" error
      if (newUser && err.code !== 'auth/email-already-in-use') {
        try { await deleteUser(newUser); } catch {}
      }
      const msgs = {
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'permission-denied': 'Firestore permission denied. Please update your Firestore security rules.',
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
            <p className="text-gray-400 text-sm">Capture face photo using live camera for attendance recognition</p>
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

            {/* Live camera capture */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-electric-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-electric-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-sm text-electric-400 font-medium">
                  Live Camera — Face is saved for attendance verification
                </p>
              </div>
              <div className="bg-navy-700/30 border border-navy-600 rounded-xl p-4">
                <WebcamCapture onCapture={handleCapture} onError={(msg) => setError(msg)} />
              </div>
              {capturedPhoto && (
                <div className="flex items-center gap-2 mt-2 text-green-400 text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Face photo captured — will be used for attendance verification
                </div>
              )}
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
                placeholder="john@company.com" required className="input-field" />
            </div>

            <div>
              <label className="label">Password <span className="text-red-400">*</span></label>
              <input type="password" name="password" value={form.password} onChange={handleChange}
                placeholder="Minimum 6 characters" required minLength={6} className="input-field" />
              <p className="text-xs text-gray-500 mt-1">Share this password with the employee.</p>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="bg-electric-500/10 border border-electric-500/20 rounded-lg px-4 py-3">
              <p className="text-electric-400 text-xs flex items-start gap-2">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                The captured face will be saved and used to verify the employee's identity when they submit attendance. Attendance will be denied if faces don't match.
              </p>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3">
              <p className="text-yellow-400 text-xs">
                ⚠️ After adding an employee, you will be redirected to login again. This is normal — just log back in.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => navigate('/admin/dashboard')} className="btn-secondary flex-1">
                Cancel
              </button>
              <button type="submit" disabled={loading || !capturedPhoto} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {loading ? 'Processing Face...' : 'Creating Account...'}
                  </>
                ) : 'Add Employee'}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-gray-700 text-xs mt-6">
          Made with ♥ by Pratham Jain &nbsp;|&nbsp; Garvix AI © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

function compressDataURL(dataURL) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxW = 400;
      const ratio = Math.min(1, maxW / img.width);
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.5));
    };
    img.src = dataURL;
  });
}
