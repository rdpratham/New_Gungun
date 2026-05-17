import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export default function ProfileSetupSettings() {
  const [requirePhoto, setRequirePhoto] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const CONFIG_DOC = doc(db, 'appSettings', 'config');

  useEffect(() => {
    return onSnapshot(CONFIG_DOC, snap => {
      if (snap.exists()) {
        const d = snap.data();
        setRequirePhoto(d.requirePhotoOnSetup !== false);
      }
    });
  }, []);

  const handleToggle = async () => {
    const newVal = !requirePhoto;
    setSaving(true);
    try {
      await setDoc(CONFIG_DOC, { requirePhotoOnSetup: newVal }, { merge: true });
      setRequirePhoto(newVal);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600 }}>Profile Setup Settings</h1>
        <p style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 2 }}>Configure employee onboarding requirements</p>
      </div>

      {/* Photo toggle card */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                   style={{ background: requirePhoto ? 'rgba(124,58,237,0.15)' : 'var(--surface-s)', border: '1px solid var(--border)' }}>
                <svg className="w-3.5 h-3.5" style={{ color: requirePhoto ? '#a78bfa' : 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Require Photo During Setup</p>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5, marginTop: 4 }}>
              {requirePhoto
                ? 'Employees must capture a face photo to complete their profile setup. Photo is used for attendance verification.'
                : 'Employees can skip photo during setup and complete their profile without a photo. They can add a photo later from their profile settings.'}
            </p>
            {!requirePhoto && (
              <div className="flex items-center gap-1.5 mt-3 px-3 py-2 rounded-lg"
                   style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <svg className="w-3 h-3 flex-shrink-0" style={{ color: '#fbbf24' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p style={{ fontSize: 10, color: '#fbbf24' }}>Face-based attendance verification will not work for employees without photos.</p>
              </div>
            )}
          </div>
          {/* Toggle switch */}
          <button
            onClick={handleToggle}
            disabled={saving}
            className="flex-shrink-0 relative transition-all duration-300"
            style={{ width: 44, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer',
              background: requirePhoto ? 'linear-gradient(135deg,#7c3aed,#3b82f6)' : 'var(--surface-s)',
              outline: requirePhoto ? '1px solid rgba(124,58,237,0.4)' : '1px solid var(--border)',
              opacity: saving ? 0.6 : 1 }}
            aria-label="Toggle photo requirement"
          >
            <span className="absolute top-1 transition-all duration-300"
                  style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    left: requirePhoto ? 24 : 4,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
          </button>
        </div>
        {saved && (
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <svg className="w-3.5 h-3.5" style={{ color: '#10b981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p style={{ fontSize: 11, color: '#10b981' }}>Settings saved successfully</p>
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>How It Works</p>
        <div className="space-y-3">
          {[
            { icon: '①', text: 'Admin creates employee account from Employees section', color: '#a78bfa' },
            { icon: '②', text: 'Employee logs in and goes through profile setup wizard', color: '#60a5fa' },
            { icon: '③', text: requirePhoto ? 'Employee must capture face photo to complete setup' : 'Employee fills personal info — photo step is skipped automatically', color: requirePhoto ? '#10b981' : '#fbbf24' },
            { icon: '④', text: requirePhoto ? 'Profile is complete — attendance verification enabled' : 'Profile is complete — employee should add photo later via Profile Settings', color: requirePhoto ? '#10b981' : '#f87171' },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <span style={{ fontSize: 13, fontWeight: 700, color: s.color, flexShrink: 0, width: 20 }}>{s.icon}</span>
              <p style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
