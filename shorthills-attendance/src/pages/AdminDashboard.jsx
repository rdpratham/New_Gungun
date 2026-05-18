import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, doc, getDoc, writeBatch, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import Navbar from '../components/Navbar';
import EmployeeCard from '../components/EmployeeCard';
import EditEmployeeModal from '../components/EditEmployeeModal';
import ProfileModal from '../components/ProfileModal';
import AssignTaskPage from '../components/AssignTaskPage';
import TodoPage from '../components/TodoPage';
import NotesPage from '../components/NotesPage';
import CredentialsPage from '../components/CredentialsPage';
import AssignMeetingTarget from '../components/AssignMeetingTarget';
import MeetingReport from '../components/MeetingReport';
import TeamTargetPage from '../components/TeamTargetPage';
import ProfileSetupSettings from '../components/ProfileSetupSettings';
import CampaignsPage from '../components/CampaignsPage';
import { getDailyQuote } from '../utils/dailyQuote';

function formatIST(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(d);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatTimeOnly(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).format(d);
}

function todayIST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function greet() {
  const h = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getEmpRecords(attendance, employee) {
  const seen = new Set();
  return attendance.filter(r => {
    // Primary: match by Firebase UID (always unique, set in all new records)
    // Fallback: match by employeeId === employee.id for legacy records where
    //           employeeId was stored as the Firebase UID (no employeeUid field)
    const byUid    = r.employeeUid === employee.id;
    const byLegacy = !r.employeeUid && r.employeeId === employee.id;
    const match = byUid || byLegacy;
    if (match && !seen.has(r.id)) { seen.add(r.id); return true; }
    return false;
  });
}

/* ── Sidebar ──────────────────────────────────────────────── */
function Sidebar({ page, setPage, employeeCount, mobileOpen, setMobileOpen }) {
  const groups = [
    {
      label: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
        { id: 'employees', label: 'Employees', badge: employeeCount, icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
        { id: 'attendance', label: 'Attendance', icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> },
      ],
    },
    {
      label: 'Team',
      items: [
        { id: 'assign-task', label: 'Assign Task', icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7l2 2 4-4" /></svg> },
        { id: 'assign-meeting', label: 'Assign Meeting Target', icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2} /><circle cx="12" cy="12" r="6" strokeWidth={2} /><circle cx="12" cy="12" r="2" strokeWidth={2} /></svg> },
        { id: 'team-target', label: 'Team Target', highlight: true, highlightColor: '#14b8a6', icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
        { id: 'meeting-report', label: 'Meeting Report', icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
        { id: 'campaigns', label: 'Campaigns', icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg> },
        { id: 'generate-mom', label: 'Generate MOM', href: 'https://mom-generator-jb6a.onrender.com/', icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
      ],
    },
    {
      label: 'Personal',
      items: [
        { id: 'my-todo', label: 'My To-Do', highlight: true, highlightColor: '#a78bfa', icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
        { id: 'my-notes', label: 'My Notes', icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
        { id: 'my-credentials', label: 'My Credentials', icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg> },
      ],
    },
    {
      label: 'Settings',
      items: [
        { id: 'profile-setup', label: 'Profile Setup', icon: <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
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
                  onClick={() => { if (item.href) { window.open(item.href, '_blank', 'noopener,noreferrer'); } else { setPage(item.id); setMobileOpen(false); } }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 mb-0.5"
                  style={active
                    ? { background: 'rgba(124,58,237,0.15)', color: '#a78bfa', borderLeft: '2px solid #7c3aed' }
                    : (item.highlight
                      ? { color: 'var(--text-2)', background: (item.highlightColor || '#fbbf24') + '15', borderLeft: '2px solid ' + (item.highlightColor || '#fbbf24') + '66' }
                      : { color: 'var(--text-2)', background: 'transparent', borderLeft: '2px solid transparent' })
                  }
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-s)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = item.highlight ? (item.highlightColor || '#fbbf24') + '15' : 'transparent'; }}
                >
                  {item.icon}
                  <span style={{ fontSize: 12, fontWeight: active ? 600 : 400 }}>{item.label}</span>
                  {item.highlight && !active && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: item.highlightColor || '#fbbf24' }} />
                  )}
                  {item.badge !== undefined && (
                    <span className="ml-auto px-1.5 py-0.5 rounded text-xs font-semibold"
                          style={{ background: 'var(--surface-s)', color: 'var(--text-3)', fontSize: 10 }}>
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

/* ── Stat card ────────────────────────────────────────────── */
function StatCard({ label, value, sub, gradient, icon, loading }) {
  return (
    <div className="relative rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl cursor-default"
         style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
           style={{ background: gradient + '08' }} />
      <div className="h-1 w-full" style={{ background: gradient }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>{label}</p>
            {loading
              ? <div className="w-14 h-9 rounded-xl animate-pulse" style={{ background: 'var(--surface-s)' }} />
              : <p className="text-4xl font-black" style={{ color: 'var(--text)' }}>{value}</p>
            }
            {sub && <p className="text-xs mt-2 font-medium" style={{ color: 'var(--text-3)' }}>{sub}</p>}
          </div>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
               style={{ background: gradient + '20', border: '1px solid ' + gradient.replace('linear-gradient(135deg,','').split(',')[0] + '40' }}>
            <div style={{ color: gradient.replace('linear-gradient(135deg,','').split(',')[0] }}>{icon}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Activity bar chart (7 days) ──────────────────────────── */
function ActivityChart({ records }) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const bars = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const dateStr = [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
    const dayRecs = records.filter(r => r.date === dateStr);
    return {
      dateStr,
      short: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      day: d.getDate(),
      signIn:  dayRecs.some(r => r.type === 'signin'),
      signOut: dayRecs.some(r => r.type === 'signout'),
    };
  });

  return (
    <div>
      <div className="flex items-end gap-2 h-20 mb-2">
        {bars.map(bar => (
          <div key={bar.dateStr} className="flex-1 flex gap-0.5 items-end h-full">
            <div className="flex-1 rounded-t-lg transition-all duration-500"
                 style={{ height: bar.signIn ? '100%' : '15%', background: bar.signIn ? 'linear-gradient(180deg,#7c3aed,#a78bfa)' : 'var(--surface-s)' }} />
            <div className="flex-1 rounded-t-lg transition-all duration-500"
                 style={{ height: bar.signOut ? '100%' : '15%', background: bar.signOut ? 'linear-gradient(180deg,#10b981,#34d399)' : 'var(--surface-s)' }} />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {bars.map(bar => (
          <div key={bar.dateStr} className="flex-1 text-center">
            <p className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{bar.short}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)' }} /><span className="text-xs" style={{ color: 'var(--text-3)' }}>Sign In</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg,#10b981,#34d399)' }} /><span className="text-xs" style={{ color: 'var(--text-3)' }}>Sign Out</span></div>
      </div>
    </div>
  );
}

/* ── Monthly calendar ─────────────────────────────────────── */
function MonthCalendar({ records }) {
  const today = todayIST();
  const [y, m] = today.split('-').map(Number);
  const firstWeekday = new Date(y, m - 1, 1).getDay();
  const daysInMonth  = new Date(y, m, 0).getDate();

  const dateMap = {};
  records.forEach(r => {
    if (!dateMap[r.date]) dateMap[r.date] = { signIn: false, signOut: false };
    if (r.type === 'signin')  dateMap[r.date].signIn  = true;
    if (r.type === 'signout') dateMap[r.date].signOut = true;
  });

  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-center text-xs font-semibold py-1" style={{ color: 'var(--text-3)' }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const data = dateMap[dateStr];
          const isToday = dateStr === today;
          const both = data?.signIn && data?.signOut;
          const onlyIn = data?.signIn && !data?.signOut;
          const onlyOut = !data?.signIn && data?.signOut;

          return (
            <div key={dateStr}
                 className="aspect-square rounded-lg flex items-center justify-center text-xs font-semibold transition-all"
                 style={{
                   background: both    ? 'rgba(52,211,153,0.25)' :
                               onlyIn  ? 'rgba(124,58,237,0.25)' :
                               onlyOut ? 'rgba(59,130,246,0.2)'  : 'var(--surface-s)',
                   color:  both    ? '#34d399' :
                           onlyIn  ? '#a78bfa' :
                           onlyOut ? '#60a5fa' : 'var(--text-3)',
                   outline: isToday ? '2px solid #7c3aed' : 'none',
                   outlineOffset: '1px',
                 }}>
              {day}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-3">
        {[
          { color: 'rgba(52,211,153,0.4)', label: 'Both' },
          { color: 'rgba(124,58,237,0.4)', label: 'Sign In only' },
          { color: 'rgba(59,130,246,0.35)', label: 'Sign Out only' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Employee attendance detail ───────────────────────────── */
function EmployeeAttendanceDetail({ employee, attendance, onBack, setExpandedPhoto }) {
  const records = getEmpRecords(attendance, employee)
    .sort((a, b) => (b.date + (b.submittedAt?.seconds || 0)) > (a.date + (a.submittedAt?.seconds || 0)) ? 1 : -1)
    .sort((a, b) => b.date.localeCompare(a.date));

  const today      = todayIST();
  const thisMonth  = today.slice(0, 7);
  const monthRecs  = records.filter(r => r.date.startsWith(thisMonth));
  const signIns    = records.filter(r => r.type === 'signin').length;
  const signOuts   = records.filter(r => r.type === 'signout').length;
  const uniqueDays = new Set(records.map(r => r.date)).size;

  const stats = [
    { label: 'Total Sign Ins',  value: signIns,    color: '#a78bfa', bg: 'rgba(124,58,237,0.12)' },
    { label: 'Total Sign Outs', value: signOuts,   color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
    { label: 'Unique Days',     value: uniqueDays, color: '#60a5fa', bg: 'rgba(59,130,246,0.12)' },
    { label: 'This Month',      value: monthRecs.length, color: '#fbbf24', bg: 'rgba(245,158,11,0.12)' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back + header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border-2"
               style={{ borderColor: '#7c3aed55', background: 'linear-gradient(135deg,#7c3aed22,#3b82f622)' }}>
            {employee.photoURL
              ? <img src={employee.photoURL} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center font-bold text-violet-400">
                  {(employee.name || employee.email || '?').charAt(0).toUpperCase()}
                </div>
            }
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-xl truncate" style={{ color: 'var(--text)' }}>
              {employee.name || employee.email?.split('@')[0]}
            </h2>
            <p className="text-sm truncate" style={{ color: 'var(--text-3)' }}>
              {employee.email} &nbsp;·&nbsp; ID: {employee.employeeId}
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="rounded-2xl p-4 text-center"
               style={{ background: s.bg, border: `1px solid ${s.color}33` }}>
            <p className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text)' }}>Last 7 Days Activity</h3>
          <ActivityChart records={records} />
        </div>
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="font-semibold mb-4 text-sm" style={{ color: 'var(--text)' }}>
            {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}
          </h3>
          <MonthCalendar records={records} />
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Attendance Timeline</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{records.length} records total</p>
        </div>
        {records.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>No attendance records yet.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {records.map(rec => (
              <div key={rec.id} className="flex items-start gap-4 px-5 py-4 transition-colors"
                   onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-s)'}
                   onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {(rec.photoBase64 || rec.photoURL)
                  ? <img src={rec.photoBase64 || rec.photoURL} alt=""
                           className="w-11 h-11 rounded-xl object-cover flex-shrink-0 cursor-pointer hover:scale-105 transition-transform"
                           style={{ border: '2px solid var(--border)' }}
                           onClick={() => setExpandedPhoto(rec.photoBase64 || rec.photoURL)} />
                  : <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-sm"
                         style={{ background: 'linear-gradient(135deg,#7c3aed22,#3b82f622)', color: '#a78bfa' }}>
                      {(employee.name || employee.email || '?').charAt(0).toUpperCase()}
                    </div>
                }
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={rec.type === 'signin'
                            ? { background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }
                            : { background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                      {rec.type === 'signin' ? '↗ Sign In' : '↙ Sign Out'}
                    </span>
                    <span className="text-xs" style={{ color: '#60a5fa' }}>{formatDate(rec.date)} · {formatIST(rec.submittedAt)}</span>
                  </div>
                  <p className="text-sm line-clamp-2" style={{ color: 'var(--text-2)' }}>{rec.workSummary}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Attendance helpers ───────────────────────────────────── */
function isPastWorkDay(dateStr) {
  // A work day is "past" after 2 AM IST of the next calendar day
  const [y, m, d] = dateStr.split('-').map(Number);
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const cutoffIST = new Date(new Date(Date.UTC(y, m - 1, d + 1, 2, 0, 0)).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return nowIST > cutoffIST;
}

function getAttStatus(empRecs, dateStr) {
  const recs   = empRecs.filter(r => r.date === dateStr);
  const hasIn  = recs.some(r => r.type === 'signin');
  const hasOut = recs.some(r => r.type === 'signout');
  if (hasIn && hasOut) return 'full';
  if (hasIn)           return 'signin-only';
  if (hasOut)          return 'signout-only';
  if (isPastWorkDay(dateStr)) return 'leave';
  return 'future';
}

const STATUS_META = {
  full:          { bg: '#34d399', label: '✓', tip: 'Present – both sign-in & sign-out', text: '#064e3b' },
  'signin-only': { bg: '#a78bfa', label: '↗', tip: 'Signed in – no sign-out yet',       text: '#2e1065' },
  'signout-only':{ bg: '#60a5fa', label: '↙', tip: 'Sign-out only (no sign-in)',          text: '#1e3a5f' },
  leave:         { bg: '#fbbf24', label: 'L',  tip: 'Absent / Leave',                    text: '#78350f' },
  future:        { bg: 'var(--surface-s)', label: '—', tip: 'Not applicable yet',        text: 'var(--text-3)' },
};

function getLast30Days() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const y  = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    return {
      str:   `${y}-${mo}-${dy}`,
      short: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      dow:   d.toLocaleDateString('en-IN', { weekday: 'short' }),
    };
  });
}

/* ── Attendance page ──────────────────────────────────────── */
function AttendancePage({ employees, attendance, loadingEmp, loadingAtt, setExpandedPhoto }) {
  const [selected,      setSelected]      = useState(null);
  const [searchName,    setSearchName]    = useState('');
  const [dateRange,     setDateRange]     = useState('30d');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [attSearchName, setAttSearchName] = useState('');
  const [attFilterDate, setAttFilterDate] = useState('');

  const today = todayIST();
  const days30 = getLast30Days();

  /* ---- date range slice for matrix ---- */
  const matrixDays = (() => {
    if (dateRange === '7d')  return days30.slice(0, 7);
    if (dateRange === 'month') {
      const [y, m] = today.split('-').map(Number);
      return days30.filter(d => d.str.startsWith(`${y}-${String(m).padStart(2,'0')}`));
    }
    return days30; // 30d
  })();

  /* ---- filtered employees — show ALL employees, setup-pending ones get a badge ---- */
  const filteredEmps = employees.filter(emp => {
    if (searchName && !(emp.name || emp.email || '').toLowerCase().includes(searchName.toLowerCase())) return false;
    if (statusFilter !== 'all') {
      const empRecs  = getEmpRecords(attendance, emp);
      const todaySt  = getAttStatus(empRecs, today);
      if (statusFilter === 'present' && todaySt !== 'full' && todaySt !== 'signin-only') return false;
      if (statusFilter === 'leave'   && todaySt !== 'leave') return false;
    }
    return true;
  });

  /* ---- today's summary stats (only profile-complete employees) ---- */
  const setupEmps = employees.filter(e => e.profileComplete);
  const totalSignInsToday  = attendance.filter(r => r.date === today && r.type === 'signin').length;
  const totalSignOutsToday = attendance.filter(r => r.date === today && r.type === 'signout').length;
  const totalPresentToday  = setupEmps.filter(emp => {
    const recs = getEmpRecords(attendance, emp).filter(r => r.date === today);
    return recs.some(r => r.type === 'signin') || recs.some(r => r.type === 'signout');
  }).length;
  const totalLeaveToday = setupEmps.filter(emp => {
    const recs = getEmpRecords(attendance, emp).filter(r => r.date === today);
    return !recs.some(r => r.type === 'signin') && !recs.some(r => r.type === 'signout') && isPastWorkDay(today);
  }).length;

  /* ---- raw record list (below matrix) ---- */
  const filteredAttRecords = attendance.filter(rec => {
    const dateMatch = attFilterDate ? rec.date === attFilterDate : true;
    const nameMatch = attSearchName ? rec.employeeName?.toLowerCase().includes(attSearchName.toLowerCase()) : true;
    return dateMatch && nameMatch;
  });

  if (selected) {
    return (
      <EmployeeAttendanceDetail
        employee={selected}
        attendance={attendance}
        onBack={() => setSelected(null)}
        setExpandedPhoto={setExpandedPhoto}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold" style={{ color: 'var(--text)' }}>Attendance</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
          Day-wise attendance matrix · Click any employee row to view their full records
        </p>
      </div>

      {/* ── Summary stat cards ── */}
      {!loadingEmp && !loadingAtt && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Total Employees',   value: setupEmps.length,    color: '#a78bfa', bg: 'rgba(124,58,237,0.10)' },
            { label: 'Sign-Ins Today',    value: totalSignInsToday,   color: '#60a5fa', bg: 'rgba(59,130,246,0.10)' },
            { label: 'Sign-Outs Today',   value: totalSignOutsToday,  color: '#34d399', bg: 'rgba(52,211,153,0.10)' },
            { label: 'Present Today',     value: totalPresentToday,   color: '#34d399', bg: 'rgba(52,211,153,0.10)' },
            { label: 'Absent / Leave',    value: totalLeaveToday,     color: '#fbbf24', bg: 'rgba(245,158,11,0.10)' },
          ].map(s => (
            <div key={s.label}
                 className="rounded-2xl p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                 style={{ background: s.bg, border: `1px solid ${s.color}33` }}>
              <p className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs font-medium leading-tight" style={{ color: 'var(--text-3)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters bar ── */}
      <div className="flex flex-wrap gap-2 items-center"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '1rem', padding: '0.75rem 1rem' }}>
        {/* Search */}
        <div className="relative flex-1 min-w-36">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
               style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" value={searchName} onChange={e => setSearchName(e.target.value)}
                 placeholder="Search employee…" className="input-field pl-9 py-1.5 text-sm" />
        </div>
        {/* Date range */}
        <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
          {[['7d','Last 7d'],['30d','Last 30d'],['month','This Month']].map(([v, lbl]) => (
            <button key={v} onClick={() => setDateRange(v)}
                    className="px-3 py-1.5 text-xs font-semibold transition-all"
                    style={dateRange === v
                      ? { background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff' }
                      : { background: 'var(--surface-s)', color: 'var(--text-3)' }}>
              {lbl}
            </button>
          ))}
        </div>
        {/* Status filter */}
        <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
          {[['all','All'],['present','Present'],['leave','Leave']].map(([v, lbl]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
                    className="px-3 py-1.5 text-xs font-semibold transition-all"
                    style={statusFilter === v
                      ? { background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff' }
                      : { background: 'var(--surface-s)', color: 'var(--text-3)' }}>
              {lbl}
            </button>
          ))}
        </div>
        {(searchName || statusFilter !== 'all' || dateRange !== '30d') && (
          <button onClick={() => { setSearchName(''); setStatusFilter('all'); setDateRange('30d'); }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{ background: 'var(--surface-s)', color: 'var(--text-3)' }}>
            Reset
          </button>
        )}
      </div>

      {/* ── Matrix ── */}
      {loadingEmp || loadingAtt ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 rounded-full animate-spin"
               style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }} />
        </div>
      ) : filteredEmps.length === 0 ? (
        <div className="rounded-2xl text-center py-16" style={{ border: '1px dashed var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>No employees match your filters.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

          {/* Table scroll wrapper */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: `${220 + matrixDays.length * 52}px`, width: '100%' }}>
              <thead>
                <tr style={{ background: 'var(--surface-s)' }}>
                  {/* Sticky employee header */}
                  <th style={{
                    position: 'sticky', left: 0, zIndex: 10,
                    background: 'var(--surface-s)',
                    borderBottom: '1px solid var(--border)',
                    borderRight: '1px solid var(--border)',
                    padding: '0.75rem 1rem',
                    textAlign: 'left', whiteSpace: 'nowrap',
                    fontSize: '0.7rem', fontWeight: 700,
                    color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    Employee ({filteredEmps.length})
                  </th>
                  {matrixDays.map(day => (
                    <th key={day.str}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          borderLeft: '1px solid var(--border)',
                          padding: '0.5rem 0.25rem',
                          textAlign: 'center',
                          minWidth: 50,
                          background: day.str === today ? 'rgba(124,58,237,0.08)' : 'var(--surface-s)',
                        }}>
                      <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-3)', lineHeight: 1 }}>
                        {day.dow}
                      </div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: day.str === today ? '#a78bfa' : 'var(--text-2)', marginTop: 2 }}>
                        {day.short}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEmps.map((emp, rowIdx) => {
                  const empRecs = getEmpRecords(attendance, emp);
                  const todaySt = getAttStatus(empRecs, today);
                  const isEven  = rowIdx % 2 === 0;
                  const rowBg   = isEven ? 'var(--surface)' : 'var(--surface-s)';

                  return (
                    <tr key={emp.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelected(emp)}
                        onMouseEnter={e => {
                          e.currentTarget.querySelectorAll('td').forEach(td => {
                            td.style.background = 'rgba(124,58,237,0.06)';
                          });
                          const sticky = e.currentTarget.querySelector('td:first-child');
                          if (sticky) sticky.style.background = 'rgba(124,58,237,0.10)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.querySelectorAll('td').forEach(td => {
                            td.style.background = rowBg;
                          });
                          const sticky = e.currentTarget.querySelector('td:first-child');
                          if (sticky) sticky.style.background = rowBg;
                        }}
                    >
                      {/* Sticky employee cell */}
                      <td style={{
                        position: 'sticky', left: 0, zIndex: 5,
                        background: rowBg,
                        borderBottom: '1px solid var(--border)',
                        borderRight: '1px solid var(--border)',
                        padding: '0.6rem 1rem',
                        whiteSpace: 'nowrap',
                        transition: 'background 0.15s',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          {/* Avatar */}
                          <div style={{
                            width: 32, height: 32, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
                            border: '1.5px solid #7c3aed33',
                            background: 'linear-gradient(135deg,#7c3aed22,#3b82f622)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {emp.photoURL
                              ? <img src={emp.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <span style={{ fontWeight: 700, fontSize: '0.75rem', color: '#a78bfa' }}>
                                  {(emp.name || emp.email || '?').charAt(0).toUpperCase()}
                                </span>
                            }
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                              {emp.name || emp.email?.split('@')[0] || '(no name)'}
                              {!emp.profileComplete && <span style={{ fontSize: '0.55rem', fontWeight: 700, background: 'rgba(245,158,11,0.2)', color: '#fbbf24', borderRadius: 99, padding: '1px 5px', flexShrink: 0 }}>SETUP</span>}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>ID {emp.employeeId}</div>
                          </div>
                          {/* Today badge */}
                          <span style={{
                            fontSize: '0.6rem', fontWeight: 700, borderRadius: 99,
                            padding: '2px 6px', flexShrink: 0,
                            background: todaySt === 'full' ? 'rgba(52,211,153,0.15)' :
                                        todaySt === 'signin-only' ? 'rgba(124,58,237,0.15)' :
                                        todaySt === 'leave' ? 'rgba(245,158,11,0.15)' : 'var(--surface-s)',
                            color: todaySt === 'full' ? '#34d399' :
                                   todaySt === 'signin-only' ? '#a78bfa' :
                                   todaySt === 'leave' ? '#fbbf24' : 'var(--text-3)',
                          }}>
                            {todaySt === 'full' ? 'IN/OUT' : todaySt === 'signin-only' ? 'IN' : todaySt === 'leave' ? 'ABS' : '—'}
                          </span>
                        </div>
                      </td>

                      {/* Date cells */}
                      {matrixDays.map(day => {
                        const st   = getAttStatus(empRecs, day.str);
                        const meta = STATUS_META[st];
                        const isToday = day.str === today;
                        return (
                          <td key={day.str}
                              title={`${emp.name || emp.email?.split('@')[0]} · ${day.short} · ${meta.tip}`}
                              style={{
                                borderBottom: '1px solid var(--border)',
                                borderLeft:   '1px solid var(--border)',
                                padding: '0.4rem 0.25rem',
                                textAlign: 'center',
                                background: isToday ? `rgba(124,58,237,0.04)` : rowBg,
                                transition: 'background 0.15s',
                              }}>
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 28, height: 28, borderRadius: 7,
                              fontSize: '0.75rem', fontWeight: 700,
                              background: st === 'future' ? 'transparent' : meta.bg + (st === 'future' ? '' : '33'),
                              color: st === 'future' ? 'var(--text-3)' : meta.bg,
                              outline: isToday ? '2px solid #7c3aed44' : 'none',
                              outlineOffset: 1,
                            }}>
                              {meta.label}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '0.75rem 1.25rem',
            padding: '0.75rem 1rem',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-s)',
          }}>
            {[
              { st: 'full',          label: 'Present (In + Out)' },
              { st: 'signin-only',   label: 'Signed in only' },
              { st: 'signout-only',  label: 'Signed out only' },
              { st: 'leave',         label: 'Absent / Leave' },
              { st: 'future',        label: 'Not yet applicable' },
            ].map(({ st, label }) => {
              const meta = STATUS_META[st];
              return (
                <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: st === 'future' ? 'var(--surface-s)' : meta.bg + '33',
                    color: st === 'future' ? 'var(--text-3)' : meta.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.65rem', fontWeight: 700,
                    border: '1px solid ' + (st === 'future' ? 'var(--border)' : meta.bg + '55'),
                  }}>
                    {meta.label}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 500 }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Raw records list ── */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-b"
             style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text)' }}>All Attendance Records</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              Showing {filteredAttRecords.length} of {attendance.length} records
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input type="date" value={attFilterDate} onChange={e => setAttFilterDate(e.target.value)}
                   className="input-field text-sm py-2 px-3 w-40" style={{ colorScheme: 'auto' }} />
            <input type="text" value={attSearchName} onChange={e => setAttSearchName(e.target.value)}
                   placeholder="Search by name…" className="input-field text-sm py-2 px-3 w-44" />
            {(attFilterDate || attSearchName) && (
              <button onClick={() => { setAttFilterDate(''); setAttSearchName(''); }}
                      className="btn-secondary text-sm py-2 px-3">Clear</button>
            )}
          </div>
        </div>

        {loadingAtt ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 rounded-full animate-spin"
                 style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }} />
          </div>
        ) : filteredAttRecords.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>No attendance records found.</p>
          </div>
        ) : (
          <div>
            {filteredAttRecords.map(rec => (
              <div key={rec.id} className="flex items-start gap-4 px-5 py-4 transition-colors border-b last:border-b-0"
                   style={{ borderColor: 'var(--border)' }}
                   onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-s)'}
                   onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {(rec.photoBase64 || rec.photoURL)
                  ? <img src={rec.photoBase64 || rec.photoURL} alt={rec.employeeName}
                           className="w-12 h-12 rounded-xl object-cover flex-shrink-0 cursor-pointer hover:scale-105 transition-transform"
                           style={{ border: '2px solid var(--border)' }}
                           onClick={() => setExpandedPhoto(rec.photoBase64 || rec.photoURL)} />
                  : <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-sm"
                         style={{ background: 'linear-gradient(135deg,#7c3aed22,#3b82f622)', color: '#a78bfa' }}>
                      {(rec.employeeName || '?').charAt(0).toUpperCase()}
                    </div>
                }
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{rec.employeeName}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={rec.type === 'signin'
                            ? { background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }
                            : rec.type === 'signout'
                            ? { background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }
                            : { background: 'rgba(16,185,129,0.1)', color: '#6ee7b7' }}>
                      {rec.type === 'signin' ? '↗ Sign In' : rec.type === 'signout' ? '↙ Sign Out' : 'Submitted'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>ID: {rec.employeeId}</span>
                  </div>
                  <p className="text-xs mb-1.5" style={{ color: '#60a5fa' }}>
                    {formatDate(rec.date)} &nbsp;·&nbsp; {formatIST(rec.submittedAt)}
                  </p>
                  <p className="text-sm line-clamp-2" style={{ color: 'var(--text-2)' }}>{rec.workSummary}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Dashboard page ───────────────────────────────────────── */
function DashboardPage({ employees, attendance, loadingEmp, loadingAtt, filterDate, setFilterDate,
                         filterName, setFilterName, filteredAttendance, setExpandedPhoto,
                         adminTodos, onNavigate, user }) {
  const today = todayIST();
  const todaySignIns  = attendance.filter(a => a.date === today && a.type === 'signin').length;
  const todaySignOuts = attendance.filter(a => a.date === today && a.type === 'signout').length;

  // Today's split records for the C panel
  const todaySignInRecs  = attendance.filter(r => r.date === today && r.type === 'signin');
  const todaySignOutRecs = attendance.filter(r => r.date === today && r.type === 'signout');
  const todayEmpMap = {};
  attendance.filter(r => r.date === today).forEach(r => {
    const key = r.employeeUid || r.employeeId;
    if (key && !todayEmpMap[key]) todayEmpMap[key] = {};
    if (key) todayEmpMap[key][r.type] = r;
  });
  const calcWorkHours = (inRec, outRec) => {
    if (!inRec || !outRec) return null;
    const a = inRec.submittedAt?.toDate?.()  || new Date(inRec.submittedAt  || 0);
    const b = outRec.submittedAt?.toDate?.() || new Date(outRec.submittedAt || 0);
    const ms = Math.abs(b - a);
    if (ms < 60000) return null;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };
  const completePairs = Object.values(todayEmpMap).filter(e => e.signin && e.signout);
  const totalWorkMs = completePairs.reduce((sum, e) => {
    const a = e.signin.submittedAt?.toDate?.()  || new Date(0);
    const b = e.signout.submittedAt?.toDate?.() || new Date(0);
    return sum + Math.abs(b - a);
  }, 0);
  const totalWorkStr = (() => {
    if (!completePairs.length) return null;
    const h = Math.floor(totalWorkMs / 3600000);
    const m = Math.floor((totalWorkMs % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  })();

  const pendingTodos   = (adminTodos || []).filter(t => !t.completed);
  const PRIORITY_COLOR = { high: '#f87171', medium: '#fbbf24', low: '#34d399' };

  // Live clock
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  // Team Target + meetings aggregate
  const [teamTarget, setTeamTarget] = useState(null);
  const [teamMeet,   setTeamMeet]   = useState({ completed: 0, scheduled: 0 });
  const currentMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).slice(0, 7);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'teamTargets', `${user.uid}_${currentMonth}`), snap => {
      setTeamTarget(snap.exists() ? snap.data() : null);
    });
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'meetings'), where('month', '==', currentMonth));
    return onSnapshot(q, snap => {
      const comp   = snap.docs.reduce((s, d) => s + (d.data().completed || 0), 0);
      const sched  = snap.docs.reduce((s, d) => s + (d.data().scheduled || 0), 0);
      const empTgt = snap.docs.reduce((s, d) => s + (d.data().target    || 0), 0);
      setTeamMeet({ completed: comp, scheduled: sched, empTarget: empTgt });
    });
  }, []);

  // Use manual team target if set, otherwise fall back to sum of employee targets
  const tgt = teamTarget?.target || teamMeet.empTarget || 0;
  const pct = tgt > 0 ? Math.min(teamMeet.completed / tgt, 1) : 0;
  const R = 36, CIRC = 2 * Math.PI * R;

  const istHour = parseInt(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(clock), 10);
  const greetWord = istHour < 12 ? 'Morning' : istHour < 17 ? 'Afternoon' : 'Evening';
  const fullDate  = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(clock);
  const timeStr   = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(clock);

  // Todo groups by date
  const todayTodos    = pendingTodos.filter(t => !t.date || t.date === today).slice(0, 6);
  const tomorrowTodos = pendingTodos.filter(t => {
    if (!t.date) return false;
    const [y, m, d] = today.split('-').map(Number);
    const tom = new Date(y, m - 1, d + 1);
    return t.date === new Intl.DateTimeFormat('en-CA').format(tom);
  }).slice(0, 3);
  const overdueTodos  = pendingTodos.filter(t => t.date && t.date < today).slice(0, 3);

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Row 1: B (greeting) + D (team target) ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 320px' }}>

        {/* B — Greeting banner */}
        <div className="rounded-xl overflow-hidden relative"
             style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)', border: '1px solid rgba(124,58,237,0.25)' }}>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 10% 50%,rgba(124,58,237,0.12) 0%,transparent 60%)' }} />
          <div className="relative p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p style={{ fontSize: 11, fontWeight: 500, color: 'rgba(167,139,250,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>Admin Dashboard</p>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>Good {greetWord} 👋</h2>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>{fullDate}</p>
              </div>
              {/* Live clock */}
              <div className="text-right flex-shrink-0">
                <p style={{ fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: 'monospace', letterSpacing: '0.02em' }}>{timeStr}</p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>IST · Live</p>
              </div>
            </div>
            {/* Daily quote */}
            <div className="mt-3 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', lineHeight: 1.5 }}>
                💡 &ldquo;{getDailyQuote()}&rdquo;
              </p>
            </div>
            {/* Mini stat chips */}
            <div className="flex gap-2 mt-3 flex-wrap">
              {[
                { label: 'Employees', value: employees.length, color: '#a78bfa' },
                { label: 'Sign-ins Today', value: todaySignIns, color: '#34d399' },
                { label: 'Sign-outs Today', value: todaySignOuts, color: '#60a5fa' },
                { label: 'Total Records', value: attendance.length, color: '#fbbf24' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                     style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{s.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ml-auto"
                   style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span style={{ fontSize: 10, color: '#10b981', fontWeight: 500 }}>System Online</span>
              </div>
            </div>
          </div>
        </div>

        {/* D — Team Target widget */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid rgba(20,184,166,0.35)', boxShadow: '0 0 0 1px rgba(20,184,166,0.06), 0 4px 16px rgba(20,184,166,0.08)' }}>
          <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ borderColor: 'rgba(20,184,166,0.2)', background: 'rgba(20,184,166,0.05)' }}>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: '#14b8a6' }} />
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#14b8a6' }}>Team Target</span>
            </div>
            <button onClick={() => onNavigate('team-target')} style={{ fontSize: 10, color: '#14b8a6', fontWeight: 500 }}>Manage →</button>
          </div>
          <div className="p-4">
            {/* Month label */}
            <p style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 10 }}>
              {new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date())}
            </p>
            {tgt === 0 && teamMeet.completed === 0 && teamMeet.scheduled === 0 ? (
              <div className="text-center py-4">
                <p style={{ fontSize: 11, color: 'var(--text-3)' }}>No target set for this month</p>
                <button onClick={() => onNavigate('team-target')} className="btn-primary mt-2" style={{ fontSize: 11 }}>Set Target</button>
              </div>
            ) : (
              <>
                {/* Ring + numbers */}
                <div className="flex items-center gap-3">
                  <svg width={88} height={88} style={{ flexShrink: 0 }}>
                    <defs>
                      <linearGradient id="dt-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#7c3aed" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </linearGradient>
                    </defs>
                    <circle cx={44} cy={44} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} />
                    <circle cx={44} cy={44} r={R} fill="none" stroke="url(#dt-ring)" strokeWidth={7}
                      strokeLinecap="round"
                      strokeDasharray={`${CIRC * pct} ${CIRC}`}
                      transform="rotate(-90 44 44)"
                      style={{ transition: 'stroke-dasharray 1s', filter: 'drop-shadow(0 0 5px #7c3aed60)' }} />
                    <text x={44} y={40} textAnchor="middle" fill="white" fontSize={16} fontWeight={700}>{Math.round(pct * 100)}%</text>
                    <text x={44} y={54} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={9}>done</text>
                  </svg>
                  <div className="flex-1 space-y-2">
                    {[
                      { label: 'Target',    value: tgt || '—',                                  color: '#60a5fa' },
                      { label: 'Completed', value: teamMeet.completed,                          color: '#10b981' },
                      { label: 'Scheduled', value: teamMeet.scheduled,                          color: '#f59e0b' },
                      { label: 'Remaining', value: tgt > 0 ? Math.max(0, tgt - teamMeet.completed) : '—', color: '#f87171' },
                    ].map(s => (
                      <div key={s.label} className="flex items-center justify-between">
                        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{s.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-3">
                  <div style={{ height: 4, borderRadius: 99, background: 'var(--surface-s)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct * 100}%`, background: 'linear-gradient(90deg,#7c3aed,#3b82f6)', borderRadius: 99, transition: 'width 1s' }} />
                  </div>
                </div>
                {!teamTarget?.target && tgt > 0 && (
                  <p style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 6, textAlign: 'center' }}>
                    Target auto-calculated from employee assignments
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: C (attendance) + E (todo) ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 320px' }}>

      {/* C — Today's Attendance Split Panel */}
      <div className="rounded-xl overflow-hidden flex flex-col" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>

        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between flex-shrink-0 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-s)' }}>
          <div>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Today's Attendance</span>
              <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa', fontSize: 10 }}>
                {new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())}
              </span>
            </div>
          </div>
          <button onClick={() => onNavigate('attendance')} style={{ fontSize: 10, color: '#60a5fa', fontWeight: 500, flexShrink: 0 }}>All Records →</button>
        </div>

        {/* Paired employee rows */}
        {loadingAtt ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col" style={{ borderBottom: '1px solid var(--border)' }}>
            {/* Column headers */}
            <div className="grid grid-cols-2 flex-shrink-0">
              <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: 'rgba(124,58,237,0.06)', borderBottom: '1px solid rgba(124,58,237,0.12)', borderRight: '1px solid var(--border)' }}>
                <svg className="w-3 h-3 flex-shrink-0" style={{ color: '#a78bfa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 16l-4-4m0 0l4-4m-4 4h14" />
                </svg>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sign In</span>
                <span className="ml-auto px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', fontSize: 10 }}>{todaySignIns}</span>
              </div>
              <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: 'rgba(16,185,129,0.06)', borderBottom: '1px solid rgba(16,185,129,0.12)' }}>
                <svg className="w-3 h-3 flex-shrink-0" style={{ color: '#34d399' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 9l3 3m0 0l-3 3m3-3H8" />
                </svg>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sign Out</span>
                <span className="ml-auto px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', fontSize: 10 }}>{todaySignOuts}</span>
              </div>
            </div>
            {/* Paired rows — one per employee */}
            <div style={{ overflowY: 'auto', maxHeight: 280 }}>
              {Object.keys(todayEmpMap).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-1">
                  <svg className="w-6 h-6" style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p style={{ fontSize: 11, color: 'var(--text-3)' }}>No attendance records yet</p>
                </div>
              ) : Object.entries(todayEmpMap).map(([empKey, empRecs]) => {
                const signIn  = empRecs.signin;
                const signOut = empRecs.signout;
                const hrs = calcWorkHours(signIn, signOut);
                const name = (signIn || signOut)?.employeeName || '—';
                const inPhoto  = signIn?.photoBase64  || signIn?.photoURL;
                const outPhoto = signOut?.photoBase64 || signOut?.photoURL;
                return (
                  <div key={empKey} className="grid grid-cols-2" style={{ borderBottom: '1px solid var(--border)' }}>
                    {/* Sign In cell */}
                    <div className="flex items-center gap-2 px-3 py-2.5"
                         style={{ borderRight: '1px solid var(--border)' }}
                         onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.04)'}
                         onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ width: 26, height: 26, borderRadius: 7, overflow: 'hidden', flexShrink: 0, border: '1.5px solid rgba(124,58,237,0.25)', background: 'linear-gradient(135deg,#7c3aed22,#3b82f622)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: inPhoto ? 'pointer' : 'default' }}
                           onClick={() => inPhoto && setExpandedPhoto(inPhoto)}>
                        {inPhoto ? <img src={inPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 9, fontWeight: 700, color: '#a78bfa' }}>{name.charAt(0).toUpperCase()}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-semibold" style={{ fontSize: 11, color: 'var(--text)' }}>{name}</p>
                        {signIn
                          ? <p style={{ fontSize: 10, color: '#a78bfa' }}>{formatTimeOnly(signIn.submittedAt)}</p>
                          : <p style={{ fontSize: 10, color: 'var(--text-3)' }}>—</p>}
                      </div>
                    </div>
                    {/* Sign Out cell */}
                    <div className="flex items-center gap-2 px-3 py-2.5"
                         onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.04)'}
                         onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      {signOut ? (
                        <>
                          <div style={{ width: 26, height: 26, borderRadius: 7, overflow: 'hidden', flexShrink: 0, border: '1.5px solid rgba(16,185,129,0.25)', background: 'linear-gradient(135deg,#10b98122,#34d39922)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: outPhoto ? 'pointer' : 'default' }}
                               onClick={() => outPhoto && setExpandedPhoto(outPhoto)}>
                            {outPhoto ? <img src={outPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 9, fontWeight: 700, color: '#34d399' }}>{name.charAt(0).toUpperCase()}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-semibold" style={{ fontSize: 11, color: 'var(--text)' }}>{name}</p>
                            <p style={{ fontSize: 10, color: '#34d399' }}>{formatTimeOnly(signOut.submittedAt)}</p>
                          </div>
                          {hrs && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 rounded font-semibold" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', fontSize: 9 }}>
                              ⏱{hrs}
                            </span>
                          )}
                        </>
                      ) : (
                        <p style={{ fontSize: 10, color: 'var(--text-3)', paddingLeft: 4 }}>Not yet</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer summary bar */}
        <div className="px-4 py-2 flex items-center gap-4 flex-shrink-0" style={{ background: 'var(--surface-s)', borderTop: '1px solid var(--border)' }}>
          {[
            { label: 'Signed In',  value: todaySignIns,       color: '#a78bfa' },
            { label: 'Signed Out', value: todaySignOuts,      color: '#34d399' },
            { label: 'Full Day',   value: completePairs.length, color: '#10b981' },
            ...(totalWorkStr ? [{ label: 'Total Hours', value: totalWorkStr, color: '#fbbf24' }] : []),
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</span>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* E — My To-Do */}
      <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: 'var(--surface)', border: '1px solid rgba(167,139,250,0.35)', boxShadow: '0 0 0 1px rgba(124,58,237,0.06), 0 4px 16px rgba(124,58,237,0.08)' }}>
        <div className="px-4 py-2.5 flex items-center justify-between border-b flex-shrink-0" style={{ borderColor: 'rgba(124,58,237,0.2)', background: 'rgba(124,58,237,0.05)' }}>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: '#a78bfa' }} />
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#a78bfa' }}>My To-Do</span>
          </div>
          <button onClick={() => onNavigate('my-todo')} style={{ fontSize: 10, color: '#a78bfa', fontWeight: 500 }}>Manage →</button>
        </div>
        <div className="flex flex-1" style={{ borderColor: 'var(--border)', maxHeight: 340 }}>
          {/* Left: To-Do list */}
          <div className="flex-1 min-w-0 overflow-y-auto" style={{ borderRight: '1px solid var(--border)' }}>
            {(overdueTodos.length + todayTodos.length + tomorrowTodos.length) === 0 ? (
              <div className="text-center py-8">
                <p style={{ fontSize: 11, color: 'var(--text-3)' }}>All caught up! No pending items.</p>
              </div>
            ) : (
              <div className="p-3 space-y-3">
                {overdueTodos.length > 0 && (
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#f87171', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>⚠</span> Overdue
                    </p>
                    <div className="space-y-1.5">
                      {overdueTodos.map(t => (
                        <div key={t.id} className="flex items-start gap-2 px-3 py-2 rounded-lg"
                             style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
                          <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#f87171' }} />
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium" style={{ fontSize: 11, color: 'var(--text)' }}>{t.title}</p>
                            {t.date && <p style={{ fontSize: 10, color: '#f87171', marginTop: 1 }}>{t.date}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {todayTodos.length > 0 && (
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#a78bfa', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>◈</span> Today
                    </p>
                    <div className="space-y-1.5">
                      {todayTodos.map(t => (
                        <div key={t.id} className="flex items-start gap-2 px-3 py-2 rounded-lg"
                             style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.12)' }}>
                          <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                               style={{ background: PRIORITY_COLOR[t.priority] || '#a78bfa' }} />
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium" style={{ fontSize: 11, color: 'var(--text)' }}>{t.title}</p>
                            <p style={{ fontSize: 10, color: '#a78bfa', marginTop: 1 }}>Today</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {tomorrowTodos.length > 0 && (
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#60a5fa', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>→</span> Tomorrow
                    </p>
                    <div className="space-y-1.5">
                      {tomorrowTodos.map(t => (
                        <div key={t.id} className="flex items-start gap-2 px-3 py-2 rounded-lg"
                             style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}>
                          <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                               style={{ background: PRIORITY_COLOR[t.priority] || '#60a5fa' }} />
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium" style={{ fontSize: 11, color: 'var(--text)' }}>{t.title}</p>
                            <p style={{ fontSize: 10, color: '#60a5fa', marginTop: 1 }}>Tomorrow</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Right: US Clock */}
          <div className="flex-shrink-0 p-3 flex flex-col justify-center gap-2" style={{ width: 148 }}>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: 4, textAlign: 'center' }}>🇺🇸 US Time</p>
            {[
              { label: 'ET', tz: 'America/New_York',    color: '#a78bfa' },
              { label: 'CT', tz: 'America/Chicago',     color: '#60a5fa' },
              { label: 'MT', tz: 'America/Denver',      color: '#34d399' },
              { label: 'PT', tz: 'America/Los_Angeles', color: '#fbbf24' },
            ].map(z => (
              <div key={z.label} className="flex items-center justify-between px-2 py-1.5 rounded-lg"
                   style={{ background: 'var(--surface-s)', border: `1px solid ${z.color}22` }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: z.color, minWidth: 22 }}>{z.label}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', fontFamily: 'monospace' }}>
                  {new Intl.DateTimeFormat('en-US', { timeZone: z.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(clock)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="px-4 py-2 border-t flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface-s)' }}>
          <p style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center' }}>
            {pendingTodos.length} pending item{pendingTodos.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  </div>
  );
}

/* ── Employees page ───────────────────────────────────────── */
function EmployeesPage({ employees, loadingEmp, onEdit, navigate }) {
  const [search, setSearch] = useState('');
  const filtered = employees.filter(e =>
    !search ||
    e.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.email?.toLowerCase().includes(search.toLowerCase()) ||
    String(e.employeeId)?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold" style={{ color: 'var(--text)' }}>Team Members</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
            {employees.length} employee{employees.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <button onClick={() => navigate('/admin/add-employee')} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Employee
        </button>
      </div>

      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
             style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
               placeholder="Search by name, email, or ID…" className="input-field pl-10" />
      </div>

      {loadingEmp ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
               style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 rounded-2xl" style={{ border: '1px dashed var(--border)' }}>
          <p className="font-medium mb-1" style={{ color: 'var(--text-2)' }}>
            {search ? 'No employees match your search' : 'No employees yet'}
          </p>
          {!search && (
            <button onClick={() => navigate('/admin/add-employee')} className="btn-primary mt-4">Add First Employee</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {filtered.map(emp => <EmployeeCard key={emp.id} employee={emp} onClick={onEdit} />)}
        </div>
      )}
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────── */
export default function AdminDashboard({ user }) {
  const navigate = useNavigate();
  const [page, setPage]               = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [employees, setEmployees]     = useState([]);
  const [attendance, setAttendance]   = useState([]);
  const [loadingEmp, setLoadingEmp]   = useState(true);
  const [loadingAtt, setLoadingAtt]   = useState(true);
  const [expandedPhoto, setExpandedPhoto] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [adminProfile, setAdminProfile] = useState(null);
  const [filterDate, setFilterDate]   = useState('');
  const [filterName, setFilterName]   = useState('');
  const [adminNotifs,   setAdminNotifs]   = useState([]);
  const [adminUnread,   setAdminUnread]   = useState(0);
  const [adminTodos,    setAdminTodos]    = useState([]);

  // Admin todos listener
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'todos'), where('uid', '==', user.uid));
    return onSnapshot(q, snap => {
      const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      todos.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      setAdminTodos(todos);
    }, err => console.error('adminTodos:', err));
  }, [user]);

  // Real-time admin notifications listener
  useEffect(() => {
    const q = query(collection(db, 'notifications'), where('targetRole', '==', 'admin'));
    const unsub = onSnapshot(q, snap => {
      const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      notifs.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setAdminNotifs(notifs);
      setAdminUnread(notifs.filter(n => !n.seen).length);
    }, err => console.error('adminNotifs:', err));
    return () => unsub();
  }, []);

  const handleAdminMarkAllRead = async () => {
    try {
      const batch = writeBatch(db);
      adminNotifs.filter(n => !n.seen).forEach(n => batch.update(doc(db, 'notifications', n.id), { seen: true }));
      await batch.commit();
    } catch (err) { console.error(err); }
  };

  // Real-time employees listener — sort client-side, no orderBy index dependency
  useEffect(() => {
    setLoadingEmp(true);
    const unsub = onSnapshot(
      collection(db, 'employees'),
      snap => {
        const emps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        emps.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setEmployees(emps);
        setLoadingEmp(false);
      },
      err => { console.error('employees listener:', err); setLoadingEmp(false); }
    );
    return () => unsub();
  }, []);

  // Real-time attendance listener — no orderBy to avoid composite-index requirements
  useEffect(() => {
    setLoadingAtt(true);
    const unsub = onSnapshot(
      collection(db, 'attendance'),
      snap => {
        const recs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        recs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setAttendance(recs);
        setLoadingAtt(false);
      },
      err => { console.error('attendance listener:', err); setLoadingAtt(false); }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'adminProfile', user.uid));
        if (snap.exists()) setAdminProfile(snap.data());
      } catch {}
    })();
  }, [user.uid]);


  const filteredAttendance = attendance.filter(rec => {
    const dateMatch = filterDate ? rec.date === filterDate : true;
    const nameMatch = filterName ? rec.employeeName?.toLowerCase().includes(filterName.toLowerCase()) : true;
    return dateMatch && nameMatch;
  });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <Navbar user={user} role="admin" avatarSrc={adminProfile?.photoURL}
              onViewProfile={() => setShowProfile(true)}
              notifications={adminNotifs.map(n => ({
                id:             n.id,
                title:          n.taskTitle || 'Task',
                assignedByName: `${n.employeeName || 'Employee'} → ${n.newStatus === 'in-progress' ? 'In Progress' : n.newStatus === 'completed' ? 'Completed' : 'Pending'}`,
                dueDate:        null,
                seen:           n.seen,
                createdAt:      n.createdAt,
                priority:       n.newStatus === 'completed' ? 'low' : n.newStatus === 'in-progress' ? 'medium' : 'high',
                status:         null,
              }))}
              unreadCount={adminUnread}
              onNotifClick={() => setPage('assign-task')}
              onMarkAllRead={handleAdminMarkAllRead}
      />

      {showProfile && <ProfileModal user={user} role="admin" onClose={() => setShowProfile(false)} />}

      {editingEmployee && (
        <EditEmployeeModal
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
          onUpdated={updated => { setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e)); setEditingEmployee(null); }}
          onDeleted={id => { setEmployees(prev => prev.filter(e => e.id !== id)); setEditingEmployee(null); }}
        />
      )}

      {expandedPhoto && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
             onClick={() => setExpandedPhoto(null)}>
          <img src={expandedPhoto} alt="" className="max-w-full max-h-full rounded-2xl shadow-2xl" />
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white"
                  style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
                  onClick={() => setExpandedPhoto(null)}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex flex-1 relative">
        {/* Mobile FAB */}
        <button className="fixed bottom-5 left-5 z-40 md:hidden w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl text-white"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}
                onClick={() => setSidebarOpen(v => !v)}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <Sidebar page={page} setPage={setPage} employeeCount={employees.length}
                 mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

        <main className="flex-1 min-w-0 p-5 lg:p-8 overflow-auto">
          {page === 'dashboard' && (
            <DashboardPage
              employees={employees} attendance={attendance}
              loadingEmp={loadingEmp} loadingAtt={loadingAtt}
              filterDate={filterDate} setFilterDate={setFilterDate}
              filterName={filterName} setFilterName={setFilterName}
              filteredAttendance={filteredAttendance}
              setExpandedPhoto={setExpandedPhoto}
              adminTodos={adminTodos} onNavigate={setPage} user={user}
            />
          )}
          {page === 'employees' && (
            <EmployeesPage employees={employees} loadingEmp={loadingEmp}
                           onEdit={setEditingEmployee} navigate={navigate} />
          )}
          {page === 'attendance' && (
            <AttendancePage employees={employees} attendance={attendance}
                            loadingEmp={loadingEmp} loadingAtt={loadingAtt}
                            setExpandedPhoto={setExpandedPhoto} />
          )}
          {page === 'assign-task' && (
            <AssignTaskPage user={user} employees={employees} />
          )}
          {page === 'my-todo' && (
            <TodoPage user={user} title="My To-Do" />
          )}
          {page === 'my-notes' && (
            <NotesPage user={user} />
          )}
          {page === 'my-credentials' && (
            <CredentialsPage user={user} />
          )}
          {page === 'assign-meeting' && (
            <AssignMeetingTarget user={user} employees={employees} />
          )}
          {page === 'meeting-report' && (
            <MeetingReport user={user} />
          )}
          {page === 'team-target' && (
            <TeamTargetPage user={user} />
          )}
          {page === 'campaigns' && (
            <CampaignsPage user={user} employees={employees} />
          )}
          {page === 'profile-setup' && (
            <ProfileSetupSettings />
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
