import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';

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

const GRAD_COLORS = [
  ['#7c3aed', '#3b82f6'],
  ['#ec4899', '#f97316'],
  ['#10b981', '#3b82f6'],
  ['#f59e0b', '#ef4444'],
  ['#6366f1', '#8b5cf6'],
];

/* Animated donut ring */
function DonutRing({ pct = 0, size = 160, strokeW = 16, color1 = '#7c3aed', color2 = '#3b82f6', label, sublabel, glow = true }) {
  const R = (size - strokeW * 2) / 2;
  const CX = size / 2, CY = size / 2;
  const CIRC = 2 * Math.PI * R;
  const uid = `${color1.replace('#', '')}-${size}`;
  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`g-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color1} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
      </defs>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={strokeW} />
      {pct > 0 && (
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={`url(#g-${uid})`} strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={`${CIRC * Math.min(pct, 1)} ${CIRC}`}
          transform={`rotate(-90 ${CX} ${CY})`}
          style={{
            transition: 'stroke-dasharray 1s ease',
            filter: glow ? `drop-shadow(0 0 8px ${color1}90)` : undefined
          }} />
      )}
      {label !== undefined && (
        <>
          <text x={CX} y={CY - 6} textAnchor="middle" fill="white" fontSize={size > 120 ? 24 : 14} fontWeight="800">{label}</text>
          {sublabel && <text x={CX} y={CY + (size > 120 ? 16 : 10)} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={size > 120 ? 13 : 9}>{sublabel}</text>}
        </>
      )}
    </svg>
  );
}

/* Horizontal progress bar */
function HBar({ pct = 0, color1, color2, height = 8 }) {
  const uid = `hb-${color1.replace('#', '')}`;
  return (
    <svg width="100%" height={height} style={{ overflow: 'hidden', borderRadius: 99 }}>
      <defs>
        <linearGradient id={uid} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color1} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width="100%" height={height} rx={height / 2} fill="rgba(255,255,255,0.06)" />
      <rect x={0} y={0} width={`${Math.min(pct * 100, 100)}%`} height={height} rx={height / 2}
        fill={`url(#${uid})`} style={{ transition: 'width 1s ease' }} />
    </svg>
  );
}

/* Sparkline mini chart for personal monthly trend */
function Sparkline({ data, color1 = '#7c3aed', color2 = '#3b82f6', height = 60 }) {
  if (!data || data.length < 2) return null;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const W = 280, H = height;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (d.value / maxVal) * (H - 10) - 5;
    return `${x},${y}`;
  });
  const uid = `spark-${color1.replace('#', '')}`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={uid} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color1} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
        <linearGradient id={`${uid}-fill`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color1} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color1} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts.join(' ')} fill="none" stroke={`url(#${uid})`} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`0,${H} ${pts.join(' ')} ${W},${H}`} fill={`url(#${uid}-fill)`} />
      {data.map((d, i) => {
        const x = (i / (data.length - 1)) * W;
        const y = H - (d.value / maxVal) * (H - 10) - 5;
        return <circle key={i} cx={x} cy={y} r={3} fill={color1} />;
      })}
    </svg>
  );
}

