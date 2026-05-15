import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import WebcamCapture from '../components/WebcamCapture';
import { getDescriptorFromDataURL } from '../utils/faceRecognition';

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

export default function EmployeeSetup({ user, onComplete }) {
  const [employeeData, setEmployeeData] = useState(null);
  const [form, setForm] = useState({
    joiningDate: '',
    mobile: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1=info, 2=face

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'employees', user.uid));
        if (snap.exists()) setEmployeeData({ id: snap.id, ...snap.data() });
      } catch {}
      setLoadingData(false);
    })();
  }, [user.uid]);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    setError('');
    if (!form.joiningDate) { setError('Please enter your joining date.'); return; }
    if (!form.mobile || form.mobile.length < 10) { setError('Please enter a valid mobile number.'); return; }
    if (form.newPassword) {
      if (!form.currentPassword) { setError('Enter your current password to change it.'); return; }
      if (form.newPassword.length < 6) { setError('New password must be at least 6 characters.'); return; }
      if (form.newPassword !== form.confirmPassword) { setError('New passwords do not match.'); return; }
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    setError('');
    if (!capturedPhoto?.dataURL) { setError('Please capture your face photo.'); return; }

    setLoading(true);
    try {
      const faceDescriptor = await getDescriptorFromDataURL(capturedPhoto.dataURL);
      if (!faceDescriptor) {
        setError('No face detected. Please position your face clearly in the camera and try again.');
        setLoading(false);
        return;
      }

      const compressedPhoto = await compressDataURL(capturedPhoto.dataURL);

      // Optional password change
      if (form.newPassword && form.currentPassword) {
        const credential = EmailAuthProvider.credential(user.email, form.currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, form.newPassword);
      }

      await updateDoc(doc(db, 'employees', user.uid), {
        joiningDate: form.joiningDate,
        mobile: form.mobile.trim(),
        photoURL: compressedPhoto,
        faceDescriptor,
        profileComplete: true,
      });

      onComplete();
    } catch (err) {
      const msgs = {
        'auth/wrong-password': 'Current password is incorrect.',
        'auth/invalid-credential': 'Current password is incorrect.',
        'auth/weak-password': 'New password must be at least 6 characters.',
        'auth/requires-recent-login': 'Please log out and log back in before changing your password.',
      };
      setError(msgs[err.code] || `Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-8 animate-fade-in relative">
          <button
            onClick={() => signOut(auth)}
            className="absolute right-0 top-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all duration-200"
            style={{ background: 'var(--surface-s)', border: '1px solid var(--border)', color: 'var(--text-3)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fca5a5'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white text-xl font-bold"
               style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)' }}>
            G
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Complete Your Profile</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
            Fill in a few details to activate your account
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                step >= s
                  ? 'text-white shadow-lg'
                  : 'border'
              }`}
              style={step >= s
                ? { background: 'linear-gradient(135deg, #7c3aed, #3b82f6)' }
                : { borderColor: 'var(--border)', color: 'var(--text-3)', background: 'var(--surface-s)' }
              }>
                {step > s ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : s}
              </div>
              {s < 2 && <div className="w-12 h-0.5" style={{ background: step > s ? 'linear-gradient(90deg,#7c3aed,#3b82f6)' : 'var(--border)' }}></div>}
            </div>
          ))}
        </div>

        <div className="card animate-fade-in">
          {/* Step 1 — Personal info */}
          {step === 1 && (
            <form onSubmit={handleNextStep} className="space-y-5">
              <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text)' }}>Personal Information</h2>

              {/* Read-only fields */}
              <div>
                <label className="label">Team</label>
                <div className="input-field opacity-60 cursor-not-allowed select-none">Sales Team</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Employee ID</label>
                  <div className="input-field opacity-60 cursor-not-allowed select-none">
                    {employeeData?.employeeId || '—'}
                  </div>
                </div>
                <div>
                  <label className="label">Email</label>
                  <div className="input-field opacity-60 cursor-not-allowed select-none text-sm truncate">
                    {user.email}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Joining Date <span className="text-red-400">*</span></label>
                  <input
                    type="date"
                    name="joiningDate"
                    value={form.joiningDate}
                    onChange={handleChange}
                    required
                    className="input-field"
                    style={{ colorScheme: 'auto' }}
                  />
                </div>
                <div>
                  <label className="label">Mobile Number <span className="text-red-400">*</span></label>
                  <input
                    type="tel"
                    name="mobile"
                    value={form.mobile}
                    onChange={handleChange}
                    placeholder="+91 98765 43210"
                    required
                    maxLength={15}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Optional password change */}
              <div className="pt-2 border-t" style={{ borderColor: 'var(--border-s)' }}>
                <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-2)' }}>
                  Change Password (optional)
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="label">Current Password</label>
                    <input
                      type="password"
                      name="currentPassword"
                      value={form.currentPassword}
                      onChange={handleChange}
                      placeholder="Enter current password"
                      className="input-field"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">New Password</label>
                      <input
                        type="password"
                        name="newPassword"
                        value={form.newPassword}
                        onChange={handleChange}
                        placeholder="Min 6 characters"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Confirm Password</label>
                      <input
                        type="password"
                        name="confirmPassword"
                        value={form.confirmPassword}
                        onChange={handleChange}
                        placeholder="Repeat new password"
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                Next: Capture Face
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </form>
          )}

          {/* Step 2 — Face capture */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-1">
                <button
                  onClick={() => { setStep(1); setError(''); setCapturedPhoto(null); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                  style={{ background: 'var(--surface-s)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Face Registration</h2>
              </div>

              <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3">
                <p className="text-violet-400 text-xs flex items-start gap-2">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Look straight at the camera in good lighting. This photo will be used to verify your identity when marking attendance.
                </p>
              </div>

              <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                <WebcamCapture
                  onCapture={(photo) => { setCapturedPhoto(photo); setError(''); }}
                  onError={(msg) => setError(msg)}
                />
              </div>

              {capturedPhoto && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Face captured — ready to save
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading || !capturedPhoto}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving Profile...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-3)' }}>
          Made with ♥ by Pratham Jain &nbsp;|&nbsp; Garvix AI © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
