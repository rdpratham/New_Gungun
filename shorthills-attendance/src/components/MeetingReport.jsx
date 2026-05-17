import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';

/* ── Helpers ──────────────────────────────────────────────────────── */
function currentMonthIST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).slice(0, 7);
}
function formatMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
function formatMonthShort(m) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
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
function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

const PALETTE = [
  { c1: '#7c3aed', c2: '#3b82f6' },
  { c1: '#ec4899', c2: '#f97316' },
  { c1: '#10b981', c2: '#06b6d4' },
  { c1: '#f59e0b', c2: '#ef4444' },
  { c1: '#6366f1', c2: '#8b5cf6' },
  { c1: '#14b8a6', c2: '#3b82f6' },
];

/* ── Animated counter ─────────────────────────────────────────────── */
function AnimatedNumber({ value, duration = 1000 }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const from = display;
    const run = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (value - from) * ease));
      if (p < 1) raf.current = requestAnimationFrame(run);
    };
    raf.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);
  return display;
}

/* ── Radial gauge (like a speedometer) ───────────────────────────── */
function RadialGauge({ pct = 0, size = 160, color1 = '#7c3aed', color2 = '#3b82f6', value, label, sublabel }) {
  const R = size * 0.36, CX = size / 2, CY = size * 0.58;
  const startAngle = -210, sweepMax = 240;
  const sweep = clamp(pct, 0, 1) * sweepMax;
  const toRad = d => (d * Math.PI) / 180;
  const arc = (angle, r) => ({ x: CX + r * Math.cos(toRad(angle)), y: CY + r * Math.sin(toRad(angle)) });
  const largeArc = (sweep) => sweep > 180 ? 1 : 0;
  const trackStart = arc(startAngle, R);
  const trackEnd = arc(startAngle + sweepMax, R);
  const progEnd = arc(startAngle + sweep, R);
  const id = `rg-${size}-${color1.replace('#', '')}`;
  return (
    <svg width={size} height={size * 0.75} viewBox={`0 0 ${size} ${size * 0.75}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color1} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
        <filter id={`${id}-glow`}>
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* Track */}
      <path d={`M ${trackStart.x} ${trackStart.y} A ${R} ${R} 0 ${largeArc(sweepMax)} 1 ${trackEnd.x} ${trackEnd.y}`}
        fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={size * 0.075} strokeLinecap="round" />
      {/* Progress */}
      {sweep > 0 && (
        <path d={`M ${trackStart.x} ${trackStart.y} A ${R} ${R} 0 ${largeArc(sweep)} 1 ${progEnd.x} ${progEnd.y}`}
          fill="none" stroke={`url(#${id})`} strokeWidth={size * 0.075} strokeLinecap="round"
          filter={`url(#${id}-glow)`}
          style={{ transition: 'all 1s cubic-bezier(0.34,1.56,0.64,1)' }} />
      )}
      {/* Needle dot */}
      {sweep > 0 && <circle cx={progEnd.x} cy={progEnd.y} r={size * 0.04} fill={color2}
        style={{ filter: `drop-shadow(0 0 6px ${color2})`, transition: 'all 1s cubic-bezier(0.34,1.56,0.64,1)' }} />}
      {/* Center text */}
      {value !== undefined && (
        <text x={CX} y={CY - R * 0.1} textAnchor="middle" fill="white"
          fontSize={size * 0.22} fontWeight="900" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</text>
      )}
      {label && <text x={CX} y={CY + R * 0.35} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize={size * 0.1}>{label}</text>}
      {sublabel && <text x={CX} y={CY + R * 0.65} textAnchor="middle" fill={color2} fontSize={size * 0.11} fontWeight="700">{sublabel}</text>}
    </svg>
  );
}

