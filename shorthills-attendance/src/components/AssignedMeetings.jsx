import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';

/* ── Helpers ─────────────────────────────────────────────────────── */
function currentMonthIST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).slice(0, 7);
}
function formatMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
function getRecentMonths(n = 6) {
  const months = [];
  let [y, m] = currentMonthIST().split('-').map(Number);
  for (let i = 0; i < n; i++) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m--; if (m === 0) { m = 12; y--; }
  }
  return months;
}
function formatTS(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }

/* ── Icons ───────────────────────────────────────────────────────── */
const IconTarget = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeWidth={2} />
    <circle cx="12" cy="12" r="6" strokeWidth={2} />
    <circle cx="12" cy="12" r="2" strokeWidth={2} />
  </svg>
);
const IconCalendar = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const IconSave = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
  </svg>
);
const IconTrophy = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 21h8m-4 0v-4m0 0a4 4 0 004-4V5H8v8a4 4 0 004 4zM8 5H4a2 2 0 000 4h4M16 5h4a2 2 0 010 4h-4" />
  </svg>
);
const IconSpinner = () => (
  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
    <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
const IconCheck = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

/* ── Large Progress Ring ─────────────────────────────────────────── */
function ProgressRing({ completed = 0, scheduled = 0, target = 0 }) {
  const rOuter = 75;
  const rSched = 62;
  const circumOuter = 2 * Math.PI * rOuter;
  const circumSched = 2 * Math.PI * rSched;

  const compPct = target > 0 ? clamp(completed / target, 0, 1) : 0;
  const schedPct = target > 0 ? clamp(scheduled / target, 0, 1) : 0;
  const compDash = compPct * circumOuter;
  const schedDash = schedPct * circumSched;
  const pctNum = Math.round(compPct * 100);
  const achieved = compPct >= 1 && target > 0;

  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      <defs>
        <linearGradient id="prComp" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <radialGradient id="prGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={achieved ? 'rgba(16,185,129,0.25)' : 'rgba(124,58,237,0.25)'} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <filter id="prFilter">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {achieved && (
          <linearGradient id="prAchieved" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        )}
      </defs>

      {/* Glow background */}
      <circle cx="100" cy="100" r="90" fill="url(#prGlow)" opacity="0.6" />

      {/* Outer track (target) */}
      <circle cx="100" cy="100" r={rOuter} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="14" />
      {/* Scheduled ring (inner) */}
      <circle cx="100" cy="100" r={rSched} fill="none" stroke="rgba(59,130,246,0.25)" strokeWidth="10" />

      {/* Scheduled arc */}
      <circle
        cx="100" cy="100" r={rSched} fill="none"
        stroke="rgba(59,130,246,0.55)" strokeWidth="10"
        strokeDasharray={`${schedDash} ${circumSched}`}
        strokeLinecap="round"
        transform="rotate(-90 100 100)"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />

      {/* Completed arc */}
      <circle
        cx="100" cy="100" r={rOuter} fill="none"
        stroke={achieved ? 'url(#prAchieved)' : 'url(#prComp)'} strokeWidth="14"
        strokeDasharray={`${compDash} ${circumOuter}`}
        strokeLinecap="round"
        transform="rotate(-90 100 100)"
        filter="url(#prFilter)"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />

      {/* Center text */}
      <text x="100" y="88" textAnchor="middle" fontSize="36" fontWeight="900" fill="white">{completed}</text>
      <text x="100" y="108" textAnchor="middle" fontSize="13" fontWeight="500" fill="rgba(255,255,255,0.55)">of {target}</text>
      <text x="100" y="127" textAnchor="middle" fontSize="16" fontWeight="800"
        fill={achieved ? '#10b981' : '#a78bfa'}
      >{pctNum}%</text>
    </svg>
  );
}

/* ── Empty State ─────────────────────────────────────────────────── */
function EmptyState({ month }) {
  return (
    <div className="animate-fade-in flex flex-col items-center gap-5 py-20 px-6">
      <div
        className="relative w-24 h-24 rounded-3xl flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg,rgba(124,58,237,0.15),rgba(59,130,246,0.15))',
          border: '1px solid rgba(124,58,237,0.2)',
        }}
      >
        <div className="text-violet-400">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}
        >?</div>
      </div>
      <div className="text-center flex flex-col gap-1.5">
        <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>No target assigned</h3>
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          No meeting target has been set for <span className="font-semibold" style={{ color: '#a78bfa' }}>{formatMonth(month)}</span>.
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
          Please contact your admin to assign a meeting target for this month.
        </p>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */
