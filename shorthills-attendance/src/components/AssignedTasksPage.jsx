import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, updateDoc, doc,
  query, where, onSnapshot, addDoc, serverTimestamp,
} from 'firebase/firestore';

/* ── Helpers ─────────────────────────────────────────────────────── */
function todayIST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}
function formatTS(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function isOverdue(dueDate, status) {
  if (!dueDate || status === 'completed') return false;
  return dueDate < todayIST();
}
function sortTasks(arr) {
  const order = { pending: 0, 'in-progress': 1, completed: 2 };
  return [...arr].sort((a, b) => {
    const oa = order[a.status] ?? 0;
    const ob = order[b.status] ?? 0;
    if (oa !== ob) return oa - ob;
    return (a.dueDate || '').localeCompare(b.dueDate || '');
  });
}
function sortByDue(arr) {
  return [...arr].sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return a.dueDate ? -1 : 1;
  });
}

/* ── Config ──────────────────────────────────────────────────────── */
const PRIORITY_STYLES = {
  high:   { color: '#f87171', bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.35)',  accent: '#ef4444', label: 'High' },
  medium: { color: '#fbbf24', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.35)', accent: '#f59e0b', label: 'Medium' },
  low:    { color: '#34d399', bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.35)', accent: '#10b981', label: 'Low' },
};
const STATUS_STYLES = {
  pending:       { color: '#94a3b8', bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.3)', label: 'Pending' },
  'in-progress': { color: '#60a5fa', bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.3)',  label: 'In Progress' },
  completed:     { color: '#34d399', bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.3)',  label: 'Completed' },
};
const COLUMN_CFG = {
  pending:       { label: 'Pending',     color: '#94a3b8', accent: '#64748b', hdr: 'rgba(100,116,139,0.10)', emoji: '📋' },
  'in-progress': { label: 'In Progress', color: '#60a5fa', accent: '#3b82f6', hdr: 'rgba(59,130,246,0.10)',  emoji: '⚡' },
  completed:     { label: 'Completed',   color: '#34d399', accent: '#10b981', hdr: 'rgba(16,185,129,0.10)',  emoji: '🎉' },
};

/* ── Icons ───────────────────────────────────────────────────────── */
const IconBriefcase = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
const IconCalendar  = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const IconClock     = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconClose     = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const IconUser      = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const IconAlert     = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;