/* ── Vertical bar chart (Power BI style) ─────────────────────────── */
function VerticalBarChart({ records, month }) {
  const W = 600, H = 220, PAD = { t: 20, r: 20, b: 50, l: 40 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  if (!records.length) return null;
  const maxVal = Math.max(...records.flatMap(r => [r.completed || 0, r.scheduled || 0, r.target || 0]), 1);
  const barGroupW = innerW / records.length;
  const barW = Math.min(barGroupW * 0.25, 28);
  const gap = barW * 0.5;
  const yScale = v => innerH - (v / maxVal) * innerH;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(f * maxVal));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
      <defs>
        {records.map((_, i) => {
          const p = PALETTE[i % PALETTE.length];
          return (
            <linearGradient key={i} id={`vb-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={p.c1} stopOpacity="1" />
              <stop offset="100%" stopColor={p.c2} stopOpacity="0.7" />
            </linearGradient>
          );
        })}
        <linearGradient id="vb-sched" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(59,130,246,0.6)" />
          <stop offset="100%" stopColor="rgba(59,130,246,0.2)" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {yTicks.map((t, i) => {
        const y = PAD.t + yScale(t);
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth={1} strokeDasharray="4 4" />
            <text x={PAD.l - 6} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize={9}>{t}</text>
          </g>
        );
      })}
      {/* Bars */}
      {records.map((r, i) => {
        const cx = PAD.l + i * barGroupW + barGroupW / 2;
        const compH = (r.completed || 0) / maxVal * innerH;
        const schedH = (r.scheduled || 0) / maxVal * innerH;
        const tgtH = (r.target || 0) / maxVal * innerH;
        return (
          <g key={r.id}>
            {/* Target line marker */}
            <line x1={cx - barW - gap - 4} x2={cx + barW * 2 + gap + 4}
              y1={PAD.t + yScale(r.target || 0)} y2={PAD.t + yScale(r.target || 0)}
              stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} strokeDasharray="4 2" />
            {/* Scheduled bar */}
            <rect x={cx - barW - gap / 2} y={PAD.t + innerH - schedH} width={barW} height={schedH}
              rx={3} fill="url(#vb-sched)"
              style={{ transition: 'height 1s ease, y 1s ease' }} />
            {/* Completed bar */}
            <rect x={cx + gap / 2} y={PAD.t + innerH - compH} width={barW} height={compH}
              rx={3} fill={`url(#vb-${i})`}
              style={{ transition: 'height 1s ease, y 1s ease', filter: `drop-shadow(0 0 4px ${PALETTE[i % PALETTE.length].c1}80)` }} />
            {/* Values on top */}
            {compH > 12 && <text x={cx + gap / 2 + barW / 2} y={PAD.t + innerH - compH - 4}
              textAnchor="middle" fill="white" fontSize={9} fontWeight="700">{r.completed || 0}</text>}
            {/* Name label */}
            <text x={cx} y={H - PAD.b + 14} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={9} fontWeight="600">
              {(r.employeeName || r.employeeId || '?').split(' ')[0]}
            </text>
            <text x={cx} y={H - PAD.b + 26} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={7.5}>
              ID: {r.employeeId || '—'}
            </text>
          </g>
        );
      })}
      {/* Axes */}
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + innerH} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
      <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + innerH} y2={PAD.t + innerH} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
    </svg>
  );
}

/* ── Multi-line trend chart (month-wise per employee) ─────────────── */
function TrendChart({ trendData, employees }) {
  const W = 600, H = 200, PAD = { t: 20, r: 20, b: 40, l: 40 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const months = getRecentMonths(6).reverse();
  if (!employees.length) return null;
  const allVals = employees.flatMap(emp =>
    months.map(m => trendData[emp.id]?.[m] || 0)
  );
  const maxVal = Math.max(...allVals, 1);
  const xOf = i => PAD.l + (i / (months.length - 1)) * innerW;
  const yOf = v => PAD.t + innerH - (v / maxVal) * innerH;
  const yTicks = [0, 0.5, 1].map(f => Math.round(f * maxVal));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
      <defs>
        {employees.map((emp, i) => {
          const p = PALETTE[i % PALETTE.length];
          return (
            <linearGradient key={i} id={`tl-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={p.c1} />
              <stop offset="100%" stopColor={p.c2} />
            </linearGradient>
          );
        })}
      </defs>
      {/* Grid */}
      {yTicks.map((t, i) => {
        const y = yOf(t);
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth={1} strokeDasharray="4 4" />
            <text x={PAD.l - 6} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize={9}>{t}</text>
          </g>
        );
      })}
      {/* Lines */}
      {employees.map((emp, i) => {
        const pts = months.map((m, mi) => ({ x: xOf(mi), y: yOf(trendData[emp.id]?.[m] || 0) }));
        const d = pts.map((p, pi) => `${pi === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        const fillPts = [
          `M ${pts[0].x} ${PAD.t + innerH}`,
          ...pts.map(p => `L ${p.x} ${p.y}`),
          `L ${pts[pts.length - 1].x} ${PAD.t + innerH}`, 'Z'
        ].join(' ');
        const p = PALETTE[i % PALETTE.length];
        const gid = `ta-${i}`;
        return (
          <g key={emp.id}>
            <defs>
              <linearGradient id={gid} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={p.c1} stopOpacity="0.25" />
                <stop offset="100%" stopColor={p.c1} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={fillPts} fill={`url(#${gid})`} />
            <path d={d} fill="none" stroke={`url(#tl-${i})`} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((pt, mi) => (
              <circle key={mi} cx={pt.x} cy={pt.y} r={3.5} fill={p.c1}
                style={{ filter: `drop-shadow(0 0 4px ${p.c1})` }} />
            ))}
          </g>
        );
      })}
      {/* X-axis labels */}
      {months.map((m, i) => (
        <text key={m} x={xOf(i)} y={H - PAD.b + 14} textAnchor="middle"
          fill="rgba(255,255,255,0.45)" fontSize={9}>{formatMonthShort(m)}</text>
      ))}
      {/* Axes */}
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + innerH} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
      <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + innerH} y2={PAD.t + innerH} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
    </svg>
  );
}