export default function AssignedMeetings({ user, employeeData }) {
  const allMonths = getRecentMonths(6);
  const [month, setMonth] = useState(allMonths[0]);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  /* update form state */
  const [editCompleted, setEditCompleted] = useState('');
  const [editScheduled, setEditScheduled] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef(null);

  /* realtime snapshot for own record */
  useEffect(() => {
    if (!user?.uid || !month) return;
    setLoading(true);
    const docRef = doc(db, 'meetings', `${user.uid}_${month}`);
    const unsub = onSnapshot(docRef, snap => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setRecord(data);
        setEditCompleted(String(data.completed ?? 0));
        setEditScheduled(String(data.scheduled ?? 0));
      } else {
        setRecord(null);
        setEditCompleted('');
        setEditScheduled('');
      }
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid, month]);

  async function handleSave(e) {
    e.preventDefault();
    if (!record) return;
    const c = Math.max(0, parseInt(editCompleted, 10) || 0);
    const s = Math.max(0, parseInt(editScheduled, 10) || 0);
    setSaving(true);
    try {
      await updateDoc(doc(db, 'meetings', `${user.uid}_${month}`), {
        completed: c,
        scheduled: s,
        updatedAt: serverTimestamp(),
      });
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const completed = record?.completed ?? 0;
  const scheduled = record?.scheduled ?? 0;
  const target = record?.target ?? 0;
  const remaining = Math.max(target - completed, 0);
  const achieved = completed >= target && target > 0;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* ── Hero Banner ─────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', padding: '2.5rem 2rem 2rem' }}
      >
        <div className="absolute -top-16 -right-16 w-60 h-60 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle,#fff,transparent)' }} />
        <div className="absolute -bottom-10 left-1/4 w-44 h-44 rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle,#a78bfa,transparent)' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 max-w-2xl mx-auto">
          <div className="flex items-center gap-4 flex-1">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-white"
              style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.25)' }}
            >
              <IconTarget />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">My Meeting Target</h1>
              <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                {formatMonth(month)}
              </p>
            </div>
          </div>
          {/* Month selector */}
          <div>
            <select
              className="text-sm font-semibold text-white rounded-xl px-4 py-2 cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)' }}
              value={month}
              onChange={e => setMonth(e.target.value)}
            >
              {allMonths.map(m => (
                <option key={m} value={m} style={{ background: '#1e1b4b', color: '#fff' }}>{formatMonth(m)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
        ) : !record ? (
          <div
            className="card animate-fade-in"
            style={{ border: '1px dashed var(--border)' }}
          >
            <EmptyState month={month} />
          </div>
        ) : (
          <>
            {/* ── Target achievement banner ────────────────────────── */}
            {achieved && (
              <div
                className="animate-fade-in flex items-center gap-4 px-5 py-4 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg,rgba(16,185,129,0.18),rgba(5,150,105,0.12))',
                  border: '1px solid rgba(16,185,129,0.35)',
                  boxShadow: '0 0 30px rgba(16,185,129,0.12)',
                }}
              >
                <div className="text-emerald-400 flex-shrink-0">
                  <IconTrophy />
                </div>
                <div>
                  <p className="font-bold text-base" style={{ color: '#10b981' }}>Target Achieved! 🎉</p>
                  <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                    Outstanding! You've completed {completed} out of {target} meetings this month.
                  </p>
                </div>
              </div>
            )}

            {/* ── Gradient hero info card ───────────────────────────── */}
            <div
              className="animate-fade-in relative overflow-hidden rounded-2xl p-5"
              style={{
                background: 'linear-gradient(135deg,rgba(124,58,237,0.15),rgba(59,130,246,0.12))',
                border: '1px solid rgba(124,58,237,0.25)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10 blur-3xl"
                style={{ background: 'radial-gradient(circle,#7c3aed,transparent)' }} />

              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
                    Monthly Target
                  </p>
                  <p className="text-4xl font-black" style={{ color: 'var(--text)' }}>{target}</p>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>meetings</p>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs" style={{ color: 'var(--text-3)' }}>
                  <div className="flex items-center gap-1">
                    <IconCalendar />
                    <span>Assigned {formatTS(record.assignedAt)}</span>
                  </div>
                </div>
              </div>

              {record.comment && (
                <div
                  className="flex gap-2.5 px-3.5 py-3 rounded-xl mt-1"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-s)' }}
                >
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#a78bfa' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-sm italic" style={{ color: 'var(--text-2)' }}>"{record.comment}"</p>
                </div>
              )}
            </div>

            {/* ── Large SVG Progress Ring ───────────────────────────── */}
            <div
              className="animate-fade-in card flex flex-col items-center gap-6 py-8"
              style={{ borderColor: achieved ? 'rgba(16,185,129,0.25)' : undefined }}
            >
              <h3 className="text-base font-semibold self-start" style={{ color: 'var(--text)' }}>
                Progress Overview
              </h3>
              <ProgressRing completed={completed} scheduled={scheduled} target={target} />

              {/* 4 stat chips */}
              <div className="grid grid-cols-4 gap-2 w-full">
                {[
                  { label: 'Target', value: target, color: 'var(--text-2)' },
                  { label: 'Completed', value: completed, color: '#7c3aed' },
                  { label: 'Scheduled', value: scheduled, color: '#3b82f6' },
                  { label: 'Remaining', value: remaining, color: remaining === 0 && target > 0 ? '#10b981' : '#f59e0b' },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center py-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-s)' }}
                  >
                    <span className="text-2xl font-black" style={{ color }}>{value}</span>
                    <span className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="w-full flex flex-col gap-1.5">
                <div className="flex justify-between text-xs" style={{ color: 'var(--text-3)' }}>
                  <span>Completion progress</span>
                  <span className="font-semibold" style={{ color: '#a78bfa' }}>
                    {target > 0 ? Math.round((completed / target) * 100) : 0}%
                  </span>
                </div>
                <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  {/* Scheduled */}
                  <div
                    className="absolute left-0 top-0 h-full rounded-full"
                    style={{
                      width: `${target > 0 ? clamp((scheduled / target) * 100, 0, 100) : 0}%`,
                      background: 'rgba(59,130,246,0.35)',
                      transition: 'width 0.8s ease',
                    }}
                  />
                  {/* Completed */}
                  <div
                    className="absolute left-0 top-0 h-full rounded-full"
                    style={{
                      width: `${target > 0 ? clamp((completed / target) * 100, 0, 100) : 0}%`,
                      background: achieved
                        ? 'linear-gradient(90deg,#10b981,#059669)'
                        : 'linear-gradient(90deg,#7c3aed,#3b82f6)',
                      boxShadow: '0 0 8px rgba(124,58,237,0.45)',
                      transition: 'width 0.8s ease',
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs" style={{ color: 'var(--text-3)' }}>
                  <span>{completed} completed</span>
                  <span>{scheduled} scheduled</span>
                </div>
              </div>
            </div>

            {/* ── Update Progress Form ──────────────────────────────── */}
            <div className="card animate-slide-up">
              <h3 className="text-base font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
                <span
                  className="w-6 h-6 rounded-md flex items-center justify-center text-white"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </span>
                Update Progress
              </h3>
              <form onSubmit={handleSave} className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Meetings Completed</label>
                    <input
                      type="number"
                      min="0"
                      max="9999"
                      className="input-field"
                      value={editCompleted}
                      onChange={e => setEditCompleted(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="label">Meetings Scheduled</label>
                    <input
                      type="number"
                      min="0"
                      max="9999"
                      className="input-field"
                      value={editScheduled}
                      onChange={e => setEditScheduled(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="btn-primary flex items-center gap-2"
                    disabled={saving}
                  >
                    {saving ? <><IconSpinner /> Saving…</> : <><IconSave /> Save Progress</>}
                  </button>

                  {/* Saved indicator */}
                  {saved && (
                    <div
                      className="animate-fade-in flex items-center gap-1.5 text-sm font-semibold"
                      style={{ color: '#10b981' }}
                    >
                      <IconCheck />
                      Saved!
                    </div>
                  )}
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