/* ── PriorityBadge ───────────────────────────────────────────────── */
function PriorityBadge({ priority }) {
  const p = PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
          style={{ background: p.bg, color: p.color, border: `1px solid ${p.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
      {p.label}
    </span>
  );
}

/* ── StatusPills ─────────────────────────────────────────────────── */
function StatusPills({ currentStatus, onUpdate }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {Object.entries(STATUS_STYLES).map(([s, cfg]) => {
        const active = currentStatus === s;
        return (
          <button key={s} onClick={() => !active && onUpdate(s)}
                  className="px-3 py-1 rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-105"
                  style={active
                    ? { background: cfg.bg, color: cfg.color, border: `1.5px solid ${cfg.border}`, boxShadow: `0 0 12px ${cfg.color}44` }
                    : { background: 'var(--surface-s)', color: 'var(--text-3)', border: '1px solid var(--border-s)' }}>
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── TaskCard ────────────────────────────────────────────────────── */
function TaskCard({ task, onClick }) {
  const p       = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
  const s       = STATUS_STYLES[task.status]     || STATUS_STYLES.pending;
  const overdue = isOverdue(task.dueDate, task.status);
  const done    = task.status === 'completed';

  return (
    <div
      className="rounded-2xl cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 overflow-hidden"
      style={{ background: 'var(--surface)', border: `1px solid var(--border)`, borderLeft: `4px solid ${p.accent}` }}
      onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 8px 28px ${p.accent}28`; e.currentTarget.style.borderColor = p.accent + '55'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <div className="p-4 space-y-2.5">
        {/* Overdue warning */}
        {overdue && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold"
               style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.22)' }}>
            <IconAlert /> Overdue
          </div>
        )}

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <PriorityBadge priority={task.priority} />
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${task.status === 'in-progress' ? 'animate-pulse' : ''}`}
                  style={{ background: s.color }} />
            {s.label}
          </span>
        </div>

        {/* Title */}
        <p className="font-bold text-sm leading-snug"
           style={{ color: done ? 'var(--text-3)' : 'var(--text)', textDecoration: done ? 'line-through' : 'none' }}>
          {task.title}
        </p>

        {/* Description */}
        {task.description && (
          <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-3)' }}>
            {task.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 pt-2 border-t flex-wrap" style={{ borderColor: 'var(--border-s)' }}>
          {task.dueDate && (
            <span className="flex items-center gap-1 text-[11px] font-medium"
                  style={{ color: overdue ? '#f87171' : 'var(--text-3)' }}>
              <IconCalendar /> {formatDate(task.dueDate)}
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
            <IconClock /> {formatTS(task.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── KanbanColumn ────────────────────────────────────────────────── */
function KanbanColumn({ status, tasks, onCardClick }) {
  const cfg = COLUMN_CFG[status];
  return (
    <div className="flex flex-col gap-3">
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 rounded-2xl"
           style={{ background: cfg.hdr, border: `1px solid ${cfg.accent}22` }}>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: cfg.accent, boxShadow: `0 0 8px ${cfg.accent}` }} />
          <span className="text-xs font-black uppercase tracking-widest" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: cfg.accent + '22', color: cfg.color, minWidth: '24px', textAlign: 'center' }}>
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-3 flex-1">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 rounded-2xl"
               style={{ border: `1.5px dashed ${cfg.accent}30` }}>
            <span className="text-3xl">{cfg.emoji}</span>
            <p className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>
              No {cfg.label.toLowerCase()} tasks
            </p>
          </div>
        ) : (
          sortByDue(tasks).map(task => (
            <TaskCard key={task.id} task={task} onClick={() => onCardClick(task)} />
          ))
        )}
      </div>
    </div>
  );
}

/* ── Task Detail Modal ───────────────────────────────────────────── */
function TaskDetailModal({ task, onClose, onUpdateStatus }) {
  const pStyle  = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
  const sStyle  = STATUS_STYLES[task.status]     || STATUS_STYLES.pending;
  const overdue = isOverdue(task.dueDate, task.status);

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-[60]"
         style={{ background: 'rgba(4,8,15,0.9)', backdropFilter: 'blur(16px)' }}
         onClick={onClose}>
      <div className="max-w-lg w-full rounded-3xl shadow-2xl animate-slide-up overflow-hidden"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
           onClick={e => e.stopPropagation()}>
        <div className="relative px-6 py-5" style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}>
          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-tl-3xl" style={{ background: pStyle.accent }} />
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-bold text-white leading-snug pr-2"
                style={{ textDecoration: task.status === 'completed' ? 'line-through' : 'none', opacity: task.status === 'completed' ? 0.8 : 1 }}>
              {task.title}
            </h2>
            <button onClick={onClose}
                    className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-110"
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
              <IconClose />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {overdue && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold"
                 style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#ef4444' }} />
              This task is overdue
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <PriorityBadge priority={task.priority} />
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: sStyle.bg, color: sStyle.color, border: `1px solid ${sStyle.border}` }}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${task.status === 'in-progress' ? 'animate-pulse' : ''}`}
                    style={{ background: sStyle.color }} />
              {sStyle.label}
            </span>
          </div>

          {task.description && (
            <div>
              <p className="text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Description</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{task.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-3" style={{ background: 'var(--surface-s)', border: '1px solid var(--border-s)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>Due Date</p>
              <p className="text-sm font-semibold" style={{ color: overdue ? '#f87171' : 'var(--text)' }}>{formatDate(task.dueDate)}</p>
            </div>
            <div className="rounded-2xl p-3" style={{ background: 'var(--surface-s)', border: '1px solid var(--border-s)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>Assigned</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{formatTS(task.createdAt)}</p>
            </div>
          </div>

          {task.assignedByName && (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-2)' }}>
              <IconUser />
              <span>Assigned by <span className="font-semibold" style={{ color: 'var(--text)' }}>{task.assignedByName}</span></span>
            </div>
          )}

          <div className="pt-4 border-t" style={{ borderColor: 'var(--border-s)' }}>
            <p className="text-xs font-semibold mb-2.5 uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Update Status</p>
            <StatusPills currentStatus={task.status} onUpdate={newStatus => onUpdateStatus(task.id, newStatus)} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────── */
export default function AssignedTasksPage({ user }) {
  const [tasks,        setTasks]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewTask,     setViewTask]     = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    const q = query(collection(db, 'tasks'), where('assignedTo', '==', user.uid));
    const unsub = onSnapshot(q,
      snap => { setTasks(sortTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))); setLoading(false); },
      err  => { console.error('assignedTasksSnapshot:', err); setLoading(false); }
    );
    return () => unsub();
  }, [user?.uid]);

  async function updateStatus(taskId, newStatus) {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;
    try {
      await updateDoc(doc(db, 'tasks', taskId), { status: newStatus, seen: true });
      await addDoc(collection(db, 'notifications'), {
        type: 'task_status_update', taskId, taskTitle: task.title || 'Task',
        employeeName: user?.displayName || user?.email || 'Employee',
        employeeUid: user?.uid, oldStatus: task.status, newStatus,
        createdAt: serverTimestamp(), seen: false, targetRole: 'admin',
      });
      setTasks(prev => sortTasks(prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t)));
      setViewTask(prev => prev?.id === taskId ? { ...prev, status: newStatus } : prev);
    } catch (err) { console.error('updateStatus:', err); }
  }

  const stats = {
    total:      tasks.length,
    pending:    tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    completed:  tasks.filter(t => t.status === 'completed').length,
    overdue:    tasks.filter(t => isOverdue(t.dueDate, t.status)).length,
  };
  const pct      = stats.total > 0 ? Math.round(stats.completed / stats.total * 100) : 0;
  const R        = 24;
  const CIRC     = 2 * Math.PI * R;
  const filtered = filterStatus === 'all' ? tasks : tasks.filter(t => t.status === filterStatus);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-28 rounded-3xl" style={{ background: 'var(--surface)' }} />
        <div className="grid grid-cols-4 gap-3">{[1,2,3,4].map(i => <div key={i} className="h-16 rounded-2xl" style={{ background: 'var(--surface)' }} />)}</div>
        <div className="hidden md:grid grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="h-48 rounded-2xl" style={{ background: 'var(--surface)' }} />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Hero banner */}
      <div className="relative rounded-3xl overflow-hidden p-5"
           style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#3b82f6 60%,#06b6d4 100%)' }}>
        <div className="absolute inset-0 opacity-15"
             style={{ backgroundImage: 'radial-gradient(circle at 85% 50%, #fff 0%, transparent 55%)' }} />
        <div className="relative flex items-center gap-5">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 text-white">
            <IconBriefcase />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-black text-white">My Tasks</h1>
            <p className="text-white/60 text-xs mt-0.5">{stats.total} tasks · {stats.overdue} overdue</p>
          </div>
          {/* Completion ring */}
          {stats.total > 0 && (
            <div className="flex flex-col items-center flex-shrink-0">
              <svg width="64" height="64" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="5" />
                <circle cx="32" cy="32" r={R} fill="none" stroke="#fff" strokeWidth="5"
                        strokeDasharray={`${CIRC * pct / 100} ${CIRC}`}
                        strokeLinecap="round" transform="rotate(-90 32 32)"
                        style={{ transition: 'stroke-dasharray 0.8s ease' }} />
                <text x="32" y="36" textAnchor="middle" fontSize="13" fontWeight="900" fill="white">{pct}%</text>
              </svg>
              <span className="text-white/55 text-[10px] -mt-0.5">done</span>
            </div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Pending',     value: stats.pending,    color: '#94a3b8', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.2)' },
            { label: 'In Progress', value: stats.inProgress, color: '#60a5fa', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.2)'  },
            { label: 'Completed',   value: stats.completed,  color: '#34d399', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.2)'  },
            { label: 'Overdue',     value: stats.overdue,    color: '#f87171', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.2)'   },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4 text-center transition-all hover:-translate-y-0.5"
                 style={{ background: s.bg, border: `1px solid ${s.border}` }}>
              <p className="text-3xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-3)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Overdue alert */}
      {stats.overdue > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
             style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)' }}>
          <IconAlert />
          <p className="text-sm font-semibold" style={{ color: '#f87171' }}>
            {stats.overdue} task{stats.overdue > 1 ? 's are' : ' is'} past the due date — please update them
          </p>
        </div>
      )}

      {/* Empty state */}
      {tasks.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-24 rounded-2xl"
             style={{ border: '1px dashed var(--border)' }}>
          <div className="text-6xl">📭</div>
          <div className="text-center">
            <p className="font-bold text-lg" style={{ color: 'var(--text-2)' }}>No tasks assigned yet</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Your admin will assign tasks here</p>
          </div>
        </div>
      )}

      {/* ── Kanban Board — md+ ── */}
      {tasks.length > 0 && (
        <div className="hidden md:grid grid-cols-3 gap-4">
          {(['pending', 'in-progress', 'completed']).map(status => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasks.filter(t => t.status === status)}
              onCardClick={setViewTask}
            />
          ))}
        </div>
      )}

      {/* ── List — mobile ── */}
      {tasks.length > 0 && (
        <div className="md:hidden space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: 'all',         label: 'All',         count: stats.total },
              { key: 'pending',     label: 'Pending',     count: stats.pending },
              { key: 'in-progress', label: 'In Progress', count: stats.inProgress },
              { key: 'completed',   label: 'Completed',   count: stats.completed },
            ].map(tab => (
              <button key={tab.key} onClick={() => setFilterStatus(tab.key)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200"
                      style={filterStatus === tab.key
                        ? { background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff', boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }
                        : { background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 rounded-2xl"
                 style={{ border: '1px dashed var(--border)' }}>
              <div className="text-4xl">📭</div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>No {filterStatus} tasks</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(task => (
                <TaskCard key={task.id} task={task} onClick={() => setViewTask(task)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {viewTask && (
        <TaskDetailModal task={viewTask} onClose={() => setViewTask(null)} onUpdateStatus={updateStatus} />
      )}
    </div>
  );
}
