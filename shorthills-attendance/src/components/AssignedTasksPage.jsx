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
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isOverdue(dueDate, status) {
  if (!dueDate || status === 'completed') return false;
  return dueDate < todayIST();
}

/* Sort: incomplete first (pending, in-progress), then completed; within group by dueDate asc */
function sortTasks(arr) {
  const order = { pending: 0, 'in-progress': 1, completed: 2 };
  return [...arr].sort((a, b) => {
    const oa = order[a.status] ?? 0;
    const ob = order[b.status] ?? 0;
    if (oa !== ob) return oa - ob;
    return (a.dueDate || '').localeCompare(b.dueDate || '');
  });
}

/* ── Priority / Status config ────────────────────────────────────── */
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

/* ── Icons ───────────────────────────────────────────────────────── */
const IconBriefcase = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
const IconCalendar  = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const IconClock     = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconClose     = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const IconUser      = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;

/* ── Priority badge ──────────────────────────────────────────────── */
function PriorityBadge({ priority }) {
  const p = PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
          style={{ background: p.bg, color: p.color, border: `1px solid ${p.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
      {p.label}
    </span>
  );
}

/* ── Status pills ────────────────────────────────────────────────── */
function StatusPills({ currentStatus, onUpdate }) {
  const statuses = ['pending', 'in-progress', 'completed'];
  return (
    <div className="flex gap-1.5 flex-wrap">
      {statuses.map(s => {
        const cfg    = STATUS_STYLES[s];
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

/* ── Stat card ───────────────────────────────────────────────────── */
function StatCard({ value, label, color, bg }) {
  return (
    <div className="flex-1 rounded-2xl p-4 text-center min-w-[80px]"
         style={{ background: bg, border: `1px solid ${color}33` }}>
      <p className="text-2xl font-black" style={{ color }}>{value}</p>
      <p className="text-xs mt-1 font-medium" style={{ color: 'var(--text-3)' }}>{label}</p>
    </div>
  );
}

/* ── Task Detail Modal ───────────────────────────────────────────── */
function TaskDetailModal({ task, onClose, onUpdateStatus }) {
  const pStyle  = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
  const sStyle  = STATUS_STYLES[task.status] || STATUS_STYLES.pending;
  const overdue = isOverdue(task.dueDate, task.status);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-[60]"
      style={{ background: 'rgba(4,8,15,0.9)', backdropFilter: 'blur(16px)' }}
      onClick={onClose}
    >
      <div
        className="max-w-lg w-full rounded-3xl shadow-2xl animate-slide-up overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 py-5" style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}>
          <div
            className="absolute left-0 top-0 bottom-0 w-1 rounded-tl-3xl"
            style={{ background: pStyle.accent }}
          />
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-bold text-white leading-snug pr-2" style={{ textDecoration: task.status === 'completed' ? 'line-through' : 'none', opacity: task.status === 'completed' ? 0.8 : 1 }}>
              {task.title}
            </h2>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-110"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
            >
              <IconClose />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Overdue warning */}
          {overdue && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold"
                 style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#ef4444' }} />
              This task is overdue
            </div>
          )}

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <PriorityBadge priority={task.priority} />
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: sStyle.bg, color: sStyle.color, border: `1px solid ${sStyle.border}` }}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${task.status === 'in-progress' ? 'animate-pulse' : ''}`}
                style={{ background: sStyle.color }}
              />
              {sStyle.label}
            </span>
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <p className="text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Description</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{task.description}</p>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-3" style={{ background: 'var(--surface-s)', border: '1px solid var(--border-s)' }}>
              <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-3)' }}>
                <IconCalendar />
                <span className="text-xs font-semibold uppercase tracking-wider">Due Date</span>
              </div>
              <p className="text-sm font-semibold" style={{ color: overdue ? '#f87171' : 'var(--text)' }}>
                {formatDate(task.dueDate)}
              </p>
            </div>
            <div className="rounded-2xl p-3" style={{ background: 'var(--surface-s)', border: '1px solid var(--border-s)' }}>
              <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-3)' }}>
                <IconClock />
                <span className="text-xs font-semibold uppercase tracking-wider">Assigned</span>
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {formatTS(task.createdAt)}
              </p>
            </div>
          </div>

          {/* Assigned by */}
          {task.assignedByName && (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-2)' }}>
              <IconUser />
              <span>Assigned by <span className="font-semibold" style={{ color: 'var(--text)' }}>{task.assignedByName}</span></span>
            </div>
          )}

          {/* Status update */}
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

  /* Real-time listener */
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);

    const q = query(
      collection(db, 'tasks'),
      where('assignedTo', '==', user.uid),
    );

    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTasks(sortTasks(data));
      setLoading(false);
    }, err => {
      console.error('assignedTasksSnapshot:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [user?.uid]);

  /* Update status + notify admin */
  async function updateStatus(taskId, newStatus) {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;
    try {
      await updateDoc(doc(db, 'tasks', taskId), { status: newStatus, seen: true });
      await addDoc(collection(db, 'notifications'), {
        type:         'task_status_update',
        taskId,
        taskTitle:    task.title || 'Task',
        employeeName: user?.displayName || user?.email || 'Employee',
        employeeUid:  user?.uid,
        oldStatus:    task.status,
        newStatus,
        createdAt:    serverTimestamp(),
        seen:         false,
        targetRole:   'admin',
      });
      setTasks(prev => sortTasks(prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t)));
      setViewTask(prev => prev?.id === taskId ? { ...prev, status: newStatus } : prev);
    } catch (err) {
      console.error('updateStatus:', err);
    }
  }

  /* Derived */
  const filtered = filterStatus === 'all' ? tasks : tasks.filter(t => t.status === filterStatus);

  const stats = {
    total:       tasks.length,
    pending:     tasks.filter(t => t.status === 'pending').length,
    inProgress:  tasks.filter(t => t.status === 'in-progress').length,
    completed:   tasks.filter(t => t.status === 'completed').length,
    overdue:     tasks.filter(t => isOverdue(t.dueDate, t.status)).length,
  };

  /* ── Render ── */
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">

      {/* Page header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
             style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}>
          <IconBriefcase />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>My Tasks</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Tasks assigned to you by admin</p>
        </div>
      </div>

      {/* Stats row */}
      {!loading && tasks.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <StatCard value={stats.total}      label="Total"       color="#a78bfa" bg="rgba(124,58,237,0.12)" />
          <StatCard value={stats.pending}    label="Pending"     color="#94a3b8" bg="rgba(100,116,139,0.12)" />
          <StatCard value={stats.inProgress} label="In Progress" color="#60a5fa" bg="rgba(59,130,246,0.12)" />
          <StatCard value={stats.completed}  label="Completed"   color="#34d399" bg="rgba(16,185,129,0.12)" />
          {stats.overdue > 0 && (
            <StatCard value={stats.overdue}  label="Overdue"     color="#f87171" bg="rgba(239,68,68,0.12)" />
          )}
        </div>
      )}

      {/* Filter tabs */}
      {!loading && tasks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'all',         label: 'All',         count: stats.total },
            { key: 'pending',     label: 'Pending',     count: stats.pending },
            { key: 'in-progress', label: 'In Progress', count: stats.inProgress },
            { key: 'completed',   label: 'Completed',   count: stats.completed },
          ].map(tab => (
            <button key={tab.key} onClick={() => setFilterStatus(tab.key)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200"
                    style={filterStatus === tab.key
                      ? { background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff', boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }
                      : { background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              {tab.label}
              <span className="ml-1.5 opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Task list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 rounded-2xl"
             style={{ border: '1px dashed var(--border)' }}>
          <div className="text-5xl">{filterStatus === 'completed' ? '🎉' : '📭'}</div>
          <div className="text-center">
            <p className="font-semibold" style={{ color: 'var(--text-2)' }}>
              {tasks.length === 0 ? 'No tasks assigned yet' : `No ${filterStatus === 'all' ? '' : filterStatus + ' '}tasks`}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
              {tasks.length === 0 ? 'Your admin will assign tasks here' : 'Switch filter to see other tasks'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(task => {
            const pStyle    = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
            const overdue   = isOverdue(task.dueDate, task.status);
            const done      = task.status === 'completed';

            return (
              <div key={task.id}
                   className="rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-xl cursor-pointer"
                   style={{
                     background: 'var(--surface)',
                     border: `1px solid var(--border)`,
                     borderLeft: `4px solid ${pStyle.accent}`,
                   }}
                   onClick={() => setViewTask(task)}>

                <div className="p-4 space-y-3">
                  {/* Title row */}
                  <div className="flex items-start gap-3 flex-wrap">
                    <p className="font-bold text-base flex-1 leading-tight" style={{ color: done ? 'var(--text-3)' : 'var(--text)', textDecoration: done ? 'line-through' : 'none' }}>
                      {task.title}
                      {done && <span className="ml-2 text-emerald-400 align-middle text-base" title="Complete">✓</span>}
                    </p>
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                      <PriorityBadge priority={task.priority} />
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: STATUS_STYLES[task.status]?.bg, color: STATUS_STYLES[task.status]?.color, border: `1px solid ${STATUS_STYLES[task.status]?.border}` }}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${task.status === 'in-progress' ? 'animate-pulse' : ''}`}
                              style={{ background: STATUS_STYLES[task.status]?.color }} />
                        {STATUS_STYLES[task.status]?.label}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  {task.description && (
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{task.description}</p>
                  )}

                  {/* Dates footer */}
                  <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--text-3)' }}>
                    <span className="inline-flex items-center gap-1">
                      <IconCalendar />
                      Due: {' '}
                      {overdue
                        ? <span className="font-bold" style={{ color: '#f87171' }}>OVERDUE — {formatDate(task.dueDate)}</span>
                        : <span style={{ color: 'var(--text-2)' }}>{formatDate(task.dueDate)}</span>}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <IconClock />
                      Assigned: {formatTS(task.createdAt)}
                    </span>
                  </div>

                  {/* Status update pills */}
                  <div className="pt-1 border-t" style={{ borderColor: 'var(--border-s)' }}
                       onClick={e => e.stopPropagation()}>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>Update Status</p>
                    <StatusPills currentStatus={task.status} onUpdate={newStatus => updateStatus(task.id, newStatus)} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task detail modal */}
      {viewTask && (
        <TaskDetailModal
          task={viewTask}
          onClose={() => setViewTask(null)}
          onUpdateStatus={updateStatus}
        />
      )}
    </div>
  );
}
