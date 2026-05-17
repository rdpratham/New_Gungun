import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';

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
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const IconTrophy = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 21h8m-4 0v-4m0 0a4 4 0 004-4V5H8v8a4 4 0 004 4zM8 5H4a2 2 0 000 4h4M16 5h4a2 2 0 010 4h-4" />
  </svg>
);
const IconUser = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

/* ── Large Donut for "My Report" section ─────────────────────────── */
function MyDonut({ completed = 0, scheduled = 0, target = 0 }) {
  const rOuter = 55;
  const rSched = 44;
  const circumOuter = 2 * Math.PI * rOuter;
  const circumSched = 2 * Math.PI * rSched;

  const compPct = target > 0 ? clamp(completed / target, 0, 1) : 0;
  const schedPct = target > 0 ? clamp(scheduled / target, 0, 1) : 0;
  const compDash = compPct * circumOuter;
  const schedDash = schedPct * circumSched;
  const achieved = compPct >= 1 && target > 0;

  return (
    <svg width="140" height="140" viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="myComp" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="myAchieved" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <radialGradient id="myGlowGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={achieved ? 'rgba(16,185,129,0.3)' : 'rgba(124,58,237,0.3)'} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <filter id="myFilter">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Background glow */}
      <circle cx="70" cy="70" r="65" fill="url(#myGlowGrad)" opacity="0.5" />

      {/* Tracks */}
      <circle cx="70" cy="70" r={rOuter} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="12" />
      <circle cx="70" cy="70" r={rSched} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="9" />

      {/* Scheduled arc */}
      <circle
        cx="70" cy="70" r={rSched} fill="none"
        stroke="rgba(59,130,246,0.45)" strokeWidth="9"
        strokeDasharray={`${schedDash} ${circumSched}`}
        strokeLinecap="round"
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />

      {/* Completed arc */}
      <circle
        cx="70" cy="70" r={rOuter} fill="none"
        stroke={achieved ? 'url(#myAchieved)' : 'url(#myComp)'} strokeWidth="12"
        strokeDasharray={`${compDash} ${circumOuter}`}
        strokeLinecap="round"
        transform="rotate(-90 70 70)"
        filter="url(#myFilter)"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />

      {/* Center text */}
      <text x="70" y="62" textAnchor="middle" fontSize="26" fontWeight="900" fill="white">{completed}</text>
      <text x="70" y="78" textAnchor="middle" fontSize="10" fontWeight="500" fill="rgba(255,255,255,0.5)">of {target}</text>
      <text x="70" y="93" textAnchor="middle" fontSize="12" fontWeight="700"
        fill={achieved ? '#10b981' : '#a78bfa'}
      >
        {Math.round(compPct * 100)}%
      </text>
    </svg>
  );
}

