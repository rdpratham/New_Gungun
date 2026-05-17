import { useEffect, useState, useRef } from 'react';
import { doc, onSnapshot, collection, query, where, updateDoc, writeBatch, getDoc } from 'firebase/firestore';
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
  const groups = [
    {
      label: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
        { id: 'attendance', label: 'My Attendance', icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> },
      ],
    },
    {
      label: 'Work',
      items: [
        { id: 'tasks', label: 'Assigned Tasks', badge: unreadTasks || undefined, icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7l2 2 4-4" /></svg> },
        { id: 'assigned-meetings', label: 'Assigned Meetings', icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2} /><circle cx="12" cy="12" r="6" strokeWidth={2} /><circle cx="12" cy="12" r="2" strokeWidth={2} /></svg> },
        { id: 'meeting-report', label: 'Meeting Report', icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
      ],
    },
    {
      label: 'Personal',
      items: [
        { id: 'my-todo', label: 'My To-Do', icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
        { id: 'my-notes', label: 'My Notes', icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
        { id: 'my-credentials', label: 'My Credentials', icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg> },
      ],
    },
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      <nav className="flex-1 overflow-y-auto px-2 py-3" style={{ minHeight: 0 }}>
        {groups.map(group => (
          <div key={group.label} className="mb-4">
            <p className="px-3 mb-1" style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
              {group.label}
            </p>
            {group.items.map(item => {
              const active = page === item.id;
              return (
                <button key={item.id}
                  onClick={() => { setPage(item.id); setMobileOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 mb-0.5"
                  style={active
                    ? { background: 'rgba(124,58,237,0.15)', color: '#a78bfa', borderLeft: '2px solid #7c3aed' }
                    : { color: 'var(--text-2)', background: 'transparent', borderLeft: '2px solid transparent' }
                  }
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-s)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  {item.icon}
                  <span style={{ fontSize: 12, fontWeight: active ? 600 : 400 }}>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="ml-auto px-1.5 py-0.5 rounded font-semibold animate-pulse"
                          style={{ background: '#ef4444', color: '#fff', fontSize: 10 }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <p style={{ fontSize: 10, textAlign: 'center', color: 'var(--text-3)' }}>Garvix Ops © {new Date().getFullYear()}</p>
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

/* ── Photo Required Banner ───────────────────────────────── */
function PhotoRequiredBanner({ onAddPhoto, onDismiss }) {
  return (
    <div className="fixed top-16 left-0 right-0 z-50 px-4 py-2 flex items-center justify-center">
      <div className="max-w-xl w-full rounded-2xl overflow-hidden shadow-2xl animate-slide-up"
           style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', border: '1px solid rgba(167,139,250,0.4)' }}>
        <div className="px-5 py-3.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-tight">Face photo required for attendance</p>
            <p className="text-white/70 text-xs mt-0.5">Admin has enabled face verification. Add your photo to mark attendance.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onAddPhoto}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>
              Add Photo
            </button>
            <button onClick={onDismiss} className="p-1.5 rounded-lg transition-all" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
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
      setRecords(all);
      setLoading(false);
    };

    const listen = (field, value) => onSnapshot(
      query(collection(db, 'attendance'), where(field, '==', value)),
      snap => { snap.docs.forEach(d => mapRef.current.set(d.id, { id: d.id, ...d.data() })); applyMap(); },
      err => { console.error('MyAttendancePage listen error:', field, err.message); applyMap(); }
    );

    const unsubs = [listen('employeeUid', uid)];
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

/* ── Dashboard page ──────────────────────────────────────── */
function DashboardPage({ user, employeeData, signInRecord, signOutRecord, recentRecords, loadingData, openPopup, currentTime, allTasks, myTodos, onNavigate }) {
  const today = getISTDateString();
  const todayDate = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  const pendingTasks = allTasks.filter(t => t.status !== 'completed').slice(0, 5);
  const todayTodos   = myTodos.filter(t => !t.completed && (t.date === today || !t.date)).slice(0, 5);
  const upcomingTodos = myTodos.filter(t => !t.completed && t.date && t.date > today).slice(0, 3);

  const PRIORITY_COLOR = { high: '#f87171', medium: '#fbbf24', low: '#34d399' };
  const STATUS_COLOR   = { pending: '#94a3b8', 'in-progress': '#60a5fa', completed: '#34d399' };
  const STATUS_LABEL   = { pending: 'Pending', 'in-progress': 'In Progress', completed: 'Done' };

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Header strip */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold" style={{ color: 'var(--text)', fontSize: 15 }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {(employeeData?.name || 'there').split(' ')[0]}
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: 12 }}>{todayDate}</p>
        </div>
        <div className="px-3 py-1.5 rounded-lg font-mono text-xs font-medium tabular-nums"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
          {new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(currentTime)} IST
        </div>
      </div>

      {/* Attendance strip */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-s)' }}>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Today's Attendance</span>
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>Shift 5:00 PM – 2:00 AM IST</span>
        </div>
        <div className="grid grid-cols-2 divide-x" style={{ divideColor: 'var(--border)' }}>
          {/* Sign In */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                     style={{ background: signInRecord ? 'rgba(16,185,129,0.12)' : 'var(--surface-s)', border: '1px solid var(--border)' }}>
                  {signInRecord
                    ? <svg className="w-3.5 h-3.5" style={{ color: '#10b981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    : <svg className="w-3.5 h-3.5" style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14" /></svg>
                  }
                </div>
                <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>Sign In</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={signInRecord ? { background: 'rgba(16,185,129,0.1)', color: '#10b981' } : { background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                {signInRecord ? 'Recorded' : 'Pending'}
              </span>
            </div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>
              {signInRecord ? formatTime(signInRecord.submittedAt?.toDate?.() || new Date()) : 'Not recorded yet'}
            </p>
            {!signInRecord && (
              <button onClick={() => openPopup('signin')} className="btn-primary w-full text-center" style={{ fontSize: 12 }}>
                Sign In
              </button>
            )}
          </div>

          {/* Sign Out */}
          <div className="p-4" style={{ opacity: !signInRecord && !signOutRecord ? 0.5 : 1 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                     style={{ background: signOutRecord ? 'rgba(16,185,129,0.12)' : 'var(--surface-s)', border: '1px solid var(--border)' }}>
                  {signOutRecord
                    ? <svg className="w-3.5 h-3.5" style={{ color: '#10b981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    : <svg className="w-3.5 h-3.5" style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8" /></svg>
                  }
                </div>
                <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>Sign Out</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={signOutRecord ? { background: 'rgba(16,185,129,0.1)', color: '#10b981' } : signInRecord ? { background: 'rgba(245,158,11,0.1)', color: '#f59e0b' } : { background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>
                {signOutRecord ? 'Recorded' : signInRecord ? 'Pending' : 'Sign in first'}
              </span>
            </div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>
              {signOutRecord ? formatTime(signOutRecord.submittedAt?.toDate?.() || new Date()) : 'Not recorded yet'}
            </p>
            {!signOutRecord && signInRecord && (
              <button onClick={() => openPopup('signout')} className="btn-primary w-full text-center"
                      style={{ fontSize: 12, background: 'linear-gradient(135deg,#059669,#10b981)' }}>
                Sign Out
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tasks + Todos grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Assigned Tasks */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-s)' }}>
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5" style={{ color: '#60a5fa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7l2 2 4-4" />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Assigned Tasks</span>
              {pendingTasks.length > 0 && (
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#3b82f620', color: '#60a5fa' }}>
                  {pendingTasks.length}
                </span>
              )}
            </div>
            <button onClick={() => onNavigate('tasks')} className="text-xs font-medium transition-colors" style={{ color: '#60a5fa' }}>
              View all →
            </button>
          </div>
          {pendingTasks.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>No pending tasks assigned</p>
            </div>
          ) : (
            <div>
              {pendingTasks.map((task, i) => (
                <div key={task.id} className="px-4 py-3 border-b last:border-b-0 flex items-start gap-3 transition-colors"
                     style={{ borderColor: 'var(--border)' }}
                     onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-s)'}
                     onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                       style={{ background: PRIORITY_COLOR[task.priority] || '#94a3b8' }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ color: 'var(--text)', fontSize: 13 }}>{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs" style={{ color: STATUS_COLOR[task.status] || '#94a3b8' }}>
                        {STATUS_LABEL[task.status] || task.status}
                      </span>
                      {task.dueDate && (
                        <span className="text-xs" style={{ color: 'var(--text-3)' }}>· Due {task.dueDate}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My To-Do */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-s)' }}>
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>My To-Do</span>
              {(todayTodos.length + upcomingTodos.length) > 0 && (
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#7c3aed20', color: '#a78bfa' }}>
                  {todayTodos.length + upcomingTodos.length}
                </span>
              )}
            </div>
            <button onClick={() => onNavigate('my-todo')} className="text-xs font-medium transition-colors" style={{ color: '#a78bfa' }}>
              View all →
            </button>
          </div>
          {todayTodos.length === 0 && upcomingTodos.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>No pending to-do items</p>
            </div>
          ) : (
            <div>
              {todayTodos.map(todo => (
                <div key={todo.id} className="px-4 py-3 border-b last:border-b-0 flex items-start gap-3 transition-colors"
                     style={{ borderColor: 'var(--border)' }}
                     onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-s)'}
                     onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                       style={{ background: PRIORITY_COLOR[todo.priority] || '#a78bfa' }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ color: 'var(--text)', fontSize: 13 }}>{todo.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#a78bfa' }}>Today</p>
                  </div>
                </div>
              ))}
              {upcomingTodos.map(todo => (
                <div key={todo.id} className="px-4 py-3 border-b last:border-b-0 flex items-start gap-3 transition-colors"
                     style={{ borderColor: 'var(--border)' }}
                     onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-s)'}
                     onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                       style={{ background: PRIORITY_COLOR[todo.priority] || '#94a3b8' }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ color: 'var(--text)', fontSize: 13 }}>{todo.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{todo.date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent attendance — compact */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)', background: 'var(--surface-s)' }}>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Recent Attendance</span>
          <button onClick={() => onNavigate('attendance')} className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>View all →</button>
        </div>
        {recentRecords.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>No records yet</p>
          </div>
        ) : (
          <div>
            {recentRecords.slice(0, 5).map(rec => (
              <div key={rec.id} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 transition-colors"
                   style={{ borderColor: 'var(--border)' }}
                   onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-s)'}
                   onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span className="text-xs px-2 py-0.5 rounded font-medium flex-shrink-0"
                      style={rec.type === 'signin' ? { background: 'rgba(124,58,237,0.12)', color: '#a78bfa' } : { background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                  {rec.type === 'signin' ? '↗ In' : '↙ Out'}
                </span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{formatDate(rec.date)}</span>
                <span className="text-xs ml-auto truncate" style={{ color: 'var(--text-3)' }}>{rec.workSummary?.slice(0, 40)}</span>
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

  // My todos for dashboard widget
  const [myTodos, setMyTodos] = useState([]);

  // Photo requirement
  const [requirePhoto, setRequirePhoto] = useState(false);
  const [showPhotoBanner, setShowPhotoBanner] = useState(false);
  const [photoBannerDismissed, setPhotoBannerDismissed] = useState(false);

  // Tracks if user dismissed the popup this session so it doesn't re-pop every 30s
  const dismissedRef = useRef({ signin: false, signout: false, date: '' });

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
      query(collection(db, 'attendance'), where(field, '==', value)),
      snap => {
        snap.docs.forEach(d => attMapRef.current.set(d.id, { id: d.id, ...d.data() }));
        applyMap();
      },
      err => console.error('Attendance listener error:', field, value, err.message)
    );

    const unsubs = [listen('employeeUid', uid)];
    if (empId && empId !== uid) {
      unsubs.push(listen('employeeId', empId));
    }

    return () => {
      unsubs.forEach(u => u());
      attMapRef.current.clear();
    };
  }, [user, employeeData?.employeeId]); // re-subscribes only if empId changes

  // My todos listener
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'todos'), where('uid', '==', user.uid));
    return onSnapshot(q, snap => {
      const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMyTodos(todos.filter(t => !t.completed).sort((a, b) => (a.date || '').localeCompare(b.date || '')));
    }, err => console.error('todos listener:', err));
  }, [user]);

  // Listen to photo requirement setting
  useEffect(() => {
    return onSnapshot(doc(db, 'appSettings', 'config'), snap => {
      if (snap.exists()) {
        const val = snap.data().requirePhotoOnSetup !== false;
        setRequirePhoto(val);
        if (val) setPhotoBannerDismissed(false);
      }
    });
  }, []);

  // Show photo banner when requirement is active and employee has no photo
  const hasPhoto = !!(employeeData?.photoURL || employeeData?.photoBase64);
  const needsPhoto = requirePhoto && !hasPhoto && !loadingData && !!employeeData;

  useEffect(() => {
    if (needsPhoto && !photoBannerDismissed) {
      setShowPhotoBanner(true);
    } else {
      setShowPhotoBanner(false);
    }
  }, [needsPhoto, photoBannerDismissed]);

  // Clock tick every minute — auto-popup only once per session per type
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      const today = getISTDateString();
      // Reset dismissed flags on new day
      if (dismissedRef.current.date !== today) {
        dismissedRef.current = { signin: false, signout: false, date: today };
      }
      if (!showPopup && !needsPhoto) {
        if (!signInRecord && isSignInWindow() && !dismissedRef.current.signin) {
          setPopupType('signin'); setShowPopup(true);
        } else if (signInRecord && !signOutRecord && isSignOutWindow() && !dismissedRef.current.signout) {
          setPopupType('signout'); setShowPopup(true);
        }
      }
    }, 60000);
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

  const openPopup = (type) => {
    if (needsPhoto) {
      setShowPhotoBanner(true);
      setPhotoBannerDismissed(false);
      return;
    }
    setPopupType(type); setShowPopup(true);
  };
  const handleSubmitted = () => setShowPopup(false);
  const handleClosePopup = () => {
    // Mark this type as dismissed so interval doesn't re-show it
    dismissedRef.current[popupType] = true;
    setShowPopup(false);
  };

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
                         attendanceType={popupType} onSubmitted={handleSubmitted} onClose={handleClosePopup} />
      )}

      {showPhotoBanner && (
        <PhotoRequiredBanner
          onAddPhoto={() => { setShowPhotoBanner(false); setShowProfile(true); }}
          onDismiss={() => { setShowPhotoBanner(false); setPhotoBannerDismissed(true); }}
        />
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
                               openPopup={openPopup} currentTime={currentTime}
                               allTasks={allTasks} myTodos={myTodos}
                               onNavigate={setPage} />
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

      {/* ── Footer ── */}
      <div className="text-center py-3 text-xs" style={{ color: 'var(--text-3)', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        Created by <span style={{ color: '#a78bfa', fontWeight: 700 }}>Pratham Jain</span>
      </div>
    </div>
  );
}
