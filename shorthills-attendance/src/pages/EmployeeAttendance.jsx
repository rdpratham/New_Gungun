import { useEffect, useState, useRef } from 'react';
import { doc, onSnapshot, collection, query, where, limit, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import Navbar from '../components/Navbar';
import AttendancePopup from '../components/AttendancePopup';
import ProfileModal from '../components/ProfileModal';
import AssignedTasksPage from '../components/AssignedTasksPage';
import TodoPage from '../components/TodoPage';
import NotesPage from '../components/NotesPage';
import CredentialsPage from '../components/CredentialsPage';
import AssignedMeetings from '../components/AssignedMeetings';
import MeetingReportEmployee from '../components/MeetingReportEmployee';

/* ── helpers ─────────────────────────────────────────────── */
function getISTDateString() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function getISTTime() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
  return { hour: parseInt(parts.find(p => p.type === 'hour').value), minute: parseInt(parts.find(p => p.type === 'minute').value) };
}
function isSignInWindow()  { const { hour } = getISTTime(); return hour >= 17 || hour < 2; }
function isSignOutWindow() { const { hour } = getISTTime(); return hour >= 17 || hour < 2; }
function formatIST(ts) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true, day: '2-digit', month: 'short', year: 'numeric' })
    .format(ts instanceof Date ? ts : ts?.toDate?.() || new Date());
}
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return new Date(y, m-1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}
function formatTime(ts) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })
    .format(ts instanceof Date ? ts : ts?.toDate?.() || new Date());
}

