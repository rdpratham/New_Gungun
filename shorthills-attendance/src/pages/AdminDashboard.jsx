import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import Navbar from '../components/Navbar';
import EmployeeCard from '../components/EmployeeCard';
import EditEmployeeModal from '../components/EditEmployeeModal';
import ProfileModal from '../components/ProfileModal';

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

/* ── Sidebar ──────────────────────────────────────────────── */
function Sidebar({ page, setPage, employeeCount, mobileOpen, setMobileOpen }) {
  const items = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      id: 'employees',
      label: 'Employees',
      badge: employeeCount,
      icon: (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  const inner = (
    <div className="flex flex-col h-full">
      {/* Brand strip */}
      <div className="px-4 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
          Admin Panel
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map(item => {
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setPage(item.id); setMobileOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200"
              style={active
                ? { background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff', boxShadow: '0 4px 20px rgba(124,58,237,0.35)' }
                : { color: 'var(--text-2)', background: 'transparent' }
              }
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-s)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              {item.icon}
              <span className="hidden md:inline">{item.label}</span>
              {item.badge !== undefined && (
                <span className="ml-auto hidden md:inline text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={active
                        ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                        : { background: 'var(--surface-s)', color: 'var(--text-3)' }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs text-center hidden md:block" style={{ color: 'var(--text-3)' }}>
          Garvix Ops © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden"
             style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
             onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed md:sticky top-16 z-40 h-[calc(100vh-4rem)] flex-shrink-0 transition-all duration-300
                    ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                    w-16 md:w-56 lg:w-64`}
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        {inner}
      </aside>
    </>
  );
}

/* ── Stat card ────────────────────────────────────────────── */
function StatCard({ label, value, sub, gradient, icon, loading }) {
  return (
    <div className="relative rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
         style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {/* Gradient accent bar */}
      <div className="h-1 w-full" style={{ background: gradient }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>{label}</p>
            {loading ? (
              <div className="w-12 h-8 rounded-lg animate-pulse" style={{ background: 'var(--surface-s)' }} />
            ) : (
              <p className="text-3xl font-bold" style={{ color: 'var(--text)' }}>{value}</p>
            )}
            {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{sub}</p>}
          </div>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
               style={{ background: gradient + '22', border: `1px solid ${gradient.split(',')[0].replace('linear-gradient(135deg,', '')}33` }}>
            <div style={{ color: '#a78bfa' }}>{icon}</div>
          </div>
        </div>
      </div>
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
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold" style={{ color: 'var(--text)' }}>
            {greet()}, Admin 👋
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
            {new Intl.DateTimeFormat('en-IN', {
              timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            }).format(new Date())}
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
             style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }}>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          System Online
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Employees"
          value={employees.length}
          sub="registered members"
          gradient="linear-gradient(135deg,#7c3aed,#3b82f6)"
          loading={loadingEmp}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <StatCard
          label="Sign Ins Today"
          value={todaySignIns}
          sub="punched in"
          gradient="linear-gradient(135deg,#10b981,#34d399)"
          loading={loadingAtt}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
          }
        />
        <StatCard
          label="Sign Outs Today"
          value={todaySignOuts}
          sub="completed shift"
          gradient="linear-gradient(135deg,#f59e0b,#fbbf24)"
          loading={loadingAtt}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          }
        />
        <StatCard
          label="Total Records"
          value={attendance.length}
          sub="all time"
          gradient="linear-gradient(135deg,#06b6d4,#3b82f6)"
          loading={loadingAtt}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
      </div>

      {/* Attendance records */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
        {/* Section header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-b"
             style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text)' }}>Attendance Records</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              Showing {filteredAttendance.length} of {attendance.length} records
            </p>
          </div>
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                   className="input-field text-sm py-2 px-3 w-40" style={{ colorScheme: 'auto' }} />
            <input type="text" value={filterName} onChange={e => setFilterName(e.target.value)}
                   placeholder="Search by name…" className="input-field text-sm py-2 px-3 w-44" />
            {(filterDate || filterName) && (
              <button onClick={() => { setFilterDate(''); setFilterName(''); }}
                      className="btn-secondary text-sm py-2 px-3 whitespace-nowrap">
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Records list */}
        {loadingAtt ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
                 style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }} />
          </div>
        ) : filteredAttendance.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p style={{ color: 'var(--text-3)' }} className="text-sm">No attendance records found.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ '--tw-divide-opacity': 1 }}>
            {filteredAttendance.map((rec) => (
              <div key={rec.id}
                   className="flex items-start gap-4 p-4 transition-colors duration-150"
                   style={{ borderColor: 'var(--border)' }}
                   onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-s)'}
                   onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Photo */}
                {(rec.photoBase64 || rec.photoURL) ? (
                  <img
                    src={rec.photoBase64 || rec.photoURL}
                    alt={rec.employeeName}
                    className="w-12 h-12 rounded-xl object-cover flex-shrink-0 cursor-pointer transition-transform hover:scale-105"
                    style={{ border: '2px solid var(--border)' }}
                    onClick={() => setExpandedPhoto(rec.photoBase64 || rec.photoURL)}
                    title="Click to enlarge"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-sm"
                       style={{ background: 'linear-gradient(135deg,#7c3aed33,#3b82f633)', color: '#a78bfa' }}>
                    {(rec.employeeName || '?').charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{rec.employeeName}</span>
                    {rec.type === 'signin'
                      ? <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                               style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>Sign In</span>
                      : rec.type === 'signout'
                      ? <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                               style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>Sign Out</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                               style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7' }}>Submitted</span>
                    }
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
    e.employeeId?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold" style={{ color: 'var(--text)' }}>Team Members</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
            {employees.length} employee{employees.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <button onClick={() => navigate('/admin/add-employee')}
                className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Employee
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
             style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, or ID…"
          className="input-field pl-10"
        />
      </div>

      {/* Grid */}
      {loadingEmp ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
               style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 rounded-2xl" style={{ border: '1px dashed var(--border)' }}>
          <svg className="w-14 h-14 mx-auto mb-4" style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="font-medium mb-1" style={{ color: 'var(--text-2)' }}>
            {search ? 'No employees match your search' : 'No employees yet'}
          </p>
          {!search && (
            <button onClick={() => navigate('/admin/add-employee')} className="btn-primary mt-4">
              Add First Employee
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(emp => (
            <EmployeeCard key={emp.id} employee={emp} onClick={onEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main component ───────────────────────────────────────── */
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

  const filteredAttendance = attendance.filter(rec => {
    const dateMatch = filterDate ? rec.date === filterDate : true;
    const nameMatch = filterName ? rec.employeeName?.toLowerCase().includes(filterName.toLowerCase()) : true;
    return dateMatch && nameMatch;
  });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <Navbar user={user} role="admin" avatarSrc={adminProfile?.photoURL}
              onViewProfile={() => setShowProfile(true)} />

      {showProfile && (
        <ProfileModal user={user} role="admin" onClose={() => setShowProfile(false)} />
      )}

      {editingEmployee && (
        <EditEmployeeModal
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
          onUpdated={(updated) => {
            setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
            setEditingEmployee(null);
          }}
          onDeleted={(id) => {
            setEmployees(prev => prev.filter(e => e.id !== id));
            setEditingEmployee(null);
          }}
        />
      )}

      {expandedPhoto && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
             onClick={() => setExpandedPhoto(null)}>
          <img src={expandedPhoto} alt="Attendance" className="max-w-full max-h-full rounded-2xl shadow-2xl" />
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
                  onClick={() => setExpandedPhoto(null)}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex flex-1 relative">
        {/* Mobile burger */}
        <button
          className="fixed bottom-5 left-5 z-50 md:hidden w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl text-white"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}
          onClick={() => setSidebarOpen(v => !v)}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <Sidebar
          page={page}
          setPage={setPage}
          employeeCount={employees.length}
          mobileOpen={sidebarOpen}
          setMobileOpen={setSidebarOpen}
        />

        {/* Main content */}
        <main className="flex-1 min-w-0 p-5 lg:p-8 overflow-auto">
          {page === 'dashboard' && (
            <DashboardPage
              employees={employees}
              attendance={attendance}
              loadingEmp={loadingEmp}
              loadingAtt={loadingAtt}
              filterDate={filterDate}
              setFilterDate={setFilterDate}
              filterName={filterName}
              setFilterName={setFilterName}
              filteredAttendance={filteredAttendance}
              setExpandedPhoto={setExpandedPhoto}
            />
          )}
          {page === 'employees' && (
            <EmployeesPage
              employees={employees}
              loadingEmp={loadingEmp}
              onEdit={setEditingEmployee}
              navigate={navigate}
            />
          )}
        </main>
      </div>
    </div>
  );
}
