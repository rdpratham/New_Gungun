import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, addDoc, onSnapshot, updateDoc, deleteDoc,
  doc, serverTimestamp,
} from 'firebase/firestore';

/* ── Helpers ─────────────────────────────────────────────────────── */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function todayIST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function formatTS(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

/* ── Priority config ─────────────────────────────────────────────── */
const PRIORITY = {
  high:   { label: 'High',   bg: 'rgba(239,68,68,0.15)',   color: '#f87171', border: 'rgba(239,68,68,0.35)',   dot: '#ef4444' },
  medium: { label: 'Medium', bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24', border: 'rgba(245,158,11,0.35)',  dot: '#f59e0b' },
  low:    { label: 'Low',    bg: 'rgba(16,185,129,0.15)',  color: '#34d399', border: 'rgba(16,185,129,0.35)',  dot: '#10b981' },
};

const STATUS = {
  pending:     { label: 'Pending',     bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: 'rgba(100,116,139,0.35)', next: 'in-progress' },
  'in-progress':{ label: 'In Progress', bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: 'rgba(59,130,246,0.35)', next: 'completed' },
  completed:   { label: 'Completed',   bg: 'rgba(16,185,129,0.15)', color: '#34d399', border: 'rgba(16,185,129,0.35)', next: 'pending' },
};

const STATUS_CYCLE = ['pending', 'in-progress', 'completed'];

/* ── Icons ───────────────────────────────────────────────────────── */
const IconTask     = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
const IconCheck    = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
const IconTrash    = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16" /></svg>;
const IconCalendar = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const IconUser     = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;

/* ── Priority badge ──────────────────────────────────────────────── */
function PriorityBadge({ priority }) {
  const p = PRIORITY[priority] || PRIORITY.medium;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ background: p.bg, color: p.color, border: `1px solid ${p.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.dot }} />
      {p.label}
    </span>
  );
}

/* ── Status badge (clickable) ────────────────────────────────────── */
function StatusBadge({ status, onClick }) {
  const s = STATUS[status] || STATUS.pending;
  return (
    <button onClick={onClick}
            title="Click to update status"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all hover:scale-105 hover:shadow-md"
            style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'in-progress' ? 'animate-pulse' : ''}`}
            style={{ background: s.color }} />
      {s.label}
    </button>
  );
}

/* ── Toast ───────────────────────────────────────────────────────── */
function Toast({ msg, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl animate-slide-up"
         style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff' }}>
      <IconCheck />
      <span className="text-sm font-semibold">{msg}</span>
    </div>
  );
}

