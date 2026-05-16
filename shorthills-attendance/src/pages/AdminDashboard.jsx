import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc, writeBatch } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import Navbar from '../components/Navbar';
import EmployeeCard from '../components/EmployeeCard';
import EditEmployeeModal from '../components/EditEmployeeModal';
import ProfileModal from '../components/ProfileModal';
import AssignTaskPage from '../components/AssignTaskPage';
import TodoPage from '../components/TodoPage';
import NotesPage from '../components/NotesPage';

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
    const match =
      r.employeeUid === employee.id ||
      r.employeeId  === employee.id ||
      (employee.employeeId && r.employeeId === employee.employeeId);
    if (match && !seen.has(r.id)) { seen.add(r.id); return true; }
    return false;
  });
}

/* ── Sidebar ──────────────────────────────────────────────── */
function Sidebar({ page, setPage, employeeCount, mobileOpen, setMobileOpen }) {
  const items = [
    {
      id: 'dashboard', label: 'Dashboard',
      icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    },
    {
      id: 'employees', label: 'Employees', badge: employeeCount,
      icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    },
    {
      id: 'attendance', label: 'Attendance',
      icon: <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
    },
    {
      id: 'assign-task', label: 'Assign Task',
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
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Admin Panel</p>
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
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={active ? { background: 'rgba(255,255,255,0.25)', color: '#fff' } : { background: 'var(--surface-s)', color: 'var(--text-3)' }}>
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

/* ── Attendance page ──────────────────────────────────────── */
function AttendancePage({ employees, attendance, loadingEmp, loadingAtt, setExpandedPhoto }) {
  const [selected, setSelected] = useState(null);
  const today = todayIST();

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
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold" style={{ color: 'var(--text)' }}>Attendance</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
          Click any employee to view their detailed attendance records
        </p>
      </div>

      {loadingEmp ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
               style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {employees.map(emp => {
            const empRecs   = getEmpRecords(attendance, emp);
            const todayRecs = empRecs.filter(r => r.date === today);
            const signedIn  = todayRecs.some(r => r.type === 'signin');
            const signedOut = todayRecs.some(r => r.type === 'signout');
            const monthRecs = empRecs.filter(r => r.date.startsWith(today.slice(0, 7)));

            return (
              <div key={emp.id} onClick={() => setSelected(emp)}
                   className="group rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl animate-fade-in"
                   style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                   onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed55'}
                   onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border-2"
                       style={{ borderColor: '#7c3aed33', background: 'linear-gradient(135deg,#7c3aed22,#3b82f622)' }}>
                    {emp.photoURL
                      ? <img src={emp.photoURL} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center font-bold text-violet-400">
                          {(emp.name || emp.email || '?').charAt(0).toUpperCase()}
                        </div>
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate text-sm" style={{ color: 'var(--text)' }}>
                      {emp.name || emp.email?.split('@')[0]}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>ID: {emp.employeeId}</p>
                  </div>
                </div>

                {/* Today's status */}
                <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold px-3 py-2 rounded-xl"
                     style={signedIn && signedOut ? { background: 'rgba(52,211,153,0.12)', color: '#34d399' }
                           : signedIn             ? { background: 'rgba(124,58,237,0.12)', color: '#a78bfa' }
                           :                        { background: 'var(--surface-s)', color: 'var(--text-3)' }}>
                  <span className={`w-1.5 h-1.5 rounded-full ${signedIn ? 'animate-pulse' : ''}`}
                        style={{ background: signedIn && signedOut ? '#34d399' : signedIn ? '#a78bfa' : 'var(--text-3)' }} />
                  {signedIn && signedOut ? 'Shift complete' : signedIn ? 'Currently in' : 'Not signed in'}
                </div>

                <div className="flex justify-between text-xs" style={{ color: 'var(--text-3)' }}>
                  <span>This month</span>
                  <span className="font-semibold" style={{ color: 'var(--text-2)' }}>{monthRecs.length} records</span>
                </div>

                <div className="mt-3 flex items-center justify-end gap-1 text-xs font-medium group-hover:gap-2 transition-all"
                     style={{ color: '#a78bfa' }}>
                  View details
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Dashboard page ───────────────────────────────────────── */
function DashboardPage({ employees, attendance, loadingEmp, loadingAtt, filterDate, setFilterDate,
                         filterName, setFilterName, filteredAttendance, setExpandedPhoto }) {
  const today = todayIST();
  const todaySignIns  = attendance.filter(a => a.date === today && a.type === 'signin').length;
  const todaySignOuts = attendance.filter(a => a.date === today && a.type === 'signout').length;

  return (
    <div className="space-y-7 animate-fade-in">

      {/* Hero banner */}
      <div className="relative rounded-3xl overflow-hidden p-6 lg:p-8"
           style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#3b82f6 60%,#06b6d4 100%)' }}>
        <div className="absolute inset-0 opacity-20"
             style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #ffffff 0%, transparent 50%), radial-gradient(circle at 80% 20%, #ffffff 0%, transparent 40%)' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-white/70 text-sm font-medium mb-1">
              {new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
            </p>
            <h1 className="text-2xl lg:text-3xl font-black text-white">{greet()}, Admin 👋</h1>
            <p className="text-white/60 text-sm mt-1">Here's what's happening with your team today.</p>
          </div>
          <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm px-4 py-2 rounded-2xl w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            <span className="text-white text-sm font-semibold">System Online</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Employees"  value={employees.length} sub="registered members"
          gradient="linear-gradient(135deg,#7c3aed,#3b82f6)" loading={loadingEmp}
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <StatCard label="Sign Ins Today" value={todaySignIns} sub="punched in"
          gradient="linear-gradient(135deg,#7c3aed,#a855f7)" loading={loadingAtt}
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>}
        />
        <StatCard label="Sign Outs Today" value={todaySignOuts} sub="completed shift"
          gradient="linear-gradient(135deg,#10b981,#34d399)" loading={loadingAtt}
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>}
        />
        <StatCard label="Total Records" value={attendance.length} sub="all time"
          gradient="linear-gradient(135deg,#f59e0b,#fbbf24)" loading={loadingAtt}
          icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
        />
      </div>

      {/* Attendance records */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-b"
             style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text)' }}>Attendance Records</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              Showing {filteredAttendance.length} of {attendance.length} records
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                   className="input-field text-sm py-2 px-3 w-40" style={{ colorScheme: 'auto' }} />
            <input type="text" value={filterName} onChange={e => setFilterName(e.target.value)}
                   placeholder="Search by name…" className="input-field text-sm py-2 px-3 w-44" />
            {(filterDate || filterName) && (
              <button onClick={() => { setFilterDate(''); setFilterName(''); }}
                      className="btn-secondary text-sm py-2 px-3">Clear</button>
            )}
          </div>
        </div>

        {loadingAtt ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
                 style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }} />
          </div>
        ) : filteredAttendance.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>No attendance records found.</p>
          </div>
        ) : (
          <div>
            {filteredAttendance.map(rec => (
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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

  const fetchEmployees = useCallback(async () => {
    setLoadingEmp(true);
    try {
      const snap = await getDocs(query(collection(db, 'employees'), orderBy('createdAt', 'desc')));
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    finally { setLoadingEmp(false); }
  }, []);

  const fetchAttendance = useCallback(async () => {
    setLoadingAtt(true);
    try {
      const snap = await getDocs(query(collection(db, 'attendance'), orderBy('date', 'desc')));
      setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    finally { setLoadingAtt(false); }
  }, []);

  useEffect(() => { fetchEmployees(); fetchAttendance(); }, [fetchEmployees, fetchAttendance]);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'adminProfile', user.uid));
        if (snap.exists()) setAdminProfile(snap.data());
      } catch {}
    })();
  }, [user.uid]);

  // Auto-delete orphaned attendance records once both datasets are loaded
  const cleanedRef = useRef(false);
  useEffect(() => {
    if (loadingEmp || loadingAtt || cleanedRef.current) return;
    cleanedRef.current = true;

    const validUids   = new Set(employees.map(e => e.id));
    const validEmpIds = new Set(employees.map(e => e.employeeId).filter(Boolean));

    const orphans = attendance.filter(rec => {
      if (rec.employeeUid && validUids.has(rec.employeeUid))   return false;
      if (rec.employeeId  && validUids.has(rec.employeeId))    return false;
      if (rec.employeeId  && validEmpIds.has(rec.employeeId))  return false;
      return true;
    });

    if (orphans.length === 0) return;

    (async () => {
      try {
        // Firestore batch limit is 500; chunk if needed
        for (let i = 0; i < orphans.length; i += 400) {
          const batch = writeBatch(db);
          orphans.slice(i, i + 400).forEach(rec =>
            batch.delete(doc(db, 'attendance', rec.id))
          );
          await batch.commit();
        }
        setAttendance(prev => prev.filter(r => !orphans.some(o => o.id === r.id)));
      } catch (err) {
        console.error('Orphan cleanup failed:', err);
      }
    })();
  }, [loadingEmp, loadingAtt, employees, attendance]);

  const filteredAttendance = attendance.filter(rec => {
    const dateMatch = filterDate ? rec.date === filterDate : true;
    const nameMatch = filterName ? rec.employeeName?.toLowerCase().includes(filterName.toLowerCase()) : true;
    return dateMatch && nameMatch;
  });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <Navbar user={user} role="admin" avatarSrc={adminProfile?.photoURL}
              onViewProfile={() => setShowProfile(true)} />

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
        </main>
      </div>
    </div>
  );
}
