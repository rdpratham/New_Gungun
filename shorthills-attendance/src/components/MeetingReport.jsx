import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

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
function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }

/* ── Icons ───────────────────────────────────────────────────────── */
const IconBarChart = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const IconChevronLeft = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
  </svg>
);
const IconChevronRight = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
  </svg>
);
const IconClose = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IconTrophy = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 21h8m-4 0v-4m0 0a4 4 0 004-4V5H8v8a4 4 0 004 4zM8 5H4a2 2 0 000 4h4M16 5h4a2 2 0 010 4h-4" />
  </svg>
);

/* ── Large Donut Chart (overview) ────────────────────────────────── */
function LargeDonut({ completed = 0, target = 0 }) {
  const r = 70;
  const circ = 2 * Math.PI * r;
  const pct = target > 0 ? clamp(completed / target, 0, 1) : 0;
  const dash = pct * circ;
  const pctDisplay = Math.round(pct * 100);

  return (
    <svg width="180" height="180" viewBox="0 0 180 180" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="ldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <radialGradient id="ldGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(124,58,237,0.3)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <filter id="ldFilter">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx="90" cy="90" r="80" fill="url(#ldGlow)" opacity="0.4" />
      <circle cx="90" cy="90" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="14" />
      <circle
        cx="90" cy="90" r={r} fill="none"
        stroke="url(#ldGrad)" strokeWidth="14"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 90 90)"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
        filter="url(#ldFilter)"
      />
      <text x="90" y="82" textAnchor="middle" fontSize="28" fontWeight="800" fill="white">{completed}</text>
      <text x="90" y="100" textAnchor="middle" fontSize="12" fontWeight="500" fill="rgba(255,255,255,0.6)">of {target}</text>
      <text x="90" y="118" textAnchor="middle" fontSize="14" fontWeight="700" fill="#a78bfa">{pctDisplay}%</text>
    </svg>
  );
}