/* ── Sidebar ─────────────────────────────────────────────── */
function Sidebar({ page, setPage, unreadTasks, mobileOpen, setMobileOpen }) {
  const items = [
    {
      id: 'dashboard', label: 'Dashboard',
      icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    },
    {
      id: 'attendance', label: 'My Attendance',
      icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
    },
    {
      id: 'tasks', label: 'Assigned Tasks', badge: unreadTasks || undefined,
      icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7l2 2 4-4" /></svg>,
    },
    {
      id: 'my-todo', label: 'My To-Do',
      icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      id: 'my-notes', label: 'My Notes',
      icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    },
    {
      id: 'my-credentials', label: 'My Credentials',
      icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>,
    },
    {
      id: 'assigned-meetings', label: 'Assigned Meetings',
      icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2} /><circle cx="12" cy="12" r="6" strokeWidth={2} /><circle cx="12" cy="12" r="2" strokeWidth={2} /></svg>,
    },
    {
      id: 'meeting-report', label: 'Meeting Report',
      icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    },
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>My Portal</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map(item => {
          const active = page === item.id;
          return (
            <button key={item.id}
              onClick={() => { setPage(item.id); setMobileOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200"
              style={active
                ? { background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff', boxShadow: '0 4px 20px rgba(124,58,237,0.3)' }
                : { color: 'var(--text-2)', background: 'transparent' }
              }
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-s)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-bold animate-pulse"
                      style={{ background: '#ef4444', color: '#fff', minWidth: '20px', textAlign: 'center' }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>Garvix Ops © {new Date().getFullYear()}</p>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex flex-col flex-shrink-0 sticky top-16 h-[calc(100vh-4rem)] w-56 lg:w-64"
             style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
        <NavContent />
      </aside>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
               onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 w-64 h-full flex flex-col shadow-2xl"
                 style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
            <NavContent />
          </aside>
        </div>
      )}
    </>
  );
}

/* ── Task Notification Popup ─────────────────────────────── */
function TaskNotificationPopup({ tasks, onDismiss, onViewTasks }) {
  const [idx, setIdx] = useState(0);
  const task = tasks[idx];
  if (!task) return null;

  const priorityStyle = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
         style={{ background: 'rgba(4,8,15,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="max-w-md w-full rounded-3xl overflow-hidden shadow-2xl animate-slide-up"
           style={{ background: 'var(--surface)', border: '1px solid rgba(124,58,237,0.4)' }}>
        {/* Header */}
        <div className="p-5 pb-4" style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-white/70 text-xs font-medium">New Task Assigned!</p>
              <p className="text-white font-bold">From your Manager</p>
            </div>
            {tasks.length > 1 && (
              <span className="text-white/70 text-xs">{idx+1} of {tasks.length}</span>
            )}
          </div>
        </div>

        {/* Task details */}
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-bold text-lg leading-tight" style={{ color: 'var(--text)' }}>{task.title}</h3>
            <span className="flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide"
                  style={{ background: priorityStyle[task.priority] + '22', color: priorityStyle[task.priority], border: `1px solid ${priorityStyle[task.priority]}44` }}>
              {task.priority}
            </span>
          </div>
          {task.description && (
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>{task.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-3)' }}>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Due: {task.dueDate}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-3">
          {tasks.length > 1 && idx < tasks.length - 1 ? (
            <button onClick={() => setIdx(i => i+1)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: 'var(--surface-s)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              Next ({tasks.length - idx - 1} more)
            </button>
          ) : (
            <button onClick={onDismiss} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: 'var(--surface-s)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              Got it!
            </button>
          )}
          <button onClick={() => { onDismiss(); onViewTasks(); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}>
            View Tasks
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── My Attendance page ──────────────────────────────────── */
function calcStreak(records) {
  const dates = [...new Set(records.filter(r => r.type === 'signin').map(r => r.date))].sort().reverse();
  if (!dates.length) return 0;
  let streak = 0;
  let expected = dates[0];
  for (const d of dates) {
    if (d === expected) {
      streak++;
      const [y, m, day] = expected.split('-').map(Number);
      const prev = new Date(y, m - 1, day - 1);
      expected = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(prev);
    } else break;
  }
  return streak;
}

function calcDuration(inRec, outRec) {
  if (!inRec || !outRec) return null;
  const a = inRec.submittedAt?.toDate?.()  || new Date(inRec.submittedAt  || 0);
  const b = outRec.submittedAt?.toDate?.() || new Date(outRec.submittedAt || 0);
  const ms = Math.abs(b - a);
  if (ms < 60000) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function MyAttendancePage({ user, employeeData }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const mapRef = useRef(new Map());
  useEffect(() => {
    setLoading(true);
    const uid   = user.uid;
    const empId = employeeData?.employeeId;

    const applyMap = () => {
      const all = Array.from(mapRef.current.values());
      all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setRecords(all.slice(0, 120));
      setLoading(false);
    };

    const listen = (field, value) => onSnapshot(
      query(collection(db, 'attendance'), where(field, '==', value), limit(120)),
      snap => { snap.docs.forEach(d => mapRef.current.set(d.id, { id: d.id, ...d.data() })); applyMap(); },
      err => { console.error(err); setLoading(false); }
    );

    const unsubs = [listen('employeeUid', uid), listen('employeeId', uid)];
    if (empId && empId !== uid) unsubs.push(listen('employeeId', empId));
    return () => { unsubs.forEach(u => u()); mapRef.current.clear(); };
  }, [user.uid, employeeData?.employeeId]);

  /* Date-wise grouping: each date → { signin, signout } */
  const byDate = {};
  records.forEach(rec => {
    if (!byDate[rec.date]) byDate[rec.date] = { signin: null, signout: null };
    if (rec.type === 'signin'  && !byDate[rec.date].signin)  byDate[rec.date].signin  = rec;
    if (rec.type === 'signout' && !byDate[rec.date].signout) byDate[rec.date].signout = rec;
  });
  const days = Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]));

  const today     = getISTDateString();
  const signIns   = records.filter(r => r.type === 'signin').length;
  const signOuts  = records.filter(r => r.type === 'signout').length;
  const daysCount = days.length;
  const streak    = calcStreak(records);

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header banner */}
      <div className="relative rounded-3xl overflow-hidden p-5"
           style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#3b82f6 60%,#06b6d4 100%)' }}>
        <div className="absolute inset-0 opacity-10"
             style={{ backgroundImage: 'radial-gradient(circle at 85% 50%, #fff 0%, transparent 55%)' }} />
        <div className="relative">
          <h1 className="text-xl font-black text-white">My Attendance</h1>
          <p className="text-white/60 text-xs mt-0.5">Complete history · Shift: 5 PM – 2 AM IST</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Sign-Ins',    value: signIns,   color: '#a78bfa', bg: 'rgba(124,58,237,0.12)', border: 'rgba(124,58,237,0.2)' },
          { label: 'Sign-Outs',   value: signOuts,  color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.2)' },
          { label: 'Active Days', value: daysCount, color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.2)'  },
          { label: 'Day Streak',  value: streak,    color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.2)'  },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 text-center transition-all hover:-translate-y-0.5"
               style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            <p className="text-3xl font-black" style={{ color: s.color }}>{loading ? '—' : s.value}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-3)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Day-wise cards */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />)}
        </div>
      ) : days.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 rounded-2xl"
             style={{ border: '1px dashed var(--border)' }}>
          <div className="text-5xl">📋</div>
          <p className="font-semibold" style={{ color: 'var(--text-2)' }}>No attendance records yet</p>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>Records will appear here after your first sign-in</p>
        </div>
      ) : (
        <div className="space-y-3">
          {days.map(([dateStr, { signin, signout }]) => {
            const [y, m, d] = dateStr.split('-').map(Number);
            const dt        = new Date(y, m - 1, d);
            const dayName   = dt.toLocaleDateString('en-IN', { weekday: 'short' });
            const dayNum    = dt.getDate();
            const monthName = dt.toLocaleDateString('en-IN', { month: 'short' });
            const isToday   = dateStr === today;
            const hasBoth   = signin && signout;
            const duration  = calcDuration(signin, signout);
            const photo     = signin?.photoBase64 || signout?.photoBase64 || signin?.photoURL || signout?.photoURL;

            const status = hasBoth ? 'full' : signin ? 'in-only' : 'out-only';
            const STATUS_META = {
              full:     { label: 'Full Day',     color: '#34d399', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.25)'  },
              'in-only':  { label: 'Sign-In Only', color: '#a78bfa', bg: 'rgba(124,58,237,0.12)', border: 'rgba(124,58,237,0.25)' },
              'out-only': { label: 'Sign-Out Only',color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)'  },
            };
            const sm = STATUS_META[status];

            return (
              <div key={dateStr}
                   className="rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg"
                   style={{ background: 'var(--surface)', border: `1.5px solid ${isToday ? 'rgba(124,58,237,0.5)' : 'var(--border)'}` }}>
                <div className="flex items-stretch">

                  {/* Date column */}
                  <div className="w-16 flex-shrink-0 flex flex-col items-center justify-center py-4 gap-0.5"
                       style={{
                         background: isToday
                           ? 'linear-gradient(135deg,#7c3aed,#3b82f6)'
                           : 'var(--surface-s)',
                         borderRight: '1px solid var(--border)',
                       }}>
                    <span className="text-[11px] font-bold"
                          style={{ color: isToday ? 'rgba(255,255,255,0.7)' : 'var(--text-3)' }}>
                      {dayName}
                    </span>
                    <span className="text-2xl font-black leading-none"
                          style={{ color: isToday ? '#fff' : 'var(--text)' }}>
                      {dayNum}
                    </span>
                    <span className="text-[11px] font-semibold"
                          style={{ color: isToday ? 'rgba(255,255,255,0.7)' : 'var(--text-3)' }}>
                      {monthName}
                    </span>
                    {isToday && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1"
                            style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                        TODAY
                      </span>
                    )}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0 p-4">
                    <div className="flex items-start justify-between gap-3">

                      {/* Times */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' }}>
                            ↗ IN
                          </span>
                          <span className="text-sm font-semibold"
                                style={{ color: signin ? 'var(--text)' : 'var(--text-3)' }}>
                            {signin ? formatTime(signin.submittedAt?.toDate?.() || new Date()) : '—'}
                          </span>
                          {signin?.mode && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                                  style={{ background: 'var(--surface-s)', color: 'var(--text-3)' }}>
                              {signin.mode === 'wfh' ? 'WFH' : 'Office'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
                            ↙ OUT
                          </span>
                          <span className="text-sm font-semibold"
                                style={{ color: signout ? 'var(--text)' : 'var(--text-3)' }}>
                            {signout ? formatTime(signout.submittedAt?.toDate?.() || new Date()) : '—'}
                          </span>
                          {signout?.mode && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                                  style={{ background: 'var(--surface-s)', color: 'var(--text-3)' }}>
                              {signout.mode === 'wfh' ? 'WFH' : 'Office'}
                            </span>
                          )}
                        </div>
                        {duration && (
                          <p className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>
                            ⏱ {duration} on shift
                          </p>
                        )}
                      </div>

                      {/* Status + photo */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className="text-[11px] font-bold px-3 py-1 rounded-full"
                              style={{ background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>
                          {sm.label}
                        </span>
                        {photo && (
                          <img src={photo} alt=""
                               className="w-10 h-10 rounded-xl object-cover cursor-pointer hover:scale-105 transition-transform"
                               style={{ border: '2px solid var(--border)' }}
                               onClick={() => window.open(photo, '_blank')} />
                        )}
                      </div>
                    </div>

                    {/* Work summary */}
                    {(signin?.workSummary || signout?.workSummary) && (
                      <p className="text-xs mt-2.5 pt-2.5 border-t line-clamp-1"
                         style={{ borderColor: 'var(--border-s)', color: 'var(--text-3)' }}>
                        {signin?.workSummary || signout?.workSummary}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Dashboard page (existing content) ───────────────────── */
function DashboardPage({ user, employeeData, signInRecord, signOutRecord, recentRecords, loadingData, openPopup, currentTime }) {
  const today = getISTDateString();

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Hero profile card */}
      <div className="relative rounded-3xl overflow-hidden p-6"
           style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#3b82f6 60%,#06b6d4 100%)' }}>
        <div className="absolute inset-0 opacity-20"
             style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #fff 0%, transparent 50%)' }} />
        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 border-2 border-white/30">
            {employeeData?.photoURL
              ? <img src={employeeData.photoURL} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white bg-white/20">
                  {(employeeData?.name || user.email || '?').charAt(0).toUpperCase()}
                </div>
            }
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-xl font-black text-white">{employeeData?.name || employeeData?.employeeId || 'Employee'}</h1>
            <p className="text-white/70 text-sm">{user.email}</p>
            <p className="text-white/60 text-xs mt-1">ID: {employeeData?.employeeId} · {employeeData?.team || 'Sales Team'}</p>
            <div className="mt-3 inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse" />
              <span className="text-white/80 text-xs font-medium">Shift: 5:00 PM – 2:00 AM IST</span>
            </div>
          </div>
          <div className="text-center bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-3">
            <div className="text-2xl font-black text-white font-mono tracking-tight">
              {new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(currentTime)}
            </div>
            <div className="text-white/50 text-xs mt-1">IST</div>
          </div>
        </div>
      </div>

      {/* Sign In / Sign Out cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Sign In */}
        <div className="rounded-2xl p-5 transition-all duration-300"
             style={{ background: signInRecord ? 'rgba(52,211,153,0.08)' : 'var(--surface)', border: `2px solid ${signInRecord ? 'rgba(52,211,153,0.3)' : 'var(--border)'}` }}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                   style={{ background: signInRecord ? 'rgba(52,211,153,0.2)' : 'var(--surface-s)' }}>
                {signInRecord
                  ? <svg className="w-5 h-5" style={{ color: '#34d399' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  : <svg className="w-5 h-5" style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14" /></svg>
                }
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>Sign In</p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                  {signInRecord ? formatTime(signInRecord.submittedAt?.toDate?.() || new Date()) : 'Window: 5:00 PM IST'}
                </p>
              </div>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={signInRecord
                    ? { background: 'rgba(52,211,153,0.2)', color: '#34d399' }
                    : { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
              {signInRecord ? 'Done ✓' : 'Pending'}
            </span>
          </div>
          {!signInRecord && (
            <button onClick={() => openPopup('signin')} className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}>
              Submit Sign In
            </button>
          )}
        </div>

        {/* Sign Out */}
        <div className="rounded-2xl p-5 transition-all duration-300"
             style={{
               background: signOutRecord ? 'rgba(52,211,153,0.08)' : 'var(--surface)',
               border: `2px solid ${signOutRecord ? 'rgba(52,211,153,0.3)' : 'var(--border)'}`,
               opacity: !signInRecord && !signOutRecord ? 0.6 : 1,
             }}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                   style={{ background: signOutRecord ? 'rgba(52,211,153,0.2)' : 'var(--surface-s)' }}>
                {signOutRecord
                  ? <svg className="w-5 h-5" style={{ color: '#34d399' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  : <svg className="w-5 h-5" style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8" /></svg>
                }
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>Sign Out</p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                  {signOutRecord ? formatTime(signOutRecord.submittedAt?.toDate?.() || new Date()) : 'Window: 2:00 AM IST'}
                </p>
              </div>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={signOutRecord
                    ? { background: 'rgba(52,211,153,0.2)', color: '#34d399' }
                    : signInRecord
                    ? { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }
                    : { background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
              {signOutRecord ? 'Done ✓' : signInRecord ? 'Pending' : 'Sign in first'}
            </span>
          </div>
          {!signOutRecord && signInRecord && (
            <button onClick={() => openPopup('signout')} className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg,#10b981,#34d399)' }}>
              Submit Sign Out
            </button>
          )}
        </div>
      </div>

      {/* Location notice */}
      <div className="rounded-2xl p-4 flex items-start gap-3"
           style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#a78bfa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#a78bfa' }}>Location-verified attendance</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            You must be at <span style={{ color: '#a78bfa' }}>Ambience Mall, Gurugram</span>. Both sign-in and sign-out require face + location verification.
          </p>
        </div>
      </div>

      {/* Recent attendance */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-bold" style={{ color: 'var(--text)' }}>Recent Attendance</h2>
        </div>
        {recentRecords.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>No records yet</p>
          </div>
        ) : (
          <div>
            {recentRecords.slice(0, 5).map(rec => (
              <div key={rec.id} className="flex items-start gap-3 px-5 py-4 border-b last:border-b-0 transition-colors"
                   style={{ borderColor: 'var(--border)' }}
                   onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-s)'}
                   onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {(rec.photoBase64 || rec.photoURL) && (
                  <img src={rec.photoBase64 || rec.photoURL} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" style={{ border: '1px solid var(--border)' }} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>{formatDate(rec.date)}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={rec.type === 'signin' ? { background: 'rgba(124,58,237,0.15)', color: '#a78bfa' } : { background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                      {rec.type === 'signin' ? '↗ Sign In' : '↙ Sign Out'}
                    </span>
                  </div>
                  <p className="text-xs mt-1 line-clamp-1" style={{ color: 'var(--text-3)' }}>{rec.workSummary}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────── */
export default function EmployeeAttendance({ user }) {
  const [page, setPage]               = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [employeeData, setEmployeeData]   = useState(null);
  const [signInRecord, setSignInRecord]   = useState(null);
  const [signOutRecord, setSignOutRecord] = useState(null);
  const [recentRecords, setRecentRecords] = useState([]);
  const [loadingData, setLoadingData]     = useState(true);
  const [showPopup, setShowPopup]         = useState(false);
  const [popupType, setPopupType]         = useState('signin');
  const [currentTime, setCurrentTime]     = useState(new Date());
  const [showProfile, setShowProfile]     = useState(false);

  // Task notifications
  const [newTasks, setNewTasks]             = useState([]);
  const [showNotification, setShowNotification] = useState(false);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [allTasks, setAllTasks]             = useState([]);
  const notifiedIds = useRef(new Set());

  // Real-time employee profile listener
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'employees', user.uid), snap => {
      setEmployeeData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoadingData(false);
    }, err => { console.error(err); setLoadingData(false); });
    return () => unsub();
  }, [user]);

  // Real-time attendance listeners — 3 parallel queries merged by doc ID
  // Covers: new records (employeeUid field), legacy records (employeeId = uid or readable ID)
  const attMapRef = useRef(new Map()); // docId -> record, shared across all 3 listeners
  useEffect(() => {
    if (!user) return;
    const uid   = user.uid;
    const empId = employeeData?.employeeId;
    const today = getISTDateString();

    const applyMap = () => {
      const all = Array.from(attMapRef.current.values());
      all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setRecentRecords(all.slice(0, 10));
      const todayRecs = all.filter(r => r.date === today);
      setSignInRecord(todayRecs.find(r => r.type === 'signin')  || null);
      setSignOutRecord(todayRecs.find(r => r.type === 'signout') || null);
    };

    const listen = (field, value) => onSnapshot(
      query(collection(db, 'attendance'), where(field, '==', value), limit(50)),
      snap => {
        snap.docs.forEach(d => attMapRef.current.set(d.id, { id: d.id, ...d.data() }));
        applyMap();
      },
      err => console.error('Attendance listener error:', field, value, err.message)
    );

    const unsubs = [
      listen('employeeUid', uid),
      listen('employeeId',  uid),
    ];
    if (empId && empId !== uid) {
      unsubs.push(listen('employeeId', empId));
    }

    return () => {
      unsubs.forEach(u => u());
      attMapRef.current.clear();
    };
  }, [user, employeeData?.employeeId]); // re-subscribes only if empId changes

  // Clock tick + auto-popup check every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      if (!showPopup) {
        if (!signInRecord && isSignInWindow()) { setPopupType('signin'); setShowPopup(true); }
        else if (signInRecord && !signOutRecord && isSignOutWindow()) { setPopupType('signout'); setShowPopup(true); }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [signInRecord, signOutRecord, showPopup]);

  // Real-time task listener
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'tasks'), where('assignedTo', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const unseen = [];
      snap.docs.forEach(d => {
        const task = { id: d.id, ...d.data() };
        if (!task.seen && !notifiedIds.current.has(task.id)) {
          unseen.push(task);
          notifiedIds.current.add(task.id);
        }
      });
      const allTasksList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      allTasksList.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setAllTasks(allTasksList);
      const pending = allTasksList.filter(t => t.status !== 'completed').length;
      setUnreadCount(pending);

      if (unseen.length > 0) {
        setNewTasks(unseen);
        setShowNotification(true);
      }
    });
    return () => unsub();
  }, [user]);

  const handleDismissNotification = async () => {
    setShowNotification(false);
    // Mark all shown tasks as seen
    try {
      const batch = writeBatch(db);
      newTasks.forEach(t => batch.update(doc(db, 'tasks', t.id), { seen: true }));
      await batch.commit();
    } catch (err) { console.error(err); }
    setNewTasks([]);
  };

  const handleMarkAllRead = async () => {
    try {
      const batch = writeBatch(db);
      allTasks.filter(t => !t.seen).forEach(t => batch.update(doc(db, 'tasks', t.id), { seen: true }));
      await batch.commit();
    } catch (err) { console.error(err); }
  };

  const openPopup = (type) => { setPopupType(type); setShowPopup(true); };
  // onSnapshot listeners update data automatically — just close the popup
  const handleSubmitted = () => setShowPopup(false);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <Navbar
        user={user}
        role="employee"
        avatarSrc={employeeData?.photoURL}
        onViewProfile={() => setShowProfile(true)}
        notifications={allTasks}
        unreadCount={unreadCount}
        onNotifClick={(task) => { if (task) setPage('tasks'); }}
        onMarkAllRead={handleMarkAllRead}
      />

      {showProfile && (
        <ProfileModal user={user} role="employee" employeeData={employeeData}
                      onClose={() => setShowProfile(false)}
                      onUpdated={updated => setEmployeeData(updated)} />
      )}

      {showPopup && (
        <AttendancePopup user={user} employeeData={employeeData}
                         attendanceType={popupType} onSubmitted={handleSubmitted} />
      )}

      {showNotification && newTasks.length > 0 && (
        <TaskNotificationPopup
          tasks={newTasks}
          onDismiss={handleDismissNotification}
          onViewTasks={() => setPage('tasks')}
        />
      )}

      <div className="flex flex-1 relative">
        {/* Mobile FAB */}
        <button className="fixed bottom-5 left-5 z-40 md:hidden w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl text-white"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}
                onClick={() => setSidebarOpen(v => !v)}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold">
              {unreadCount}
            </span>
          )}
        </button>

        <Sidebar page={page} setPage={setPage} unreadTasks={unreadCount}
                 mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

        <main className="flex-1 min-w-0 p-5 lg:p-8 overflow-auto">
          {loadingData && page === 'dashboard' ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>Loading your dashboard...</p>
              </div>
            </div>
          ) : (
            <>
              {page === 'dashboard' && (
                <DashboardPage user={user} employeeData={employeeData}
                               signInRecord={signInRecord} signOutRecord={signOutRecord}
                               recentRecords={recentRecords} loadingData={loadingData}
                               openPopup={openPopup} currentTime={currentTime} />
              )}
              {page === 'attendance' && <MyAttendancePage user={user} employeeData={employeeData} />}
              {page === 'tasks'      && <AssignedTasksPage user={user} />}
              {page === 'my-todo'        && <TodoPage user={user} />}
              {page === 'my-notes'       && <NotesPage user={user} />}
              {page === 'my-credentials' && <CredentialsPage user={user} />}
              {page === 'assigned-meetings' && <AssignedMeetings user={user} employeeData={employeeData} />}
              {page === 'meeting-report' && <MeetingReportEmployee user={user} employeeData={employeeData} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