/* ── Compact bar row for team section ────────────────────────────── */
function TeamBarRow({ rec, maxTarget, isOwn }) {
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
      className="flex items-center gap-2.5 py-2.5 px-3 rounded-xl transition-all duration-200"
      style={{
        background: isOwn
          ? 'linear-gradient(135deg,rgba(124,58,237,0.15),rgba(59,130,246,0.1))'
          : 'var(--surface)',
        border: isOwn
          ? '1px solid rgba(124,58,237,0.35)'
          : achieved ? '1px solid rgba(16,185,129,0.2)' : '1px solid var(--border)',
        boxShadow: isOwn ? '0 0 16px rgba(124,58,237,0.08)' : 'none',
      }}
    >
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{
          background: isOwn
            ? 'linear-gradient(135deg,#7c3aed,#3b82f6)'
            : 'rgba(255,255,255,0.1)',
          boxShadow: isOwn ? '0 2px 8px rgba(124,58,237,0.35)' : 'none',
        }}
      >
        {getInitials(rec.employeeName)}
      </div>

      {/* Name */}
      <div className="w-24 flex-shrink-0">
        <p
          className="text-xs font-semibold truncate"
          style={{ color: isOwn ? '#a78bfa' : 'var(--text)' }}
        >
          {rec.employeeName?.split(' ')[0]}{isOwn ? ' (You)' : ''}
        </p>
      </div>

      {/* Bar */}
      <div className="flex-1 relative h-4 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        {/* Scheduled */}
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ width: `${schedPct}%`, background: 'rgba(59,130,246,0.3)', transition: 'width 0.8s ease' }}
        />
        {/* Completed */}
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            width: `${compPct}%`,
            background: isOwn
              ? 'linear-gradient(90deg,#7c3aed,#3b82f6)'
              : achieved ? 'linear-gradient(90deg,#10b981,#059669)' : 'rgba(148,163,184,0.5)',
            boxShadow: isOwn && compPct > 0 ? '0 0 6px rgba(124,58,237,0.4)' : 'none',
            transition: 'width 0.8s ease',
            minWidth: compPct > 0 ? '4px' : '0',
          }}
        />
        {/* Target marker */}
        {target > 0 && (
          <div
            className="absolute top-0 h-full w-px"
            style={{
              left: `${targetPct}%`,
              background: 'rgba(255,255,255,0.65)',
              boxShadow: '0 0 3px rgba(255,255,255,0.4)',
            }}
          />
        )}
      </div>

      {/* % chip */}
      <div
        className="flex-shrink-0 w-11 text-center py-0.5 rounded-md text-xs font-bold"
        style={{
          background: achieved ? 'rgba(16,185,129,0.15)' : isOwn ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
          color: achieved ? '#10b981' : isOwn ? '#a78bfa' : 'var(--text-3)',
          border: `1px solid ${achieved ? 'rgba(16,185,129,0.25)' : isOwn ? 'rgba(124,58,237,0.3)' : 'var(--border-s)'}`,
        }}
      >
        {achievePct}%
      </div>
    </div>
  );
}

