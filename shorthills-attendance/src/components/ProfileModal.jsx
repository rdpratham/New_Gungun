import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import WebcamCapture from './WebcamCapture';
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

/* ── Employee Profile ────────────────────────────────────── */
function EmployeeProfile({ user, employeeData, onClose, onUpdated }) {
  const [form, setForm] = useState({
    mobile:      employeeData?.mobile      || '',
    joiningDate: employeeData?.joiningDate || '',
    team:        employeeData?.team        || 'Sales Team',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await updateDoc(doc(db, 'employees', user.uid), {
        mobile:      form.mobile.trim(),
        joiningDate: form.joiningDate,
        team:        form.team.trim() || 'Sales Team',
      });
      setSuccess('Profile updated!');
      onUpdated?.({ ...employeeData, ...form });
      setTimeout(onClose, 1200);
    } catch (err) {
      setError('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Avatar + basic info */}
      <div className="flex items-center gap-4 p-4 rounded-xl border" style={{ background: 'var(--surface-s)', borderColor: 'var(--border-s)' }}>
        <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 border border-violet-500/30">
          {employeeData?.photoURL ? (
            <img src={employeeData.photoURL} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-violet-400"
                 style={{ background: 'linear-gradient(135deg,#7c3aed22,#3b82f622)' }}>
              {user.email?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <p className="font-semibold" style={{ color: 'var(--text)' }}>{user.email}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>ID: {employeeData?.employeeId || '—'}</p>
          <span className="status-badge-green mt-1 inline-flex">Active</span>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>Your Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Team</label>
            <input type="text" name="team" value={form.team} onChange={handleChange} className="input-field" />
          </div>
          <div>
            <label className="label">Mobile Number</label>
            <input type="tel" name="mobile" value={form.mobile} onChange={handleChange} placeholder="+91 98765 43210" maxLength={15} className="input-field" />
          </div>
          <div>
            <label className="label">Joining Date</label>
            <input type="date" name="joiningDate" value={form.joiningDate} onChange={handleChange} className="input-field" style={{ colorScheme: 'auto' }} />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>Account (Read-only)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Email</label>
            <div className="input-field opacity-60 cursor-not-allowed select-none text-sm truncate">{user.email}</div>
          </div>
          <div>
            <label className="label">Employee ID</label>
            <div className="input-field opacity-60 cursor-not-allowed select-none">{employeeData?.employeeId || '—'}</div>
          </div>
        </div>
      </div>

      {error   && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-400 text-sm">{success}</div>}

      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
          {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

/* ── Admin Profile ───────────────────────────────────────── */
function AdminProfile({ user, onClose }) {
  const [profileData, setProfileData] = useState(null);
  const [form, setForm]               = useState({ name: '', mobile: '' });
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [faceStatus, setFaceStatus]   = useState(null);
  const [saving, setSaving]           = useState(false);
  const [error,  setError]            = useState('');
  const [success, setSuccess]         = useState('');
  const [showCamera, setShowCamera]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'adminProfile', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          setProfileData(d);
          setForm({ name: d.name || '', mobile: d.mobile || '' });
        }
      } catch {}
    })();
  }, [user.uid]);

  const handleCapture = async (photoData) => {
    if (!photoData) { setCapturedPhoto(null); setFaceStatus(null); return; }
    setFaceStatus('detecting'); setError('');
    try {
      const descriptor = await getDescriptorFromDataURL(photoData.dataURL);
      if (!descriptor) { setFaceStatus('noface'); setError('No face detected — retake.'); setCapturedPhoto(null); return; }
      setCapturedPhoto({ ...photoData, descriptor });
      setFaceStatus('ok');
    } catch { setCapturedPhoto(photoData); setFaceStatus('ok'); }
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const updates = { name: form.name.trim(), mobile: form.mobile.trim(), email: user.email };
      if (capturedPhoto?.descriptor) {
        const compressed = await compressDataURL(capturedPhoto.dataURL);
        updates.photoURL       = compressed;
        updates.faceDescriptor = capturedPhoto.descriptor;
      }
      await setDoc(doc(db, 'adminProfile', user.uid), updates, { merge: true });
      setSuccess('Profile saved!');
      setTimeout(onClose, 1200);
    } catch (err) {
      setError('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const photoSrc = capturedPhoto?.dataURL || profileData?.photoURL;

  return (
    <div className="space-y-5">
      {/* Avatar */}
      <div className="flex items-center gap-4 p-4 rounded-xl border" style={{ background: 'var(--surface-s)', borderColor: 'var(--border-s)' }}>
        <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 border border-violet-500/30">
          {photoSrc ? (
            <img src={photoSrc} alt="Admin" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-violet-400"
                 style={{ background: 'linear-gradient(135deg,#7c3aed22,#3b82f622)' }}>A</div>
          )}
        </div>
        <div className="flex-1">
          <p className="font-semibold" style={{ color: 'var(--text)' }}>{form.name || user.email}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{user.email}</p>
          <span className="status-badge-violet mt-1 inline-flex">Admin</span>
        </div>
        <button
          onClick={() => { setShowCamera(v => !v); setCapturedPhoto(null); setFaceStatus(null); }}
          className="text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {showCamera ? 'Hide Camera' : 'Update Photo'}
        </button>
      </div>

      {showCamera && (
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
          <WebcamCapture onCapture={handleCapture} onError={m => setError(m)} />
          {faceStatus === 'ok' && (
            <div className="flex items-center gap-2 px-4 py-2 text-emerald-400 text-xs">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Face captured — will be saved
            </div>
          )}
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>Admin Details</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Your name" className="input-field" />
          </div>
          <div>
            <label className="label">Mobile Number</label>
            <input type="tel" value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} placeholder="+91 98765 43210" maxLength={15} className="input-field" />
          </div>
          <div>
            <label className="label">Email (Read-only)</label>
            <div className="input-field opacity-60 cursor-not-allowed select-none">{user.email}</div>
          </div>
        </div>
      </div>

      {error   && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}
      {success && <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-400 text-sm">{success}</div>}

      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
          {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}

/* ── Modal shell ─────────────────────────────────────────── */
export default function ProfileModal({ user, role, employeeData, onClose, onUpdated }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
         style={{ background: 'rgba(4,8,15,0.95)', backdropFilter: 'blur(16px)' }}>
      <div className="card max-w-lg w-full my-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>My Profile</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-3)' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {role === 'admin'
          ? <AdminProfile user={user} onClose={onClose} />
          : <EmployeeProfile user={user} employeeData={employeeData} onClose={onClose} onUpdated={onUpdated} />
        }
      </div>
    </div>
  );
}