/* ── Employee Modal Donut ─────────────────────────────────────────── */
function ModalDonut({ completed = 0, scheduled = 0, target = 0 }) {
  const r = 55;
  const circ = 2 * Math.PI * r;
  const compPct = target > 0 ? clamp(completed / target, 0, 1) : 0;
  const schedPct = target > 0 ? clamp(scheduled / target, 0, 1) : 0;
  const compDash = compPct * circ;
  const schedDash = schedPct * circ;

  return (
    <svg width="140" height="140" viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="mdComp" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <filter id="mdGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="12" />
      <circle
        cx="70" cy="70" r={r} fill="none"
        stroke="rgba(59,130,246,0.4)" strokeWidth="12"
        strokeDasharray={`${schedDash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <circle
        cx="70" cy="70" r={r} fill="none"
        stroke="url(#mdComp)" strokeWidth="12"
        strokeDasharray={`${compDash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 70 70)"
        filter="url(#mdGlow)"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x="70" y="65" textAnchor="middle" fontSize="22" fontWeight="800" fill="white">{completed}</text>
      <text x="70" y="82" textAnchor="middle" fontSize="10" fontWeight="500" fill="rgba(255,255,255,0.55)">of {target}</text>
      <text x="70" y="96" textAnchor="middle" fontSize="11" fontWeight="700" fill="#a78bfa">
        {Math.round(compPct * 100)}%
      </text>
    </svg>
  );
}

/* ── Stat Card ───────────────────────────────────────────────────── */
function StatCard({ label, value, color, icon, sub }) {
  return (
    <div className="card flex flex-col gap-1 animate-fade-in" style={{ borderColor: color ? `${color}30` : undefined }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-3)' }}>{label}</p>
          <p className="text-3xl font-black" style={{ color: color || 'var(--text)' }}>{value}</p>
          {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{sub}</p>}
        </div>
        {icon && (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: color ? `${color}18` : 'rgba(255,255,255,0.06)', color: color || 'var(--text-2)' }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Horizontal Bar Row ──────────────────────────────────────────── */
function BarRow({ rec, maxTarget, onClick }) {
  const completed = rec.completed ?? 0;
  const scheduled = rec.scheduled ?? 0;
  const target = rec.target ?? 0;
  const barMax = Math.max(maxTarget, 1);
  const compPct = clamp((completed / barMax) * 100, 0, 100);
  const schedPct = clamp((scheduled / barMax) * 100, 0, 100);
  const targetPct = clamp((target / barMax) * 100, 0, 100);
  const achievePct = target > 0 ? Math.round((completed / target) * 100) : 0;
  const achieved = completed >= target && target > 0;

  return (
    <div
      className="flex items-center gap-3 py-3 px-3 rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.005]"
      style={{
        background: 'var(--surface)',
        border: achieved ? '1px solid rgba(16,185,129,0.25)' : '1px solid var(--border)',
        boxShadow: achieved ? '0 0 16px rgba(16,185,129,0.06)' : 'none',
      }}
      onClick={onClick}
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', boxShadow: '0 3px 10px rgba(124,58,237,0.3)' }}
      >
        {getInitials(rec.employeeName)}
      </div>

      {/* Name + ID */}
      <div className="w-28 flex-shrink-0 hidden sm:block">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{rec.employeeName}</p>
        <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{rec.employeeId || '—'}</p>
      </div>
      <div className="sm:hidden flex-shrink-0 max-w-[5rem]">
        <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{rec.employeeName?.split(' ')[0]}</p>
      </div>

      {/* Stacked bar */}
      <div className="flex-1 flex flex-col gap-1">
        <div className="relative h-5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          {/* Scheduled layer */}
          <div
            className="absolute left-0 top-0 h-full rounded-full"
            style={{ width: `${schedPct}%`, background: 'rgba(59,130,246,0.3)', transition: 'width 0.8s ease' }}
          />
          {/* Completed layer */}
          <div
            className="absolute left-0 top-0 h-full rounded-full"
            style={{
              width: `${compPct}%`,
              background: 'linear-gradient(90deg,#7c3aed,#3b82f6)',
              boxShadow: compPct > 0 ? '0 0 8px rgba(124,58,237,0.45)' : 'none',
              transition: 'width 0.8s ease',
              minWidth: compPct > 0 ? '6px' : '0',
            }}
          />
          {/* Target marker */}
          {target > 0 && (
            <div
              className="absolute top-0 h-full w-0.5"
              style={{
                left: `${targetPct}%`,
                background: 'rgba(255,255,255,0.75)',
                boxShadow: '0 0 4px rgba(255,255,255,0.5)',
              }}
            />
          )}
          {/* Inline label if bar is wide enough */}
          {compPct > 30 && (
            <span className="absolute left-2 top-0 h-full flex items-center text-white font-semibold pointer-events-none"
              style={{ fontSize: '10px' }}>
              {completed}/{target}
            </span>
          )}
        </div>
        {compPct <= 30 && (
          <p className="text-xs leading-none" style={{ color: 'var(--text-3)' }}>{completed} done / {target} target</p>
        )}
      </div>

      {/* % badge */}
      <div
        className="flex-shrink-0 w-14 text-center py-1 rounded-lg text-xs font-bold"
        style={{
          background: achieved
            ? 'rgba(16,185,129,0.15)'
            : achievePct >= 75 ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
          color: achieved ? '#10b981' : achievePct >= 75 ? '#3b82f6' : 'var(--text-2)',
          border: `1px solid ${achieved ? 'rgba(16,185,129,0.25)' : 'var(--border-s)'}`,
        }}
      >
        {achievePct}%
      </div>
    </div>
  );
}

/* ── Employee Detail Modal ───────────────────────────────────────── */
function EmployeeModal({ rec, onClose }) {
  const completed = rec.completed ?? 0;
  const scheduled = rec.scheduled ?? 0;
  const target = rec.target ?? 0;
  const remaining = Math.max(target - completed, 0);
  const achieved = completed >= target && target > 0;

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm animate-slide-up rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface-s)', border: '1px solid var(--border)', boxShadow: '0 40px 80px rgba(0,0,0,0.55)' }}
      >
        {/* Modal header */}
        <div
          className="relative overflow-hidden p-5 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}
        >
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 blur-2xl"
            style={{ background: 'radial-gradient(circle,#fff,transparent)' }} />
          <div className="flex items-center gap-3 relative">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold text-white"
              style={{ background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.3)' }}
            >
              {getInitials(rec.employeeName)}
            </div>
            <div>
              <p className="font-bold text-white text-base">{rec.employeeName}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>ID: {rec.employeeId || '—'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="relative w-8 h-8 rounded-lg flex items-center justify-center text-white transition-colors hover:bg-white/20"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <IconClose />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Donut + stat grid */}
          <div className="flex items-center gap-4">
            <ModalDonut completed={completed} scheduled={scheduled} target={target} />
            <div className="flex-1 grid grid-cols-2 gap-2">
              {[
                { label: 'Target', value: target, color: 'var(--text-2)' },
                { label: 'Completed', value: completed, color: '#7c3aed' },
                { label: 'Scheduled', value: scheduled, color: '#3b82f6' },
                { label: 'Remaining', value: remaining, color: remaining === 0 && target > 0 ? '#10b981' : '#f59e0b' },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="flex flex-col items-center py-2.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-s)' }}
                >
                  <span className="text-xl font-black" style={{ color }}>{value}</span>
                  <span className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Achievement banner */}
          {achieved && (
            <div
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}
            >
              <IconTrophy />
              <span className="text-sm font-semibold" style={{ color: '#10b981' }}>
                Target achieved! Great work.
              </span>
            </div>
          )}

          {/* Comment */}
          {rec.comment && (
            <div
              className="px-4 py-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-s)' }}
            >
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-3)' }}>Admin Note</p>
              <p className="text-sm italic" style={{ color: 'var(--text-2)' }}>"{rec.comment}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */
export default function MeetingReport({ employees = [] }) {
  const allMonths = getRecentMonths(6);
  const [selectedMonth, setSelectedMonth] = useState(allMonths[0]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalRec, setModalRec] = useState(null);

  const monthIdx = allMonths.indexOf(selectedMonth);
  const canPrev = monthIdx < allMonths.length - 1;
  const canNext = monthIdx > 0;

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'meetings'), where('month', '==', selectedMonth));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.completed ?? 0) - (a.completed ?? 0));
      setRecords(docs);
      setLoading(false);
    });
    return () => unsub();
  }, [selectedMonth]);

  /* Aggregates */
  const totalCompleted = records.reduce((s, r) => s + (r.completed ?? 0), 0);
  const totalScheduled = records.reduce((s, r) => s + (r.scheduled ?? 0), 0);
  const totalTarget = records.reduce((s, r) => s + (r.target ?? 0), 0);
  const avgPct = records.length > 0
    ? Math.round(records.reduce((s, r) => {
        const t = r.target ?? 0;
        return s + (t > 0 ? clamp((r.completed ?? 0) / t, 0, 1) * 100 : 0);
      }, 0) / records.length)
    : 0;
  const maxTarget = Math.max(...records.map(r => r.target ?? 0), 1);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {modalRec && <EmployeeModal rec={modalRec} onClose={() => setModalRec(null)} />}

      {/* ── Hero Banner ─────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', padding: '2.5rem 2rem 2rem' }}
      >
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle,#fff,transparent)' }} />
        <div className="absolute -bottom-12 left-1/4 w-48 h-48 rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle,#a78bfa,transparent)' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 max-w-5xl mx-auto">
          <div className="flex items-center gap-4 flex-1">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-white"
              style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.25)' }}
            >
              <IconBarChart />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Meeting Report</h1>
              <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                Team performance — {formatMonth(selectedMonth)}
              </p>
            </div>
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white transition-all duration-150 disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)' }}
              onClick={() => setSelectedMonth(allMonths[monthIdx + 1])}
              disabled={!canPrev}
            >
              <IconChevronLeft />
            </button>
            <select
              className="text-sm font-semibold text-white rounded-lg px-3 py-1.5 cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)' }}
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            >
              {allMonths.map(m => (
                <option key={m} value={m} style={{ background: '#1e1b4b', color: '#fff' }}>{formatMonth(m)}</option>
              ))}
            </select>
            <button
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white transition-all duration-150 disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)' }}
              onClick={() => setSelectedMonth(allMonths[monthIdx - 1])}
              disabled={!canNext}
            >
              <IconChevronRight />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {/* ── 4 Summary Stat Cards ─────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Team Completed"
                value={totalCompleted}
                color="#7c3aed"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              <StatCard
                label="Team Scheduled"
                value={totalScheduled}
                color="#3b82f6"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
              />
              <StatCard
                label="Team Target"
                value={totalTarget}
                color="#f59e0b"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" strokeWidth={2} />
                    <circle cx="12" cy="12" r="6" strokeWidth={2} />
                    <circle cx="12" cy="12" r="2" strokeWidth={2} />
                  </svg>
                }
              />
              <StatCard
                label="Avg Completion"
                value={`${avgPct}%`}
                color={avgPct >= 80 ? '#10b981' : avgPct >= 50 ? '#3b82f6' : '#f59e0b'}
                sub={`${records.length} member${records.length !== 1 ? 's' : ''}`}
                icon={<IconBarChart />}
              />
            </div>

            {/* ── Progress Overview with Large Donut ───────────────── */}
            {records.length > 0 && (
              <div
                className="relative overflow-hidden rounded-2xl p-6 animate-fade-in"
                style={{
                  background: 'linear-gradient(135deg,rgba(124,58,237,0.15),rgba(59,130,246,0.12))',
                  border: '1px solid rgba(124,58,237,0.25)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full opacity-10 blur-3xl"
                  style={{ background: 'radial-gradient(circle,#7c3aed,transparent)' }} />
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <LargeDonut completed={totalCompleted} target={totalTarget} />
                  <div className="flex-1 flex flex-col gap-4">
                    <div>
                      <h3 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                        Team Progress Overview
                      </h3>
                      <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
                        {formatMonth(selectedMonth)} · {records.length} member{records.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3">
                      {[
                        {
                          label: 'Completed',
                          value: totalCompleted,
                          max: totalTarget,
                          color: 'linear-gradient(90deg,#7c3aed,#3b82f6)',
                          glow: '0 0 10px rgba(124,58,237,0.4)',
                        },
                        {
                          label: 'Scheduled',
                          value: totalScheduled,
                          max: totalTarget,
                          color: 'rgba(59,130,246,0.6)',
                          glow: 'none',
                        },
                      ].map(({ label, value, max, color, glow }) => {
                        const pct = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;
                        return (
                          <div key={label} className="flex flex-col gap-1">
                            <div className="flex justify-between text-sm">
                              <span style={{ color: 'var(--text-2)' }}>{label}</span>
                              <span className="font-bold" style={{ color: 'var(--text)' }}>{value} / {max}</span>
                            </div>
                            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  background: color,
                                  boxShadow: glow,
                                  transition: 'width 0.8s ease',
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Individual Breakdown Bar Chart ────────────────────── */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
                  Individual Breakdown
                </h2>
                {records.length > 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                    Click any row to see details
                  </span>
                )}
              </div>

              {records.length === 0 ? (
                <div
                  className="flex flex-col items-center gap-3 py-16 rounded-2xl"
                  style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}
                >
                  <div className="text-violet-400"><IconBarChart /></div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>
                    No meeting records for {formatMonth(selectedMonth)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                    Assign targets to get started
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {records.map(rec => (
                    <BarRow
                      key={rec.id}
                      rec={rec}
                      maxTarget={maxTarget}
                      onClick={() => setModalRec(rec)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Chart Legend ─────────────────────────────────────── */}
            {records.length > 0 && (
              <div
                className="flex flex-wrap items-center gap-5 px-4 py-3 rounded-xl text-xs"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-s)', color: 'var(--text-3)' }}
              >
                <span className="font-semibold" style={{ color: 'var(--text-2)' }}>Legend:</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-8 h-2.5 rounded-full" style={{ background: 'linear-gradient(90deg,#7c3aed,#3b82f6)' }} />
                  <span>Completed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-8 h-2.5 rounded-full" style={{ background: 'rgba(59,130,246,0.4)' }} />
                  <span>Scheduled</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-0.5 h-4 rounded-full" style={{ background: 'rgba(255,255,255,0.65)' }} />
                  <span>Target marker</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.3)' }} />
                  <span style={{ color: '#10b981' }}>Target achieved</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
