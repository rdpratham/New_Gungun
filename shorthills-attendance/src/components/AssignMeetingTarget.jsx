import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import {
  doc, setDoc, onSnapshot, collection, query, where,
  serverTimestamp, getDoc,
} from 'firebase/firestore';

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
function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
function formatTS(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Icons ───────────────────────────────────────────────────────── */
const IconTarget = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeWidth={2} />
    <circle cx="12" cy="12" r="6" strokeWidth={2} />
    <circle cx="12" cy="12" r="2" strokeWidth={2} />
  </svg>
);
const IconCheck = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);
const IconX = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IconUser = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);
const IconCalendar = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const IconSpinner = () => (
  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
    <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/* ── Mini donut for assignment cards ─────────────────────────────── */
function MiniDonut({ completed = 0, target = 0, size = 52 }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(completed / target, 1) : 0;
  const dash = pct * circ;
  const id = `mgd-${Math.round(pct * 100)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <filter id={`glow-${id}`}>
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
      <circle
        cx="22" cy="22" r={r} fill="none"
        stroke={`url(#${id})`} strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
        filter={`url(#glow-${id})`}
      />
      <text x="22" y="25" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="white">
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}

/* ── Toast ───────────────────────────────────────────────────────── */
function Toast({ toasts }) {
  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className="animate-fade-in flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium pointer-events-auto"
          style={{
            background: t.type === 'success'
              ? 'linear-gradient(135deg,rgba(16,185,129,0.97),rgba(5,150,105,0.97))'
              : 'linear-gradient(135deg,rgba(239,68,68,0.97),rgba(185,28,28,0.97))',
            border: `1px solid ${t.type === 'success' ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
            color: '#fff',
            backdropFilter: 'blur(12px)',
            boxShadow: t.type === 'success'
              ? '0 8px 32px rgba(16,185,129,0.25)'
              : '0 8px 32px rgba(239,68,68,0.25)',
          }}
        >
          {t.type === 'success' ? <IconCheck /> : <IconX />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ── Assignment Card ─────────────────────────────────────────────── */
function AssignmentCard({ asgn }) {
  const completed = asgn.completed ?? 0;
  const scheduled = asgn.scheduled ?? 0;
  const target = asgn.target ?? 0;
  const completedPct = target > 0 ? Math.min((completed / target) * 100, 100) : 0;
  const scheduledPct = target > 0 ? Math.min((scheduled / target) * 100, 100) : 0;
  const achieved = completed >= target && target > 0;

  return (
    <div
      className="animate-fade-in rounded-2xl p-4 flex flex-col gap-3"
      style={{
        background: 'var(--surface)',
        border: achieved ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
        boxShadow: achieved ? '0 0 20px rgba(16,185,129,0.08)' : 'none',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}
          >
            {getInitials(asgn.employeeName)}
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{asgn.employeeName}</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>ID: {asgn.employeeId || '—'}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <MiniDonut completed={completed} target={target} />
          {achieved && (
            <span className="text-xs font-semibold" style={{ color: '#10b981' }}>Achieved!</span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Target', value: target, color: 'var(--text-2)' },
          { label: 'Done', value: completed, color: '#7c3aed' },
          { label: 'Sched.', value: scheduled, color: '#3b82f6' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="flex flex-col items-center py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-s)' }}
          >
            <span className="text-lg font-bold" style={{ color }}>{value}</span>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs" style={{ color: 'var(--text-3)' }}>
          <span>{completed} completed / {target} target</span>
          <span>{Math.round(completedPct)}%</span>
        </div>
        <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div
            className="absolute left-0 top-0 h-full rounded-full"
            style={{ width: `${scheduledPct}%`, background: 'rgba(59,130,246,0.35)', transition: 'width 0.8s ease' }}
          />
          <div
            className="absolute left-0 top-0 h-full rounded-full"
            style={{
              width: `${completedPct}%`,
              background: 'linear-gradient(90deg,#7c3aed,#3b82f6)',
              transition: 'width 0.8s ease',
              boxShadow: '0 0 6px rgba(124,58,237,0.5)',
            }}
          />
        </div>
      </div>

      {/* Comment */}
      {asgn.comment && (
        <p
          className="text-xs italic line-clamp-2 px-2.5 py-1.5 rounded-lg"
          style={{ color: 'var(--text-3)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-s)' }}
        >
          "{asgn.comment}"
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-3)' }}>
        <IconCalendar />
        Assigned {formatTS(asgn.assignedAt)}
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */
export default function AssignMeetingTarget({ user, employees = [] }) {
  const months = getRecentMonths(6);
  const [month, setMonth] = useState(months[0]);
  const [selectedEmpUid, setSelectedEmpUid] = useState('');
  const [target, setTarget] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  /* realtime snapshot for selected month */
  useEffect(() => {
    if (!month) return;
    const q = query(collection(db, 'meetings'), where('month', '==', month));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));
      setAssignments(docs);
    });
    return () => unsub();
  }, [month]);

  function addToast(message, type = 'success') {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedEmpUid) return addToast('Please select an employee.', 'error');
    if (!target || Number(target) < 1) return addToast('Please enter a valid target.', 'error');

    const emp = employees.find(e => e.uid === selectedEmpUid);
    if (!emp) return addToast('Employee not found.', 'error');

    const docId = `${selectedEmpUid}_${month}`;
    const docRef = doc(db, 'meetings', docId);
    setSaving(true);

    try {
      const existing = await getDoc(docRef);
      const isNew = !existing.exists();

      const payload = {
        employeeUid: selectedEmpUid,
        employeeName: emp.name ?? null,
        employeeId: emp.employeeId ?? null,
        month,
        target: Number(target),
        comment: comment.trim() || null,
        assignedBy: user.uid,
        updatedAt: serverTimestamp(),
        assignedAt: serverTimestamp(),
      };
      if (isNew) {
        payload.completed = 0;
        payload.scheduled = 0;
      }

      await setDoc(docRef, payload, { merge: true });
      addToast(`Target assigned to ${emp.name} for ${formatMonth(month)}!`, 'success');
      setTarget('');
      setComment('');
      setSelectedEmpUid('');
    } catch (err) {
      console.error(err);
      addToast('Failed to save. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const selectedEmp = employees.find(e => e.uid === selectedEmpUid);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Toast toasts={toasts} />

      {/* ── Hero Banner ─────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', padding: '2.5rem 2rem 2.25rem' }}
      >
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle,#fff,transparent)' }} />
        <div className="absolute -bottom-10 -left-10 w-44 h-44 rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle,#a78bfa,transparent)' }} />
        <div className="absolute top-6 right-1/3 w-24 h-24 rounded-full opacity-10 blur-2xl"
          style={{ background: 'radial-gradient(circle,#60a5fa,transparent)' }} />

        <div className="relative flex items-center gap-4 max-w-3xl mx-auto">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-white"
            style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.25)' }}
          >
            <IconTarget />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Assign Meeting Target</h1>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.78)' }}>
              Set monthly meeting goals for team members
            </p>
          </div>
          <div className="ml-auto hidden sm:flex flex-col items-end gap-0.5">
            <span className="text-3xl font-black text-white opacity-90">{assignments.length}</span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>assigned this month</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-8">

        {/* ── Form Card ───────────────────────────────────────────── */}
        <div className="card animate-slide-up">
          <h2 className="text-lg font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <span
              className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}
            >+</span>
            New Assignment
          </h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Month */}
              <div>
                <label className="label">Month</label>
                <select className="input-field" value={month} onChange={e => setMonth(e.target.value)}>
                  {months.map(m => (
                    <option key={m} value={m}>{formatMonth(m)}</option>
                  ))}
                </select>
              </div>

              {/* Target */}
              <div>
                <label className="label">Monthly Meeting Target</label>
                <input
                  type="number" min="1" max="999"
                  placeholder="e.g. 20"
                  className="input-field"
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Employee */}
            <div>
              <label className="label">Employee</label>
              <select
                className="input-field"
                value={selectedEmpUid}
                onChange={e => setSelectedEmpUid(e.target.value)}
                required
              >
                <option value="">Select an employee…</option>
                {employees.map(emp => (
                  <option key={emp.uid} value={emp.uid}>
                    {emp.name}{emp.employeeId ? ` (${emp.employeeId})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected employee preview */}
            {selectedEmp && (
              <div
                className="animate-fade-in flex items-center gap-3 px-3.5 py-2.5 rounded-xl"
                style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.28)' }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}
                >
                  {getInitials(selectedEmp.name)}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{selectedEmp.name}</p>
                  {selectedEmp.employeeId && (
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>ID: {selectedEmp.employeeId}</p>
                  )}
                </div>
                <div className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}>
                  Selected
                </div>
              </div>
            )}

            {/* Comment */}
            <div>
              <label className="label">
                Comment <span style={{ color: 'var(--text-3)' }}>(optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Add a note or goal context for the employee…"
                className="input-field resize-none"
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn-primary flex items-center justify-center gap-2 mt-1"
              disabled={saving}
            >
              {saving ? <><IconSpinner /> Saving…</> : <><IconTarget /> Assign Target</>}
            </button>
          </form>
        </div>

        {/* ── Existing Assignments ─────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
              Assignments — <span style={{ color: '#a78bfa' }}>{formatMonth(month)}</span>
            </h2>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}
            >
              {assignments.length} employee{assignments.length !== 1 ? 's' : ''}
            </span>
          </div>

          {assignments.length === 0 ? (
            <div
              className="flex flex-col items-center gap-3 py-16 rounded-2xl"
              style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-violet-400"
                style={{ background: 'rgba(124,58,237,0.12)' }}
              >
                <IconUser />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>
                No targets assigned for {formatMonth(month)}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                Use the form above to add assignments
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {assignments.map(a => (
                <AssignmentCard key={a.id} asgn={a} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