/* ── Full Employee Report Page ────────────────────────────────────── */
function EmployeeReportPage({ emp, allRecords, onBack }) {
  const months6 = getRecentMonths(6).reverse();   // oldest → newest
  const uid = emp?.employeeUid;

  /* Real-time listener for ALL 6 months of this employee's data */
  const [monthDocs, setMonthDocs] = useState({});   // month → doc data
  useEffect(() => {
    if (!uid) return;
    const unsubs = months6.map(m => {
      return onSnapshot(doc(db, 'meetings', `${uid}_${m}`), snap => {
        setMonthDocs(prev => ({ ...prev, [m]: snap.exists() ? snap.data() : null }));
      });
    });
    return () => unsubs.forEach(u => u());
  }, [uid]);

  const currentMonth = currentMonthIST();
  const cur = monthDocs[currentMonth] || emp;   // use emp as fallback for current month

  const target    = cur?.target    || 0;
  const completed = cur?.completed || 0;
  const scheduled = cur?.scheduled || 0;
  const remaining = Math.max(0, target - completed);
  const pct       = target > 0 ? clamp(completed / target, 0, 1) : 0;

  /* All-time totals across 6 months */
  const allTimeCompleted = months6.reduce((s, m) => s + (monthDocs[m]?.completed || 0), 0);
  const allTimeTarget    = months6.reduce((s, m) => s + (monthDocs[m]?.target    || 0), 0);
  const allTimePct       = allTimeTarget > 0 ? clamp(allTimeCompleted / allTimeTarget, 0, 1) : 0;

  /* Team rank for current month */
  const sorted = [...allRecords].sort((a, b) => (b.completed || 0) - (a.completed || 0));
  const rank   = sorted.findIndex(r => r.employeeUid === uid) + 1;

  /* Bar data for trend chart */
  const maxBarVal = Math.max(...months6.map(m => monthDocs[m]?.completed || 0), 1);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Back button + header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
          style={{ background: 'var(--surface-s)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>
        <div className="text-xs px-2 py-1 rounded-lg font-semibold"
          style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
          Individual Report
        </div>
      </div>

      {/* Hero banner */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}>
        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Avatar + info */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black text-white flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
                {getInitials(emp?.employeeName)}
              </div>
              <div>
                <div className="text-2xl font-black text-white">{emp?.employeeName || '—'}</div>
                <div className="text-blue-200 text-sm mt-0.5">Employee ID: {emp?.employeeId || '—'}</div>
                {rank > 0 && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                    style={{ background: rank === 1 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.15)', color: rank === 1 ? '#fcd34d' : 'white' }}>
                    {rank === 1 ? '🏆' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '📊'} Rank #{rank} in Team
                  </div>
                )}
              </div>
            </div>
            {/* 3 quick stats */}
            <div className="flex gap-4 md:ml-auto">
              {[
                { label: 'This Month Target', value: target },
                { label: '6-Month Completed', value: allTimeCompleted },
                { label: '6-Month Target', value: allTimeTarget },
              ].map(s => (
                <div key={s.label} className="text-center rounded-xl px-4 py-3"
                  style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                  <div className="text-3xl font-black text-white"><AnimatedNumber value={s.value} /></div>
                  <div className="text-xs text-white/60 mt-0.5 whitespace-nowrap">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Current month gauges + stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Radial gauge */}
        <div className="rounded-2xl p-6 flex flex-col items-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-sm font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>
            {formatMonth(currentMonth)} Progress
          </div>
          <RadialGauge pct={pct} size={220} value={`${Math.round(pct * 100)}%`}
            label="completion" sublabel={`${completed} of ${target} meetings`} />
          {cur?.comment && (
            <div className="mt-3 w-full rounded-xl px-4 py-3 text-sm text-center"
              style={{ background: 'var(--surface-s)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              <span style={{ color: 'var(--text-3)' }}>Note: </span>{cur.comment}
            </div>
          )}
        </div>

        {/* 4 stat cards + progress bars */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Target',    value: target,    color: '#3b82f6', icon: '🎯' },
              { label: 'Completed', value: completed, color: '#7c3aed', icon: '✅' },
              { label: 'Scheduled', value: scheduled, color: '#ec4899', icon: '📅' },
              { label: 'Remaining', value: remaining, color: remaining > 0 ? '#f59e0b' : '#10b981', icon: remaining > 0 ? '⏳' : '🏆' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-4 text-center relative overflow-hidden"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="absolute inset-0 opacity-10"
                  style={{ background: `radial-gradient(circle at 80% 20%,${s.color},transparent 70%)` }} />
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-3xl font-black tabular-nums" style={{ color: s.color }}>
                  <AnimatedNumber value={s.value} />
                </div>
                <div className="text-xs mt-1 font-semibold" style={{ color: 'var(--text-3)' }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Dual progress bars */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {[
              { label: 'Completion Rate', pct, c1: '#7c3aed', c2: '#3b82f6', val: `${completed}/${target}` },
              { label: 'Scheduled Rate', pct: target > 0 ? clamp(scheduled / target, 0, 1) : 0, c1: '#ec4899', c2: '#f97316', val: `${scheduled}/${target}` },
              { label: '6-Month Overall', pct: allTimePct, c1: '#10b981', c2: '#06b6d4', val: `${allTimeCompleted}/${allTimeTarget}` },
            ].map(b => (
              <div key={b.label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{b.label}</span>
                  <span style={{ color: b.c1, fontWeight: 700 }}>{b.val} ({Math.round(b.pct * 100)}%)</span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-s)' }}>
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${b.pct * 100}%`, background: `linear-gradient(90deg,${b.c1},${b.c2})`, boxShadow: `0 0 8px ${b.c1}60` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6-month bar trend chart */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="font-bold" style={{ color: 'var(--text)' }}>6-Month Meeting History</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Completed vs Target per month</div>
          </div>
          <div className="flex gap-3">
            {[{ label: 'Completed', c: '#7c3aed' }, { label: 'Scheduled', c: '#ec4899' }, { label: 'Target', c: 'rgba(255,255,255,0.2)' }].map(l => (
              <div key={l.label} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-3)' }}>
                <div className="w-2 h-2 rounded-full" style={{ background: l.c }} />
                {l.label}
              </div>
            ))}
          </div>
        </div>
        {/* SVG bar chart */}
        <svg viewBox="0 0 600 180" width="100%" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="emp-comp" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.7" />
            </linearGradient>
            <linearGradient id="emp-sched" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ec4899" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          {(() => {
            const W = 600, H = 180, PL = 36, PR = 16, PT = 12, PB = 44;
            const iW = W - PL - PR, iH = H - PT - PB;
            const n = months6.length;
            const gW = iW / n;
            const bW = Math.min(gW * 0.28, 22);
            const gap = bW * 0.4;
            const maxV = Math.max(...months6.flatMap(m => [
              monthDocs[m]?.completed || 0,
              monthDocs[m]?.scheduled || 0,
              monthDocs[m]?.target    || 0,
            ]), 1);
            const yS = v => iH - clamp(v / maxV, 0, 1) * iH;
            const ticks = [0, 0.5, 1].map(f => Math.round(f * maxV));
            return (
              <>
                {ticks.map((t, i) => {
                  const y = PT + yS(t);
                  return (
                    <g key={i}>
                      <line x1={PL} x2={W - PR} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth={1} strokeDasharray="4 4" />
                      <text x={PL - 5} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize={9}>{t}</text>
                    </g>
                  );
                })}
                {months6.map((m, i) => {
                  const cx   = PL + i * gW + gW / 2;
                  const cD   = monthDocs[m];
                  const comp = cD?.completed || 0;
                  const sched= cD?.scheduled || 0;
                  const tgt  = cD?.target    || 0;
                  const compH  = yS(comp);
                  const schedH = yS(sched);
                  const isCur  = m === currentMonth;
                  return (
                    <g key={m}>
                      {/* Current month highlight */}
                      {isCur && <rect x={cx - gW / 2 + 2} y={PT} width={gW - 4} height={iH} rx={4} fill="rgba(124,58,237,0.06)" />}
                      {/* Target dashed line */}
                      {tgt > 0 && <line x1={cx - bW - gap - 4} x2={cx + bW * 2 + gap + 4}
                        y1={PT + yS(tgt)} y2={PT + yS(tgt)}
                        stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} strokeDasharray="4 2" />}
                      {/* Scheduled bar */}
                      <rect x={cx - bW - gap / 2} y={PT + schedH} width={bW} height={iH - schedH}
                        rx={3} fill="url(#emp-sched)"
                        style={{ transition: 'all 1s ease' }} />
                      {/* Completed bar */}
                      <rect x={cx + gap / 2} y={PT + compH} width={bW} height={iH - compH}
                        rx={3} fill="url(#emp-comp)"
                        style={{ transition: 'all 1s ease', filter: comp > 0 ? 'drop-shadow(0 0 5px #7c3aed80)' : 'none' }} />
                      {/* Value label */}
                      {comp > 0 && <text x={cx + gap / 2 + bW / 2} y={PT + compH - 4}
                        textAnchor="middle" fill="white" fontSize={9} fontWeight="700">{comp}</text>}
                      {/* Month label */}
                      <text x={cx} y={H - PB + 14} textAnchor="middle" fill={isCur ? '#a78bfa' : 'rgba(255,255,255,0.5)'} fontSize={9} fontWeight={isCur ? 700 : 400}>
                        {formatMonthShort(m)}
                      </text>
                      {isCur && <text x={cx} y={H - PB + 25} textAnchor="middle" fill="#a78bfa" fontSize={7} fontWeight="600">Current</text>}
                    </g>
                  );
                })}
                <line x1={PL} x2={PL} y1={PT} y2={PT + iH} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
                <line x1={PL} x2={W - PR} y1={PT + iH} y2={PT + iH} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
              </>
            );
          })()}
        </svg>
      </div>

      {/* Month-by-month data table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-4 font-bold" style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
          Month-wise Breakdown
        </div>
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-s)' }}>
                {['Month', 'Target', 'Completed', 'Scheduled', 'Remaining', 'Achievement'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Month' ? 'left' : 'center', color: 'var(--text-3)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months6.slice().reverse().map((m, i) => {
                const d = monthDocs[m];
                const tgt  = d?.target    || 0;
                const comp = d?.completed || 0;
                const sched= d?.scheduled || 0;
                const rem  = Math.max(0, tgt - comp);
                const achPct = tgt > 0 ? clamp(comp / tgt, 0, 1) : 0;
                const isCur = m === currentMonth;
                return (
                  <tr key={m} style={{ borderBottom: '1px solid var(--border)', background: isCur ? 'rgba(124,58,237,0.05)' : 'transparent' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: isCur ? '#a78bfa' : 'var(--text)', whiteSpace: 'nowrap' }}>
                      {formatMonth(m)} {isCur && <span style={{ fontSize: 10, background: 'rgba(124,58,237,0.2)', color: '#a78bfa', borderRadius: 99, padding: '1px 6px', marginLeft: 4 }}>Current</span>}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: '#3b82f6', fontWeight: tgt > 0 ? 700 : 400 }}>{tgt || '—'}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: comp > 0 ? '#7c3aed' : 'var(--text-3)', fontWeight: comp > 0 ? 700 : 400 }}>{comp || '—'}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: sched > 0 ? '#ec4899' : 'var(--text-3)', fontWeight: sched > 0 ? 700 : 400 }}>{sched || '—'}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: rem > 0 ? '#f59e0b' : (tgt > 0 ? '#10b981' : 'var(--text-3)'), fontWeight: 600 }}>
                      {tgt > 0 ? (rem === 0 ? '✓ Done' : rem) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {tgt > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                          <div style={{ flex: 1, maxWidth: 80, height: 6, borderRadius: 99, background: 'var(--surface-s)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${achPct * 100}%`, background: 'linear-gradient(90deg,#7c3aed,#3b82f6)', borderRadius: 99, transition: 'width 1s ease' }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: achPct >= 1 ? '#10b981' : achPct >= 0.7 ? '#a78bfa' : '#f59e0b', minWidth: 32 }}>
                            {Math.round(achPct * 100)}%
                          </span>
                        </div>
                      ) : <span style={{ color: 'var(--text-3)', fontSize: 11 }}>No target</span>}
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr style={{ background: 'rgba(124,58,237,0.08)', borderTop: '2px solid rgba(124,58,237,0.2)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 800, color: '#a78bfa' }}>Total (6 months)</td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, color: '#3b82f6' }}>{allTimeTarget || '—'}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, color: '#7c3aed' }}>{allTimeCompleted || '—'}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, color: '#ec4899' }}>
                  {months6.reduce((s, m) => s + (monthDocs[m]?.scheduled || 0), 0) || '—'}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, color: allTimePct >= 1 ? '#10b981' : '#f59e0b' }}>
                  {Math.max(0, allTimeTarget - allTimeCompleted) || (allTimeTarget > 0 ? '✓' : '—')}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, color: allTimePct >= 1 ? '#10b981' : '#a78bfa' }}>
                  {allTimeTarget > 0 ? `${Math.round(allTimePct * 100)}%` : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Employee detail modal (quick peek) ──────────────────────────── */
function EmployeeModal({ emp, trendData, onClose }) {
  if (!emp) return null;
  const months = getRecentMonths(6).reverse();
  const target = emp.target || 0;
  const completed = emp.completed || 0;
  const scheduled = emp.scheduled || 0;
  const remaining = Math.max(0, target - completed);
  const pct = target > 0 ? clamp(completed / target, 0, 1) : 0;
  const empTrend = trendData[emp.employeeUid] || {};
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(4,8,15,0.92)', backdropFilter: 'blur(20px)' }}
      onClick={onClose}>
      <div className="w-full max-w-xl animate-slide-up" onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {/* Header */}
        <div className="p-6" style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                style={{ background: 'rgba(255,255,255,0.2)' }}>
                {getInitials(emp.employeeName)}
              </div>
              <div>
                <div className="text-white font-bold text-lg">{emp.employeeName || 'Employee'}</div>
                <div className="text-blue-200 text-sm">{formatMonth(emp.month)} · ID: {emp.employeeId || '—'}</div>
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ background: 'rgba(255,255,255,0.1)' }}>✕</button>
          </div>
        </div>
        <div className="p-6 space-y-5">
          {/* Gauge + stats */}
          <div className="flex items-center gap-4">
            <RadialGauge pct={pct} size={140} value={Math.round(pct * 100) + '%'} label="Completion" sublabel={`${completed}/${target}`} />
            <div className="flex-1 grid grid-cols-2 gap-3">
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
          </div>
          {/* 6-month trend for this employee */}
          <div className="rounded-xl p-4" style={{ background: 'var(--surface-s)', border: '1px solid var(--border)' }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>6-Month Completed Trend</div>
            <div className="flex items-end gap-2 h-16">
              {months.map(m => {
                const v = empTrend[m] || 0;
                const maxV = Math.max(...months.map(mo => empTrend[mo] || 0), 1);
                const h = (v / maxV) * 100;
                return (
                  <div key={m} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-xs font-bold" style={{ color: v > 0 ? '#a78bfa' : 'var(--text-3)' }}>{v}</div>
                    <div className="w-full rounded-t-lg transition-all duration-700 relative overflow-hidden" style={{ height: 32 }}>
                      <div className="absolute bottom-0 w-full rounded-t-lg"
                        style={{ height: `${h}%`, background: 'linear-gradient(to top,#7c3aed,#3b82f6)', minHeight: v > 0 ? 4 : 0 }} />
                      <div style={{ height: '100%', background: 'rgba(255,255,255,0.04)', borderRadius: '6px 6px 0 0' }} />
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-3)', fontSize: 8 }}>{formatMonthShort(m)}</div>
                  </div>
                );
              })}
            </div>
          </div>
          {emp.comment && (
            <div className="rounded-xl p-3" style={{ background: 'var(--surface-s)', border: '1px solid var(--border)' }}>
              <span className="text-xs font-bold" style={{ color: 'var(--text-3)' }}>MANAGER NOTE  </span>
              <span className="text-sm" style={{ color: 'var(--text)' }}>{emp.comment}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Dashboard ───────────────────────────────────────────────── */
export default function MeetingReport({ user }) {
  const [selectedMonths, setSelectedMonths] = useState(() => new Set([currentMonthIST()]));
  const [rawRecords, setRawRecords] = useState([]);
  const [trendData, setTrendData] = useState({});   // uid → { month → completed }
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [drillEmp, setDrillEmp] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const months = getRecentMonths(6);
  const allMonths = getRecentMonths(6).reverse();

  const toggleMonth = (m) => setSelectedMonths(prev => {
    const next = new Set(prev);
    if (next.has(m)) { if (next.size > 1) next.delete(m); } else next.add(m);
    return next;
  });

  /* Records for selected months */
  useEffect(() => {
    const arr = [...selectedMonths];
    const q = query(collection(db, 'meetings'), where('month', 'in', arr));
    return onSnapshot(q, snap => {
      setRawRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [[...selectedMonths].sort().join(',')]);

  /* 6-month trend data — one listener per employee */
  useEffect(() => {
    if (!rawRecords.length) return;
    const uids = [...new Set(rawRecords.map(r => r.employeeUid).filter(Boolean))];
    const unsubs = [];
    const acc = {};
    uids.forEach(uid => {
      acc[uid] = {};
      allMonths.forEach(m => {
        const unsub = onSnapshot(doc(db, 'meetings', `${uid}_${m}`), snap => {
          if (!acc[uid]) acc[uid] = {};
          acc[uid][m] = snap.exists() ? (snap.data().completed || 0) : 0;
          setTrendData(prev => ({ ...prev, [uid]: { ...(prev[uid] || {}), [m]: acc[uid][m] } }));
        });
        unsubs.push(unsub);
      });
    });
    return () => unsubs.forEach(u => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawRecords.map(r => r.employeeUid).join(',')]);

  /* Merge raw records by employee (sums across selected months) */
  const records = (() => {
    const merged = {};
    rawRecords.forEach(r => {
      const uid = r.employeeUid || r.id;
      if (!merged[uid]) merged[uid] = { ...r, target: 0, completed: 0, scheduled: 0 };
      merged[uid].target    += r.target    || 0;
      merged[uid].completed += r.completed || 0;
      merged[uid].scheduled += r.scheduled || 0;
    });
    return Object.values(merged);
  })();

  const displayLabel = selectedMonths.size === 1
    ? formatMonth([...selectedMonths][0])
    : `${selectedMonths.size} months`;

  /* Totals */
  const totalTarget    = records.reduce((s, r) => s + (r.target    || 0), 0);
  const totalCompleted = records.reduce((s, r) => s + (r.completed || 0), 0);
  const totalScheduled = records.reduce((s, r) => s + (r.scheduled || 0), 0);
  const totalRemaining = Math.max(0, totalTarget - totalCompleted);
  const teamPct        = totalTarget > 0 ? clamp(totalCompleted / totalTarget, 0, 1) : 0;
  const sorted         = [...records].sort((a, b) => (b.completed || 0) - (a.completed || 0));

  /* Trend data for all employees together (for multi-line chart) */
  const trendEmployees = records.map(r => ({ id: r.employeeUid, name: r.employeeName })).filter(e => e.id);
  const trendByEmpMonth = {};
  trendEmployees.forEach(e => { trendByEmpMonth[e.id] = trendData[e.id] || {}; });

  if (drillEmp) {
    return <EmployeeReportPage emp={drillEmp} allRecords={records} onBack={() => setDrillEmp(null)} />;
  }

  return (
    <div className="space-y-5 animate-fade-in" style={{ minHeight: '100%' }}>

      {/* ── TOP HEADER BAR ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Meeting Report</h1>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
              {records.length} employee{records.length !== 1 ? 's' : ''} · {displayLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {months.map(m => {
              const active = selectedMonths.has(m);
              return (
                <button key={m} onClick={() => toggleMonth(m)}
                  className="px-2.5 py-1 rounded-lg transition-all"
                  style={active
                    ? { background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff', fontSize: 11, fontWeight: 600, border: 'none' }
                    : { background: 'var(--surface-s)', color: 'var(--text-3)', fontSize: 11, fontWeight: 500, border: '1px solid var(--border)' }
                  }>
                  {formatMonthShort(m)}
                </button>
              );
            })}
          </div>
        </div>
        {/* Tab switcher — full width row so all 3 tabs always visible */}
        <div className="flex rounded-xl overflow-hidden" style={{ background: 'var(--surface-s)', border: '1px solid var(--border)', width: '100%' }}>
          {[{ id: 'overview', label: 'Overview' }, { id: 'trend', label: 'Trend' }, { id: 'team', label: 'Team' }].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="flex-1 py-2.5 text-sm font-semibold transition-all"
              style={activeTab === t.id
                ? { background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff' }
                : { color: 'var(--text-2)', background: 'transparent' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI STAT CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Team Target',  value: totalTarget,    c1: '#3b82f6', c2: '#6366f1', icon: '🎯', pct: 1 },
          { label: 'Completed',    value: totalCompleted, c1: '#7c3aed', c2: '#3b82f6', icon: '✅', pct: teamPct },
          { label: 'Scheduled',    value: totalScheduled, c1: '#ec4899', c2: '#f97316', icon: '📅', pct: totalTarget > 0 ? totalScheduled / totalTarget : 0 },
          { label: 'Remaining',    value: totalRemaining, c1: totalRemaining > 0 ? '#f59e0b' : '#10b981', c2: totalRemaining > 0 ? '#ef4444' : '#06b6d4', icon: totalRemaining > 0 ? '⏳' : '🏆', pct: 1 - teamPct },
        ].map((s, i) => {
          const R = 28, CIRC = 2 * Math.PI * R;
          const gid = `kpi-${i}`;
          return (
            <div key={s.label} className="rounded-2xl p-4 relative overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {/* Glow bg */}
              <div className="absolute inset-0 opacity-10 rounded-2xl"
                style={{ background: `radial-gradient(circle at 80% 20%, ${s.c1}, transparent 70%)` }} />
              <div className="relative flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-3)' }}>{s.label}</div>
                  <div className="tabular-nums" style={{ color: 'var(--text)', fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>
                    <AnimatedNumber value={s.value} />
                  </div>
                  <div className="text-xs mt-1 font-semibold" style={{ color: s.c1 }}>{Math.round(clamp(s.pct, 0, 1) * 100)}% of target</div>
                </div>
                <svg width={72} height={72} style={{ flexShrink: 0 }}>
                  <defs>
                    <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={s.c1} /><stop offset="100%" stopColor={s.c2} />
                    </linearGradient>
                  </defs>
                  <circle cx={36} cy={36} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} />
                  <circle cx={36} cy={36} r={R} fill="none" stroke={`url(#${gid})`} strokeWidth={7}
                    strokeLinecap="round"
                    strokeDasharray={`${CIRC * clamp(s.pct, 0, 1)} ${CIRC}`}
                    transform="rotate(-90 36 36)"
                    style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1)', filter: `drop-shadow(0 0 6px ${s.c1}80)` }} />
                  <text x={36} y={40} textAnchor="middle" fill="white" fontSize={14} fontWeight="800">{s.icon}</text>
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Team radial gauge */}
          <div className="rounded-2xl p-6 flex flex-col items-center justify-center"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="text-sm font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>Team Completion</div>
            <RadialGauge pct={teamPct} size={200} value={`${Math.round(teamPct * 100)}%`} label="of target" sublabel={`${totalCompleted} / ${totalTarget}`} />
            {/* Mini legend */}
            <div className="flex gap-4 mt-2">
              {[
                { label: 'Completed', color: '#7c3aed' },
                { label: 'Scheduled', color: 'rgba(59,130,246,0.6)' },
                { label: 'Target', color: 'rgba(255,255,255,0.2)' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-3)' }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>

          {/* Vertical bar chart */}
          <div className="xl:col-span-2 rounded-2xl p-5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>Team Performance</div>
              <div className="flex gap-3">
                {[{ label: 'Completed', color: '#7c3aed' }, { label: 'Scheduled', color: 'rgba(59,130,246,0.6)' }, { label: 'Target line', color: 'rgba(255,255,255,0.25)' }].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-3)' }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>
            {records.length === 0
              ? <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'var(--text-3)' }}>No data for selected period</div>
              : <VerticalBarChart records={sorted} />}
          </div>
        </div>
      )}

      {/* ── TREND TAB ── */}
      {activeTab === 'trend' && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>Month-wise Completed Meetings</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Last 6 months per employee</div>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-3">
              {trendEmployees.map((emp, i) => {
                const p = PALETTE[i % PALETTE.length];
                return (
                  <div key={emp.id} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-2)' }}>
                    <div className="w-3 h-1.5 rounded-full" style={{ background: `linear-gradient(90deg,${p.c1},${p.c2})` }} />
                    {(emp.name || '?').split(' ')[0]}
                  </div>
                );
              })}
            </div>
          </div>
          {trendEmployees.length === 0
            ? <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'var(--text-3)' }}>No data for selected period</div>
            : <TrendChart trendData={trendByEmpMonth} employees={trendEmployees} />}

          {/* Monthly data table */}
          <div className="mt-5 overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--surface-s)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-3)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Employee</th>
                  {allMonths.map(m => (
                    <th key={m} style={{ padding: '10px 10px', textAlign: 'center', color: 'var(--text-3)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {formatMonthShort(m)}
                    </th>
                  ))}
                  <th style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-3)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {trendEmployees.map((emp, i) => {
                  const p = PALETTE[i % PALETTE.length];
                  const vals = allMonths.map(m => trendData[emp.id]?.[m] || 0);
                  const total = vals.reduce((s, v) => s + v, 0);
                  return (
                    <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: `linear-gradient(135deg,${p.c1},${p.c2})` }} />
                          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{emp.name || emp.id}</span>
                        </div>
                      </td>
                      {vals.map((v, mi) => (
                        <td key={mi} style={{ padding: '10px 10px', textAlign: 'center', color: v > 0 ? p.c1 : 'var(--text-3)', fontWeight: v > 0 ? 700 : 400 }}>{v}</td>
                      ))}
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text)' }}>{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TEAM TAB ── */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          {records.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="text-4xl mb-3">📊</div>
              <div className="font-semibold" style={{ color: 'var(--text)' }}>No data for selected period</div>
              <div className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Assign meeting targets to employees first</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sorted.map((r, idx) => {
                const p = PALETTE[idx % PALETTE.length];
                const pct = r.target > 0 ? clamp((r.completed || 0) / r.target, 0, 1) : 0;
                const schedPct = r.target > 0 ? clamp((r.scheduled || 0) / r.target, 0, 1) : 0;
                return (
                  <div key={r.id}
                    className="rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                    onClick={() => setDrillEmp(r)}>
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
                        style={{ background: `linear-gradient(135deg,${p.c1},${p.c2})` }}>
                        {getInitials(r.employeeName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate" style={{ color: 'var(--text)' }}>{r.employeeName || '—'}</div>
                        <div className="text-xs" style={{ color: 'var(--text-3)' }}>ID: {r.employeeId || '—'}</div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="tabular-nums" style={{ color: p.c1, fontSize: 18, fontWeight: 800 }}>{r.completed || 0}</div>
                        <div className="text-xs" style={{ color: 'var(--text-3)' }}>of {r.target || 0}</div>
                      </div>
                    </div>
                    {/* Radial gauge small */}
                    <div className="flex items-center gap-4">
                      <RadialGauge pct={pct} size={100} color1={p.c1} color2={p.c2}
                        value={`${Math.round(pct * 100)}%`} sublabel="done" />
                      <div className="flex-1 space-y-3">
                        <div>
                          <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-3)' }}>
                            <span>Completed</span><span style={{ color: p.c1, fontWeight: 700 }}>{r.completed || 0} / {r.target || 0}</span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-s)' }}>
                            <div className="h-full rounded-full transition-all duration-1000"
                              style={{ width: `${pct * 100}%`, background: `linear-gradient(90deg,${p.c1},${p.c2})`, boxShadow: `0 0 8px ${p.c1}80` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-3)' }}>
                            <span>Scheduled</span><span style={{ color: '#ec4899', fontWeight: 700 }}>{r.scheduled || 0}</span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-s)' }}>
                            <div className="h-full rounded-full transition-all duration-1000"
                              style={{ width: `${schedPct * 100}%`, background: 'linear-gradient(90deg,#ec4899,#f97316)' }} />
                          </div>
                        </div>
                        {/* Rank badge */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                            style={{ background: idx === 0 ? 'rgba(245,158,11,0.2)' : 'var(--surface-s)', color: idx === 0 ? '#f59e0b' : 'var(--text-3)' }}>
                            {idx === 0 ? '🏆 Top Performer' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-3)' }}>Click for details</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedEmp && <EmployeeModal emp={selectedEmp} trendData={trendData} onClose={() => setSelectedEmp(null)} />}
    </div>
  );
}