/* ── Stat Chip ───────────────────────────────────────────────────── */
function StatChip({ label, value, color }) {
  return (
    <div
      className="flex flex-col items-center py-3 px-2 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}22` }}
    >
      <span className="text-2xl font-black" style={{ color }}>{value}</span>
      <span className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{label}</span>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */
export default function MeetingReportEmployee({ user, employeeData }) {
  const allMonths = getRecentMonths(6);
  const [selectedMonth, setSelectedMonth] = useState(allMonths[0]);

  /* Own data */
  const [myRecord, setMyRecord] = useState(null);
  const [myLoading, setMyLoading] = useState(true);

  /* Team data */
  const [teamRecords, setTeamRecords] = useState([]);
  const [teamLoading, setTeamLoading] = useState(true);

  /* Subscription 1 — own doc */
  useEffect(() => {
    if (!user?.uid || !selectedMonth) return;
    setMyLoading(true);
    const docRef = doc(db, 'meetings', `${user.uid}_${selectedMonth}`);
    const unsub = onSnapshot(docRef, snap => {
      setMyRecord(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setMyLoading(false);
    });
    return () => unsub();
  }, [user?.uid, selectedMonth]);

  /* Subscription 2 — all team docs for month */
  useEffect(() => {
    if (!selectedMonth) return;
    setTeamLoading(true);
    const q = query(collection(db, 'meetings'), where('month', '==', selectedMonth));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.completed ?? 0) - (a.completed ?? 0));
      setTeamRecords(docs);
      setTeamLoading(false);
    });
    return () => unsub();
  }, [selectedMonth]);

  /* My stats */
  const myCompleted = myRecord?.completed ?? 0;
  const myScheduled = myRecord?.scheduled ?? 0;
  const myTarget = myRecord?.target ?? 0;
  const myRemaining = Math.max(myTarget - myCompleted, 0);
  const myAchieved = myCompleted >= myTarget && myTarget > 0;
  const myCompPct = myTarget > 0 ? clamp((myCompleted / myTarget) * 100, 0, 100) : 0;
  const mySchedPct = myTarget > 0 ? clamp((myScheduled / myTarget) * 100, 0, 100) : 0;

  /* Team aggregates */
  const teamCompleted = teamRecords.reduce((s, r) => s + (r.completed ?? 0), 0);
  const teamScheduled = teamRecords.reduce((s, r) => s + (r.scheduled ?? 0), 0);
  const teamTarget = teamRecords.reduce((s, r) => s + (r.target ?? 0), 0);
  const maxTarget = Math.max(...teamRecords.map(r => r.target ?? 0), 1);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* ── Hero Banner ─────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', padding: '2.5rem 2rem 2rem' }}
      >
        <div className="absolute -top-16 -right-16 w-60 h-60 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle,#fff,transparent)' }} />
        <div className="absolute -bottom-12 left-1/3 w-44 h-44 rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle,#a78bfa,transparent)' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 max-w-3xl mx-auto">
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
                Your progress &amp; team overview
              </p>
            </div>
          </div>
          <select
            className="text-sm font-semibold text-white rounded-xl px-4 py-2 cursor-pointer self-start sm:self-auto"
            style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)' }}
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          >
            {allMonths.map(m => (
              <option key={m} value={m} style={{ background: '#1e1b4b', color: '#fff' }}>{formatMonth(m)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-8">

        {/* ════════════════════════════════════════════════════════
            MY REPORT SECTION
            ════════════════════════════════════════════════════ */}
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold flex items-center gap-2.5" style={{ color: 'var(--text)' }}>
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}
            >
              <IconUser />
            </span>
            My Report
            <span className="text-sm font-normal ml-1" style={{ color: 'var(--text-3)' }}>— {formatMonth(selectedMonth)}</span>
          </h2>

          {myLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            </div>
          ) : !myRecord ? (
            /* No target state */
            <div
              className="animate-fade-in flex flex-col items-center gap-3 py-12 rounded-2xl"
              style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-violet-400"
                style={{ background: 'rgba(124,58,237,0.1)' }}
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01" />
                </svg>
              </div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-2)' }}>No target assigned for {formatMonth(selectedMonth)}</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Contact your admin to assign a meeting target.</p>
            </div>
          ) : (
            <>
              {/* Achievement banner */}
              {myAchieved && (
                <div
                  className="animate-fade-in flex items-center gap-3 px-5 py-3.5 rounded-2xl"
                  style={{
                    background: 'linear-gradient(135deg,rgba(16,185,129,0.18),rgba(5,150,105,0.12))',
                    border: '1px solid rgba(16,185,129,0.35)',
                    boxShadow: '0 0 24px rgba(16,185,129,0.1)',
                  }}
                >
                  <IconTrophy />
                  <div>
                    <p className="font-bold text-sm" style={{ color: '#10b981' }}>Target Achieved! 🎉</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                      You completed {myCompleted} / {myTarget} meetings. Outstanding performance!
                    </p>
                  </div>
                </div>
              )}

              {/* Donut + chips */}
              <div
                className="animate-fade-in card flex flex-col sm:flex-row items-center gap-6 py-6"
                style={{ borderColor: myAchieved ? 'rgba(16,185,129,0.25)' : undefined }}
              >
                <MyDonut completed={myCompleted} scheduled={myScheduled} target={myTarget} />

                <div className="flex-1 w-full flex flex-col gap-4">
                  {/* 4 stat chips */}
                  <div className="grid grid-cols-4 gap-2">
                    <StatChip label="Target" value={myTarget} color="var(--text-2)" />
                    <StatChip label="Done" value={myCompleted} color="#7c3aed" />
                    <StatChip label="Sched." value={myScheduled} color="#3b82f6" />
                    <StatChip
                      label="Left"
                      value={myRemaining}
                      color={myRemaining === 0 && myTarget > 0 ? '#10b981' : '#f59e0b'}
                    />
                  </div>

                  {/* Progress bar */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs" style={{ color: 'var(--text-3)' }}>
                      <span>Completion</span>
                      <span className="font-semibold" style={{ color: myAchieved ? '#10b981' : '#a78bfa' }}>
                        {Math.round(myCompPct)}%
                      </span>
                    </div>
                    <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      {/* Scheduled track */}
                      <div
                        className="absolute left-0 top-0 h-full rounded-full"
                        style={{ width: `${mySchedPct}%`, background: 'rgba(59,130,246,0.35)', transition: 'width 0.8s ease' }}
                      />
                      {/* Completed fill */}
                      <div
                        className="absolute left-0 top-0 h-full rounded-full"
                        style={{
                          width: `${myCompPct}%`,
                          background: myAchieved
                            ? 'linear-gradient(90deg,#10b981,#059669)'
                            : 'linear-gradient(90deg,#7c3aed,#3b82f6)',
                          boxShadow: '0 0 8px rgba(124,58,237,0.4)',
                          transition: 'width 0.8s ease',
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs" style={{ color: 'var(--text-3)' }}>
                      <span>{myCompleted} completed</span>
                      <span>{myScheduled} scheduled</span>
                    </div>
                  </div>

                  {/* Motivational text */}
                  {!myAchieved && myTarget > 0 && (
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {myRemaining === 0
                        ? 'You\'ve hit your target!'
                        : myCompPct >= 75
                        ? `Almost there! Just ${myRemaining} more meeting${myRemaining !== 1 ? 's' : ''} to go.`
                        : myCompPct >= 50
                        ? `Halfway there! Keep up the great work — ${myRemaining} remaining.`
                        : `You're getting started! ${myRemaining} meeting${myRemaining !== 1 ? 's' : ''} remaining.`
                      }
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

        {/* ════════════════════════════════════════════════════════
            TEAM REPORT SECTION
            ════════════════════════════════════════════════════ */}
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold flex items-center gap-2.5" style={{ color: 'var(--text)' }}>
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#7c3aed)' }}
            >
              <IconBarChart />
            </span>
            Team Overview
            <span className="text-sm font-normal ml-1" style={{ color: 'var(--text-3)' }}>— {formatMonth(selectedMonth)}</span>
          </h2>

          {teamLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            </div>
          ) : teamRecords.length === 0 ? (
            <div
              className="animate-fade-in flex flex-col items-center gap-3 py-12 rounded-2xl"
              style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}
            >
              <div className="text-violet-400"><IconBarChart /></div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>
                No team data for {formatMonth(selectedMonth)}
              </p>
            </div>
          ) : (
            <>
              {/* Team totals */}
              <div
                className="animate-fade-in rounded-2xl p-4"
                style={{
                  background: 'linear-gradient(135deg,rgba(59,130,246,0.12),rgba(124,58,237,0.1))',
                  border: '1px solid rgba(59,130,246,0.2)',
                }}
              >
                <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-3)' }}>
                  TEAM TOTALS — {teamRecords.length} MEMBER{teamRecords.length !== 1 ? 'S' : ''}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <StatChip label="Completed" value={teamCompleted} color="#7c3aed" />
                  <StatChip label="Scheduled" value={teamScheduled} color="#3b82f6" />
                  <StatChip label="Target" value={teamTarget} color="#f59e0b" />
                </div>
              </div>

              {/* Per-member bars */}
              <div className="flex flex-col gap-2">
                {teamRecords.map(rec => (
                  <TeamBarRow
                    key={rec.id}
                    rec={rec}
                    maxTarget={maxTarget}
                    isOwn={rec.employeeUid === user?.uid}
                  />
                ))}
              </div>

              {/* Legend */}
              <div
                className="flex flex-wrap items-center gap-4 px-4 py-2.5 rounded-xl text-xs"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-s)', color: 'var(--text-3)' }}
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#7c3aed,#3b82f6)' }} />
                  <span>Your bar</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-2 rounded-full" style={{ background: 'rgba(148,163,184,0.5)' }} />
                  <span>Others</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-2 rounded-full" style={{ background: 'rgba(59,130,246,0.35)' }} />
                  <span>Scheduled</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-px h-4 rounded-full" style={{ background: 'rgba(255,255,255,0.65)' }} />
                  <span>Target</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#10b981,#059669)' }} />
                  <span style={{ color: '#10b981' }}>Achieved</span>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