export default function MeetingReportEmployee({ user, employeeData }) {
  const [month, setMonth] = useState(currentMonthIST());
  const [myData, setMyData] = useState(null);
  const [teamRecords, setTeamRecords] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const months = getRecentMonths(6);
  const uid = user?.uid;

  /* My data for selected month */
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, 'meetings', `${uid}_${month}`), snap => {
      setMyData(snap.exists() ? snap.data() : null);
    });
  }, [uid, month]);

  /* Team data for selected month */
  useEffect(() => {
    const q = query(collection(db, 'meetings'), where('month', '==', month));
    return onSnapshot(q, snap => {
      setTeamRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [month]);

  /* Historical personal data for sparkline */
  useEffect(() => {
    if (!uid) return;
    const allMonths = getRecentMonths(6);
    const unsubs = [];
    const results = {};
    allMonths.forEach(m => {
      const unsub = onSnapshot(doc(db, 'meetings', `${uid}_${m}`), snap => {
        results[m] = snap.exists() ? snap.data().completed || 0 : 0;
        const sorted = allMonths.slice().reverse().map(mo => ({ month: mo, value: results[mo] || 0 }));
        setHistoryData(sorted);
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach(u => u());
  }, [uid]);

  const target = myData?.target || 0;
  const completed = myData?.completed || 0;
  const scheduled = myData?.scheduled || 0;
  const remaining = Math.max(0, target - completed);
  const completedPct = target > 0 ? completed / target : 0;
  const scheduledPct = target > 0 ? scheduled / target : 0;

  const teamTotal = teamRecords.reduce((s, r) => s + (r.completed || 0), 0);
  const teamScheduled = teamRecords.reduce((s, r) => s + (r.scheduled || 0), 0);
  const teamTarget = teamRecords.reduce((s, r) => s + (r.target || 0), 0);
  const teamPct = teamTarget > 0 ? teamTotal / teamTarget : 0;

  const myRank = teamRecords
    .slice()
    .sort((a, b) => (b.completed || 0) - (a.completed || 0))
    .findIndex(r => r.employeeUid === uid) + 1;

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Meeting Report</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Your progress and team overview</p>
        </div>
        <select value={month} onChange={e => setMonth(e.target.value)} className="input-field w-auto">
          {months.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
        </select>
      </div>

      {/* ─── MY PERSONAL REPORT ─── */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="px-5 py-3 font-bold text-sm tracking-widest uppercase"
          style={{ background: 'linear-gradient(90deg,#7c3aed20,transparent)', color: '#7c3aed', borderBottom: '1px solid var(--border)' }}>
          My Report — {formatMonth(month)}
        </div>
        {!myData ? (
          <div className="p-10 text-center" style={{ background: 'var(--surface)' }}>
            <div className="text-4xl mb-3">🎯</div>
            <div className="font-semibold" style={{ color: 'var(--text)' }}>No target assigned yet</div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Your manager will assign a target soon</div>
          </div>
        ) : (
          <div className="p-5 space-y-5" style={{ background: 'var(--surface)' }}>
            {/* Large donut + stats */}
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative flex-shrink-0">
                <DonutRing pct={completedPct} size={180} strokeW={18} color1="#7c3aed" color2="#3b82f6"
                  label={completed} sublabel={`of ${target} target`} />
                {myRank > 0 && (
                  <div className="absolute -top-2 -right-2 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: myRank === 1 ? '#f59e0b' : myRank <= 3 ? '#6366f1' : '#374151' }}>
                    #{myRank}
                  </div>
                )}
              </div>
              <div className="flex-1 w-full space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Target', value: target, color: '#3b82f6' },
                    { label: 'Completed', value: completed, color: '#7c3aed' },
                    { label: 'Scheduled', value: scheduled, color: '#ec4899' },
                    { label: 'Remaining', value: remaining, color: remaining > 0 ? '#f59e0b' : '#10b981' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-3 text-center"
                      style={{ background: 'var(--surface-s)', border: '1px solid var(--border)' }}>
                      <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-2)' }}>
                      <span>Completion</span><span>{Math.round(completedPct * 100)}%</span>
                    </div>
                    <HBar pct={completedPct} color1="#7c3aed" color2="#3b82f6" height={10} />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-2)' }}>
                      <span>Scheduled</span><span>{Math.round(scheduledPct * 100)}%</span>
                    </div>
                    <HBar pct={scheduledPct} color1="#ec4899" color2="#f97316" height={10} />
                  </div>
                </div>
                {myData.comment && (
                  <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--surface-s)', border: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-3)' }}>Manager: </span>
                    <span style={{ color: 'var(--text)' }}>{myData.comment}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 6-month sparkline */}
            {historyData.some(d => d.value > 0) && (
              <div className="rounded-xl p-4" style={{ background: 'var(--surface-s)', border: '1px solid var(--border)' }}>
                <div className="text-xs font-semibold mb-3" style={{ color: 'var(--text-3)' }}>6-MONTH TREND (COMPLETED)</div>
                <Sparkline data={historyData} color1="#7c3aed" color2="#3b82f6" height={56} />
                <div className="flex justify-between mt-2">
                  {historyData.map(d => (
                    <div key={d.month} className="text-center">
                      <div className="text-xs font-bold" style={{ color: 'var(--text)' }}>{d.value}</div>
                      <div className="text-xs" style={{ color: 'var(--text-3)' }}>{d.month.slice(5)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── TEAM REPORT ─── */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="px-5 py-3 font-bold text-sm tracking-widest uppercase"
          style={{ background: 'linear-gradient(90deg,#3b82f620,transparent)', color: '#3b82f6', borderBottom: '1px solid var(--border)' }}>
          Team Report — {formatMonth(month)}
        </div>
        <div className="p-5 space-y-5" style={{ background: 'var(--surface)' }}>
          {/* Team summary donuts */}
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              <DonutRing pct={teamPct} size={140} strokeW={14} color1="#3b82f6" color2="#6366f1"
                label={`${Math.round(teamPct * 100)}%`} sublabel="team done" />
            </div>
            <div className="flex-1 w-full">
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Team Target', value: teamTarget, c: '#3b82f6' },
                  { label: 'Completed', value: teamTotal, c: '#7c3aed' },
                  { label: 'Scheduled', value: teamScheduled, c: '#ec4899' },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-3 text-center"
                    style={{ background: 'var(--surface-s)', border: '1px solid var(--border)' }}>
                    <div className="text-xl font-bold" style={{ color: s.c }}>{s.value}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <div>
                  <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-2)' }}>
                    <span>Team Completion</span><span>{Math.round(teamPct * 100)}%</span>
                  </div>
                  <HBar pct={teamPct} color1="#3b82f6" color2="#6366f1" height={10} />
                </div>
              </div>
            </div>
          </div>

          {/* Team leaderboard */}
          {teamRecords.length === 0 ? (
            <div className="text-center py-6" style={{ color: 'var(--text-3)' }}>No team data available</div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>Team Leaderboard</div>
              {teamRecords
                .slice()
                .sort((a, b) => (b.completed || 0) - (a.completed || 0))
                .map((r, idx) => {
                  const colors = GRAD_COLORS[idx % GRAD_COLORS.length];
                  const pct = r.target > 0 ? (r.completed || 0) / r.target : 0;
                  const isMe = r.employeeUid === uid;
                  return (
                    <div key={r.id}
                      className="rounded-xl p-3 transition-all"
                      style={{
                        background: isMe ? 'linear-gradient(135deg,#7c3aed15,#3b82f615)' : 'var(--surface-s)',
                        border: isMe ? '1px solid #7c3aed50' : '1px solid var(--border)',
                      }}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="text-sm font-bold w-6 text-center flex-shrink-0"
                          style={{ color: idx === 0 ? '#f59e0b' : idx === 1 ? '#9ca3af' : idx === 2 ? '#92400e' : 'var(--text-3)' }}>
                          #{idx + 1}
                        </div>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: `linear-gradient(135deg,${colors[0]},${colors[1]})` }}>
                          {getInitials(r.employeeName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate flex items-center gap-2" style={{ color: 'var(--text)' }}>
                            {r.employeeName || r.employeeId}
                            {isMe && <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#7c3aed30', color: '#a78bfa' }}>You</span>}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--text-3)' }}>Target: {r.target || 0}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold" style={{ color: colors[0] }}>{r.completed || 0}</div>
                          <div className="text-xs" style={{ color: 'var(--text-3)' }}>{r.scheduled || 0} sched</div>
                        </div>
                      </div>
                      <HBar pct={pct} color1={colors[0]} color2={colors[1]} height={5} />
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