/* ── FormField ───────────────────────────────────────────────────── */
function FormField({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

/* ── Task Detail Modal (admin view) ──────────────────────────────── */
function TaskDetailModal({ task, onClose, onCycleStatus, onDelete, confirmDel }) {
  const p = PRIORITY[task.priority] || PRIORITY.medium;
  const s = STATUS[task.status]     || STATUS.pending;
  const isDel = confirmDel === task.id;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
         style={{ background: 'rgba(4,8,15,0.9)', backdropFilter: 'blur(16px)' }}
         onClick={onClose}>
      <div className="max-w-lg w-full rounded-3xl shadow-2xl animate-slide-up overflow-hidden"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="relative px-6 py-5" style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}>
          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-tl-3xl" style={{ background: p.dot }} />
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-white/70 text-xs font-medium mb-1">Task Details</p>
              <h2 className="text-lg font-bold text-white leading-snug">{task.title}</h2>
            </div>
            <button onClick={onClose}
                    className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all hover:scale-110"
                    style={{ background: 'rgba(255,255,255,0.15)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Employee assigned to */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
               style={{ background: 'var(--surface-s)', border: '1px solid var(--border)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
                 style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}>
              {getInitials(task.assignedToName)}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Assigned To</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{task.assignedToName || '—'}</p>
            </div>
          </div>

          {/* Badges row */}
          <div className="flex flex-wrap gap-2">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} onClick={() => { onCycleStatus(task); }} />
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Description</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-2)' }}>{task.description}</p>
            </div>
          )}

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl px-4 py-3" style={{ background: 'var(--surface-s)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>Due Date</p>
              <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                <IconCalendar />{formatDate(task.dueDate)}
              </p>
            </div>
            <div className="rounded-xl px-4 py-3" style={{ background: 'var(--surface-s)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>Assigned On</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{formatTS(task.createdAt)}</p>
            </div>
          </div>

          {/* Delete */}
          <div className="pt-2 border-t" style={{ borderColor: 'var(--border-s)' }}>
            {isDel ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                   style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <p className="flex-1 text-xs font-medium" style={{ color: '#f87171' }}>Click again to confirm delete</p>
                <button onClick={() => onDelete(task.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                        style={{ background: 'linear-gradient(135deg,#ef4444,#f87171)' }}>
                  Delete
                </button>
              </div>
            ) : (
              <button onClick={() => onDelete(task.id)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all w-full justify-center"
                      style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                <IconTrash /> Delete Task
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────── */
export default function AssignTaskPage({ user, employees = [] }) {
  const INITIAL_FORM = { title: '', description: '', assignedTo: '', dueDate: '', priority: 'medium' };

  const [tasks,          setTasks]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [submitting,     setSubmitting]     = useState(false);
  const [form,           setForm]           = useState(INITIAL_FORM);
  const [filterStatus,   setFilterStatus]   = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [toast,          setToast]          = useState('');
  const [viewTask,       setViewTask]       = useState(null);
  const [confirmDel,     setConfirmDel]     = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, 'tasks'),
      snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setTasks(data);
        setLoading(false);
      },
      err => { console.error(err); setLoading(false); }
    );
    return () => unsub();
  }, []);

  /* Derived — filtered tasks */
  const filteredTasks = tasks.filter(t => {
    const statusOk = filterStatus === 'all' || t.status === filterStatus;
    const empOk    = !filterEmployee || t.assignedTo === filterEmployee;
    return statusOk && empOk;
  });

  /* Form handlers */
  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.assignedTo || !form.title.trim() || !form.dueDate) return;
    setSubmitting(true);
    try {
      const emp = employees.find(e => e.id === form.assignedTo);
      const payload = {
        title:          form.title.trim(),
        description:    form.description.trim(),
        dueDate:        form.dueDate,
        priority:       form.priority,
        status:         'pending',
        assignedTo:     form.assignedTo,
        assignedToName: emp?.name || emp?.email || form.assignedTo,
        assignedBy:     user.uid,
        createdAt:      serverTimestamp(),
        seen:           false,
      };
      await addDoc(collection(db, 'tasks'), payload);
      setForm(INITIAL_FORM);
      setToast('Task assigned successfully!');
    } catch (err) {
      console.error('assignTask:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function cycleStatus(task) {
    const idx  = STATUS_CYCLE.indexOf(task.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    try {
      await updateDoc(doc(db, 'tasks', task.id), { status: next });
    } catch (err) { console.error('cycleStatus:', err); }
  }

  async function handleDelete(id) {
    if (confirmDel !== id) {
      setConfirmDel(id);
      setTimeout(() => setConfirmDel(null), 2500);
      return;
    }
    try {
      await deleteDoc(doc(db, 'tasks', id));
      setConfirmDel(null);
    } catch (err) { console.error('deleteTask:', err); }
  }

  /* ── Render ── */
  return (
    <div className="space-y-6 animate-fade-in">

      {/* Page header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
             style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}>
          <IconTask />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Task Management</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Assign and track tasks for your team</p>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-3 lg:gap-6 space-y-5 lg:space-y-0">

        {/* ── LEFT: Assign form ── */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl overflow-hidden sticky top-20"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>

            {/* Form header */}
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                     style={{ background: 'linear-gradient(135deg,#7c3aed22,#3b82f622)' }}>
                  <svg className="w-4 h-4" style={{ color: '#a78bfa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h2 className="font-bold" style={{ color: 'var(--text)' }}>Assign New Task</h2>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">

              <FormField label="Assign To *">
                <select value={form.assignedTo} onChange={e => setField('assignedTo', e.target.value)}
                        required className="input-field text-sm">
                  <option value="">Select employee…</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name || emp.email}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Task Title *">
                <input type="text" placeholder="Enter task title…" required
                       value={form.title} onChange={e => setField('title', e.target.value)}
                       className="input-field text-sm" />
              </FormField>

              <FormField label="Description">
                <textarea placeholder="Optional details…" rows={3}
                          value={form.description} onChange={e => setField('description', e.target.value)}
                          className="input-field text-sm resize-none" />
              </FormField>

              <FormField label="Due Date *">
                <input type="date" required min={todayIST()}
                       value={form.dueDate} onChange={e => setField('dueDate', e.target.value)}
                       className="input-field text-sm" style={{ colorScheme: 'dark' }} />
              </FormField>

              <FormField label="Priority">
                <div className="flex gap-2">
                  {Object.entries(PRIORITY).map(([key, p]) => (
                    <button type="button" key={key}
                            onClick={() => setField('priority', key)}
                            className="flex-1 py-2 px-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                            style={form.priority === key
                              ? { background: p.bg, color: p.color, border: `1.5px solid ${p.border}`, boxShadow: `0 0 12px ${p.dot}44` }
                              : { background: 'var(--surface-s)', color: 'var(--text-3)', border: '1px solid var(--border-s)' }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </FormField>

              <button type="submit" disabled={submitting || !form.assignedTo || !form.title.trim() || !form.dueDate}
                      className="btn-primary w-full flex items-center justify-center gap-2">
                {submitting
                  ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Assigning…</>
                  : <><IconCheck /> Assign Task</>}
              </button>
            </form>
          </div>
        </div>

        {/* ── RIGHT: Task list ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* List header + filters */}
          <div className="rounded-2xl px-5 py-4 space-y-3"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-bold" style={{ color: 'var(--text)' }}>All Assigned Tasks</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {filteredTasks.length} of {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Status tabs */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'all',         label: 'All',         count: tasks.length },
                { key: 'pending',     label: 'Pending',     count: tasks.filter(t => t.status === 'pending').length },
                { key: 'in-progress', label: 'In Progress', count: tasks.filter(t => t.status === 'in-progress').length },
                { key: 'completed',   label: 'Completed',   count: tasks.filter(t => t.status === 'completed').length },
              ].map(tab => (
                <button key={tab.key} onClick={() => setFilterStatus(tab.key)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                        style={filterStatus === tab.key
                          ? { background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff', boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }
                          : { background: 'var(--surface-s)', color: 'var(--text-2)', border: '1px solid var(--border-s)' }}>
                  {tab.label}
                  <span className="ml-1.5 text-[10px] opacity-75">({tab.count})</span>
                </button>
              ))}
            </div>

            {/* Employee filter */}
            {employees.length > 0 && (
              <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}
                      className="input-field text-sm py-2">
                <option value="">All employees</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name || emp.email}</option>
                ))}
              </select>
            )}
          </div>

          {/* Task cards */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-20 rounded-2xl"
                 style={{ border: '1px dashed var(--border)' }}>
              <div className="text-5xl">📋</div>
              <p className="font-semibold" style={{ color: 'var(--text-2)' }}>No tasks found</p>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                {filterStatus !== 'all' || filterEmployee ? 'Try changing your filters' : 'Assign a task using the form on the left'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map(task => {
                const isDel = confirmDel === task.id;
                return (
                  <div key={task.id}
                       className="rounded-2xl p-4 transition-all duration-200 hover:shadow-lg cursor-pointer"
                       style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                       onClick={() => setViewTask(task)}
                       onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)'}
                       onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>

                    {/* Employee row */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
                             style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}>
                          {getInitials(task.assignedToName)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                            {task.assignedToName || '—'}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                            Assigned {formatTS(task.createdAt)}
                          </p>
                        </div>
                      </div>

                      {/* Delete button */}
                      <button onClick={e => { e.stopPropagation(); handleDelete(task.id); }}
                              title={isDel ? 'Confirm delete' : 'Delete task'}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110 flex-shrink-0"
                              style={isDel
                                ? { background: 'rgba(239,68,68,0.25)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)' }
                                : { background: 'var(--surface-s)', color: 'var(--text-3)', border: '1px solid var(--border-s)' }}>
                        {isDel ? <IconCheck /> : <IconTrash />}
                      </button>
                    </div>

                    {/* Title + description */}
                    <p className="font-bold mb-1" style={{ color: 'var(--text)' }}>{task.title}</p>
                    {task.description && (
                      <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--text-2)' }}>{task.description}</p>
                    )}

                    {/* Footer */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium"
                            style={{ background: 'var(--surface-s)', color: 'var(--text-3)', border: '1px solid var(--border-s)' }}>
                        <IconCalendar />
                        {formatDate(task.dueDate)}
                      </span>
                      <PriorityBadge priority={task.priority} />
                      <StatusBadge status={task.status} onClick={() => cycleStatus(task)} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      {/* Task detail modal */}
      {viewTask && (
        <TaskDetailModal
          task={viewTask}
          onClose={() => setViewTask(null)}
          onCycleStatus={(task) => { cycleStatus(task); setViewTask(prev => prev ? { ...prev, status: STATUS_CYCLE[(STATUS_CYCLE.indexOf(prev.status) + 1) % STATUS_CYCLE.length] } : null); }}
          onDelete={(id) => { handleDelete(id); if (confirmDel === id) setViewTask(null); }}
          confirmDel={confirmDel}
        />
      )}
    </div>
  );
}
