import { useState, useRef, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { useTheme } from '../context/ThemeContext';

/* ── Time-ago helper ─────────────────────────────────────────────── */
function timeAgo(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ── Priority dot colors ─────────────────────────────────────────── */
const PRIORITY_COLOR = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#10b981',
};
const PRIORITY_BORDER = {
  high:   'rgba(239,68,68,0.6)',
  medium: 'rgba(245,158,11,0.6)',
  low:    'rgba(16,185,129,0.6)',
};

/* ── NotificationPanel ───────────────────────────────────────────── */
function NotificationPanel({ notifications, unreadCount, onNotifClick, onMarkAllRead }) {
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'

  const displayed = filter === 'unread'
    ? notifications.filter(n => !n.seen)
    : notifications;

  const shown = displayed.slice(0, 10);

  return (
    <div className="absolute right-0 top-11 w-80 sm:w-96 rounded-2xl z-50 overflow-hidden animate-slide-up"
         style={{
           background: 'var(--surface-s)',
           border: '1px solid var(--border)',
           boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
         }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3"
           style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="text-white font-bold text-sm">Notifications</span>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="text-[11px] font-medium transition-opacity hover:opacity-100"
            style={{ color: 'rgba(255,255,255,0.75)' }}>
            Mark all read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
        {[
          { key: 'all', label: 'All' },
          { key: 'unread', label: `Unread (${unreadCount})` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className="px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150"
            style={filter === tab.key
              ? { background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff' }
              : { background: 'var(--surface)', color: 'var(--text-3)', border: '1px solid var(--border)' }
            }>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
        {shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <svg className="w-10 h-10" style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>No notifications</p>
          </div>
        ) : (
          shown.map(task => {
            const dotColor    = PRIORITY_COLOR[task.priority]  || PRIORITY_COLOR.medium;
            const borderColor = PRIORITY_BORDER[task.priority] || PRIORITY_BORDER.medium;
            const isUnread    = !task.seen;
            return (
              <button
                key={task.id}
                onClick={() => onNotifClick(task)}
                className="w-full text-left flex items-start gap-3 px-4 py-3 border-b last:border-b-0 transition-colors duration-150"
                style={{
                  borderColor: 'var(--border)',
                  background: isUnread ? 'rgba(124,58,237,0.08)' : 'transparent',
                  borderLeft: `2px solid ${borderColor}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = isUnread ? 'rgba(124,58,237,0.08)' : 'transparent'; }}>

                {/* Priority dot */}
                <span className="flex-shrink-0 w-2 h-2 rounded-full mt-2"
                      style={{ background: dotColor }} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate"
                     style={{
                       color: 'var(--text)',
                       textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                     }}>
                    {task.title}
                  </p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-3)' }}>
                    {task.assignedByName ? `By ${task.assignedByName}` : ''}
                    {task.assignedByName && task.dueDate ? ' · ' : ''}
                    {task.dueDate ? `Due ${task.dueDate}` : ''}
                  </p>
                </div>

                {/* Time ago */}
                <span className="flex-shrink-0 text-[10px] mt-0.5 whitespace-nowrap" style={{ color: 'var(--text-3)' }}>
                  {timeAgo(task.createdAt)}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t text-center" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => onNotifClick(null)}
          className="text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ color: '#a78bfa' }}>
          View all tasks →
        </button>
      </div>
    </div>
  );
}

/* ── Navbar ──────────────────────────────────────────────────────── */
export default function Navbar({
  user, role, avatarSrc, onViewProfile,
  notifications = [], unreadCount = 0, onNotifClick, onMarkAllRead,
}) {
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen,    setNotifOpen]    = useState(false);
  const dropdownRef = useRef(null);
  const notifRef    = useRef(null);

  /* Close avatar dropdown on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* Close notification panel on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    try { sessionStorage.clear(); } catch {}
    await signOut(auth);
    navigate(role === 'admin' ? '/admin/login' : '/login');
  };

  const handleViewProfile = () => {
    setDropdownOpen(false);
    onViewProfile?.();
  };

  return (
    <nav className="sticky top-0 z-40 border-b"
         style={{ borderColor: 'var(--border)', background: 'var(--surface)', backdropFilter: 'blur(20px)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-lg animate-glow"
                 style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)' }}>
              G
            </div>
            <div>
              <span className="font-bold text-lg leading-none bg-clip-text text-transparent"
                    style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #60a5fa)' }}>
                Garvix Ops
              </span>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Daily Task Buddy</div>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">

            {/* Theme toggle */}
            <button onClick={toggle} title={isDark ? 'Light mode' : 'Dark mode'}
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105"
                    style={{ background: 'var(--surface-s)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              {isDark ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Notification bell — employee only */}
            {role === 'employee' && (
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen(v => !v)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105 relative"
                  style={{ background: 'var(--surface-s)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                  {/* Bell SVG */}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <NotificationPanel
                    notifications={notifications}
                    unreadCount={unreadCount}
                    onNotifClick={(task) => {
                      setNotifOpen(false);
                      onNotifClick?.(task);
                    }}
                    onMarkAllRead={() => {
                      onMarkAllRead?.();
                    }}
                  />
                )}
              </div>
            )}

            {/* Avatar dropdown */}
            {user && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(v => !v)}
                  className="w-9 h-9 rounded-xl overflow-hidden border-2 transition-all duration-200 hover:scale-105 flex items-center justify-center font-bold text-sm"
                  style={{ borderColor: dropdownOpen ? '#7c3aed' : 'var(--border)', background: 'linear-gradient(135deg,#7c3aed22,#3b82f622)', color: '#a78bfa' }}
                >
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{(user.displayName || user.email || 'U').charAt(0).toUpperCase()}</span>
                  )}
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-11 w-52 rounded-xl shadow-xl border overflow-hidden z-50 animate-fade-in"
                       style={{ background: 'var(--surface-s)', borderColor: 'var(--border)' }}>
                    {/* User info */}
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-s)' }}>
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>
                        {user.displayName || user.email}
                      </p>
                      <p className="text-xs capitalize mt-0.5" style={{ color: 'var(--text-3)' }}>{role}</p>
                    </div>
                    {/* View Profile */}
                    <button
                      onClick={handleViewProfile}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left"
                      style={{ color: 'var(--text-2)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; }}
                    >
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      View Profile
                    </button>
                    {/* Logout */}
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left border-t"
                      style={{ color: '#f87171', borderColor: 'var(--border-s)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
