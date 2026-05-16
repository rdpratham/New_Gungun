import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

/* ── Toggle switch ───────────────────────────────────────────── */
function Toggle({ enabled, onChange, disabled: busy }) {
  return (
    <button
      onClick={() => !busy && onChange(!enabled)}
      disabled={busy}
      className="relative flex-shrink-0 transition-all duration-300 focus:outline-none disabled:opacity-50"
      style={{ width: '52px', height: '28px' }}
      aria-label={enabled ? 'Enabled' : 'Disabled'}
    >
      <div className="w-full h-full rounded-full transition-all duration-300"
           style={{ background: enabled ? 'linear-gradient(135deg,#7c3aed,#3b82f6)' : 'rgba(100,116,139,0.3)',
                    border: `1px solid ${enabled ? 'rgba(124,58,237,0.5)' : 'rgba(100,116,139,0.3)'}`,
                    boxShadow: enabled ? '0 0 12px rgba(124,58,237,0.35)' : 'none' }} />
      <div className="absolute top-[3px] transition-all duration-300 w-[22px] h-[22px] rounded-full shadow-md"
           style={{ left: enabled ? '27px' : '3px',
                    background: enabled ? '#fff' : '#94a3b8',
                    boxShadow: enabled ? '0 2px 8px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  );
}

/* ── Setting row ─────────────────────────────────────────────── */
function SettingRow({ icon, title, description, enabled, onChange, saving, tag }) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-2xl transition-all duration-200"
         style={{ background: enabled ? 'rgba(124,58,237,0.06)' : 'var(--surface-s)',
                  border: `1px solid ${enabled ? 'rgba(124,58,237,0.2)' : 'var(--border-s)'}` }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
           style={{ background: enabled ? 'linear-gradient(135deg,#7c3aed22,#3b82f622)' : 'var(--surface)',
                    border: `1px solid ${enabled ? 'rgba(124,58,237,0.3)' : 'var(--border)'}` }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{title}</p>
          {tag && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: enabled ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                           color: enabled ? '#34d399' : '#fbbf24' }}>
              {enabled ? 'ON' : 'OFF'}
            </span>
          )}
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>{description}</p>
      </div>
      <div className="flex-shrink-0 pt-0.5">
        {saving ? (
          <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <Toggle enabled={enabled} onChange={onChange} />
        )}
      </div>
    </div>
  );
}

const SETTINGS_DOC = doc(db, 'attendanceConfig', 'global');
const DEFAULT = { faceEnabled: true, locationEnabled: true };

/* ── Main modal ──────────────────────────────────────────────── */
export default function AttendanceOptionsModal({ onClose }) {
  const [settings, setSettings] = useState(DEFAULT);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(null); // which key is saving

  /* Live-sync settings from Firestore */
  useEffect(() => {
    const unsub = onSnapshot(SETTINGS_DOC, snap => {
      if (snap.exists()) setSettings({ ...DEFAULT, ...snap.data() });
      else               setSettings(DEFAULT);
      setLoading(false);
    }, err => { console.error(err); setLoading(false); });
    return () => unsub();
  }, []);

  const handleToggle = async (key, value) => {
    setSaving(key);
    try {
      await setDoc(SETTINGS_DOC, { ...settings, [key]: value, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.error('Failed to save setting:', err);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(4,8,15,0.88)', backdropFilter: 'blur(16px)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-slide-up"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div className="relative p-6 pb-4"
             style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#3b82f6 60%,#06b6d4 100%)' }}>
          <div className="absolute inset-0 opacity-20"
               style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #fff 0%, transparent 60%)' }} />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-white font-bold text-lg leading-tight">Attendance Options</h2>
              <p className="text-white/70 text-xs mt-0.5">Configure verification requirements for employees</p>
            </div>
            <button onClick={onClose}
                    className="w-8 h-8 bg-white/15 hover:bg-white/25 rounded-xl flex items-center justify-center transition-colors"
                    style={{ color: '#fff' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Work from home notice */}
              <div className="flex items-start gap-3 rounded-xl p-3"
                   style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#fbbf24' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs leading-relaxed" style={{ color: '#fbbf24' }}>
                  Disable location or face verification for <strong>Work From Home</strong> days. Changes apply immediately for all employees.
                </p>
              </div>

              {/* Face verification toggle */}
              <SettingRow
                icon={
                  <svg className="w-5 h-5" fill="none" stroke={settings.faceEnabled ? '#a78bfa' : '#64748b'} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                  </svg>
                }
                title="Face Verification"
                description={settings.faceEnabled
                  ? 'Employees must scan their face to submit attendance. Disable for WFH days.'
                  : 'Face scan is skipped. Employees can submit without camera verification.'}
                enabled={settings.faceEnabled}
                onChange={val => handleToggle('faceEnabled', val)}
                saving={saving === 'faceEnabled'}
                tag
              />

              {/* Location verification toggle */}
              <SettingRow
                icon={
                  <svg className="w-5 h-5" fill="none" stroke={settings.locationEnabled ? '#a78bfa' : '#64748b'} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
                title="Location Verification"
                description={settings.locationEnabled
                  ? 'Employees must be at Ambience Mall, Gurugram. Disable for WFH or remote work.'
                  : 'Location check is bypassed. Employees can sign in from any location.'}
                enabled={settings.locationEnabled}
                onChange={val => handleToggle('locationEnabled', val)}
                saving={saving === 'locationEnabled'}
                tag
              />

              {/* Status summary */}
              <div className="rounded-xl p-3 space-y-2"
                   style={{ background: 'var(--surface-s)', border: '1px solid var(--border-s)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>Current Mode</p>
                {settings.faceEnabled && settings.locationEnabled && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-xs font-medium" style={{ color: '#34d399' }}>Full verification — Office mode (default)</span>
                  </div>
                )}
                {!settings.faceEnabled && !settings.locationEnabled && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-xs font-medium" style={{ color: '#fbbf24' }}>Both disabled — Work From Home mode</span>
                  </div>
                )}
                {settings.faceEnabled && !settings.locationEnabled && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-xs font-medium" style={{ color: '#60a5fa' }}>Face only — Remote / WFH with face check</span>
                  </div>
                )}
                {!settings.faceEnabled && settings.locationEnabled && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-violet-400" />
                    <span className="text-xs font-medium" style={{ color: '#a78bfa' }}>Location only — On-site without face scan</span>
                  </div>
                )}
                <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                  Changes take effect immediately for all employees in real-time.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button onClick={onClose} className="btn-secondary w-full">Close</button>
        </div>
      </div>
    </div>
  );
}
