import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import {
  collection, addDoc, onSnapshot, updateDoc, deleteDoc,
  doc, query, where, serverTimestamp,
} from 'firebase/firestore';

/* ── Helpers ─────────────────────────────────────────────────────── */
function todayIST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function formatDisplayDate(dateStr) {
  const today = todayIST();
  const [ty, tm, td] = today.split('-').map(Number);
  const [dy, dm, dd] = dateStr.split('-').map(Number);
  const diffDays = Math.round((new Date(dy, dm - 1, dd) - new Date(ty, tm - 1, td)) / 86400000);
  if (diffDays === 0)  return 'Today';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays === 1)  return 'Tomorrow';
  return new Date(dy, dm - 1, dd).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function offsetDate(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(dt);
}

/* ── Icons ───────────────────────────────────────────────────────── */
const IconCheck    = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>;
const IconTrash    = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16" /></svg>;
const IconPlus     = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const IconChevL    = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>;
const IconChevR    = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>;
const IconCalendar = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const IconStar     = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
const IconClock    = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconPencil   = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
const IconX        = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;

/* ── Priority config ─────────────────────────────────────────────── */
const PRIORITY = {
  high:   { label: 'High',   color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.4)',   dot: '#ef4444' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.4)',  dot: '#f59e0b' },
  low:    { label: 'Low',    color: '#10b981', bg: 'rgba(16,185,129,0.15)',   border: 'rgba(16,185,129,0.4)',  dot: '#10b981' },
};

/* ── Spinner ─────────────────────────────────────────────────────── */
function Spinner({ size = 6, color = '#7c3aed' }) {
  return (
    <div className={`w-${size} h-${size} border-2 rounded-full animate-spin flex-shrink-0`}
         style={{ borderColor: color, borderTopColor: 'transparent' }} />
  );
}

/* ── TaskForm (shared between Add & Edit modals) ─────────────────── */
function TaskForm({ initial, selectedDate, onSave, onClose, modalTitle, saveLabel }) {
  const [title,       setTitle]       = useState(initial?.title       || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [date,        setDate]        = useState(initial?.date        || selectedDate);
  const [time,        setTime]        = useState(initial?.time        || '');
  const [priority,    setPriority]    = useState(initial?.priority    || 'medium');
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setErr('Title is required.'); return; }
    setSaving(true);
    setErr('');
    try {
      await onSave({ title: title.trim(), description: description.trim(), date, time, priority });
    } catch (ex) {
      setErr(ex.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(4,8,15,0.8)', backdropFilter: 'blur(8px)' }}>
      <div className="max-w-md w-full rounded-2xl overflow-hidden animate-slide-up"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{modalTitle}</h2>
          <button onClick={onClose}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-110"
                  style={{ background: 'var(--surface-s)', border: '1px solid var(--border)', color: 'var(--text-3)' }}>
            <IconX />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="label block mb-1.5">Title <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="input-field w-full"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="label block mb-1.5">Description <span style={{ color: 'var(--text-3)', fontSize: '0.7rem' }}>(optional)</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add more details…"
              className="input-field w-full resize-none"
              rows={3}
            />
          </div>

          {/* Date + Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="input-field w-full"
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label className="label block mb-1.5">Time <span style={{ color: 'var(--text-3)', fontSize: '0.7rem' }}>(optional)</span></label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="input-field w-full"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>

          {/* Priority pills */}
          <div>
            <label className="label block mb-2">Priority</label>
            <div className="flex gap-2">
              {(['high', 'medium', 'low']).map(p => {
                const cfg = PRIORITY[p];
                const selected = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                    style={selected
                      ? { background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff', boxShadow: '0 4px 16px rgba(124,58,237,0.35)', border: 'none' }
                      : { background: 'var(--surface-s)', border: `1px solid ${cfg.border}`, color: cfg.color }
                    }>
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {err && (
            <p className="text-sm font-medium px-3 py-2 rounded-xl"
               style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              {err}
            </p>
          )}

          {/* Footer */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving ? <Spinner size={4} color="#fff" /> : null}
              {saveLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── AddTodoModal ────────────────────────────────────────────────── */
function AddTodoModal({ selectedDate, onSave, onClose }) {
  return (
    <TaskForm
      initial={null}
      selectedDate={selectedDate}
      onSave={onSave}
      onClose={onClose}
      modalTitle="New Task"
      saveLabel="Save Task"
    />
  );
}

/* ── EditTodoModal ───────────────────────────────────────────────── */
function EditTodoModal({ todo, selectedDate, onSave, onClose }) {
  return (
    <TaskForm
      initial={todo}
      selectedDate={selectedDate}
      onSave={onSave}
      onClose={onClose}
      modalTitle="Edit Task"
      saveLabel="Update Task"
    />
  );
}

/* ── TodoItem ────────────────────────────────────────────────────── */
function TodoItem({ todo, onToggle, onDelete, onEdit }) {
  const [confirmDel, setConfirmDel] = useState(false);

  function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 2500); return; }
    onDelete(todo.id);
  }

  const displayTitle = todo.title || todo.text || '—';
  const pCfg = PRIORITY[todo.priority] || PRIORITY.medium;

  return (
    <div className="group flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all duration-200"
         style={{ background: 'var(--surface)', border: `1px solid ${todo.completed ? 'rgba(16,185,129,0.3)' : 'var(--border)'}` }}
         onMouseEnter={e => { if (!todo.completed) e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'; }}
         onMouseLeave={e => e.currentTarget.style.borderColor = todo.completed ? 'rgba(16,185,129,0.3)' : 'var(--border)'}>

      {/* Checkbox */}
      <button onClick={() => onToggle(todo)}
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
              style={todo.completed
                ? { background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', border: 'none', boxShadow: '0 4px 12px rgba(16,185,129,0.35)' }
                : { background: 'transparent', border: '2px solid var(--border)', color: 'transparent' }}
              onMouseEnter={e => { if (!todo.completed) { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.color = '#7c3aed66'; } }}
              onMouseLeave={e => { if (!todo.completed) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'transparent'; } }}>
        <IconCheck />
      </button>

      {/* Middle: title + time + description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug truncate"
           style={{ color: todo.completed ? 'var(--text-3)' : 'var(--text)', textDecoration: todo.completed ? 'line-through' : 'none' }}>
          {displayTitle}
        </p>
        {todo.time && (
          <span className="inline-flex items-center gap-1 mt-0.5 text-[11px]" style={{ color: 'var(--text-3)' }}>
            <IconClock /> {todo.time}
          </span>
        )}
        {todo.description && (
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-3)' }}>{todo.description}</p>
        )}
      </div>

      {/* Right: priority badge + action buttons */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Priority badge */}
        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: pCfg.bg, color: pCfg.color, border: `1px solid ${pCfg.border}` }}>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: pCfg.dot }} />
          {pCfg.label}
        </span>

        {/* Edit */}
        <button onClick={() => onEdit(todo)}
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110 opacity-0 group-hover:opacity-100"
                style={{ background: 'var(--surface-s)', color: 'var(--text-3)', border: '1px solid var(--border-s)' }}
                title="Edit task">
          <IconPencil />
        </button>

        {/* Delete */}
        <button onClick={handleDelete}
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110 opacity-0 group-hover:opacity-100"
                style={confirmDel
                  ? { background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' }
                  : { background: 'var(--surface-s)', color: 'var(--text-3)', border: '1px solid var(--border-s)' }}
                title={confirmDel ? 'Click again to confirm' : 'Delete task'}>
          <IconTrash />
        </button>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────── */
export default function TodoPage({ user, title }) {
  const [todos,        setTodos]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayIST);
  const [error,        setError]        = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTodo,  setEditingTodo]  = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'todos'), where('uid', '==', user.uid)),
      snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
        setTodos(data);
        setLoading(false);
      },
      err => { console.error(err); setLoading(false); setError('Failed to load tasks: ' + err.message); }
    );
    return () => unsub();
  }, [user?.uid]);

  /* Derived */
  const todosForDate = todos.filter(t => t.date === selectedDate);
  const doneCount    = todosForDate.filter(t => t.completed).length;
  const totalCount   = todosForDate.length;
  const pct          = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  /* Jump-to dates */
  const otherDates = (() => {
    const map = {};
    todos.forEach(t => {
      if (t.date === selectedDate) return;
      if (!map[t.date]) map[t.date] = { total: 0, pending: 0 };
      map[t.date].total++;
      if (!t.completed) map[t.date].pending++;
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  })();

  /* Handlers */
  async function handleAdd({ title: ttl, description, date, time, priority }) {
    await addDoc(collection(db, 'todos'), {
      uid: user.uid, title: ttl, description, date, time, priority,
      completed: false, createdAt: serverTimestamp(),
    });
    setShowAddModal(false);
  }

  async function handleEdit({ title: ttl, description, date, time, priority }) {
    await updateDoc(doc(db, 'todos', editingTodo.id), { title: ttl, description, date, time, priority });
    setEditingTodo(null);
  }

  async function toggleTodo(todo) {
    try {
      await updateDoc(doc(db, 'todos', todo.id), { completed: !todo.completed });
    } catch (err) { console.error('toggleTodo:', err); setError(err.message); }
  }

  async function deleteTodo(id) {
    try {
      await deleteDoc(doc(db, 'todos', id));
    } catch (err) { console.error('deleteTodo:', err); setError(err.message); }
  }

  /* ── Render ── */
  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">

      {/* Modals */}
      {showAddModal && (
        <AddTodoModal
          selectedDate={selectedDate}
          onSave={handleAdd}
          onClose={() => setShowAddModal(false)}
        />
      )}
      {editingTodo && (
        <EditTodoModal
          todo={editingTodo}
          selectedDate={selectedDate}
          onSave={handleEdit}
          onClose={() => setEditingTodo(null)}
        />
      )}

      {/* Page header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-white shadow-lg"
             style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}>
          <IconStar />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{title || 'My To-Do'}</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Stay focused, one task at a time</p>
        </div>
      </div>

      {/* Date navigation card */}
      <div className="rounded-2xl p-4 flex flex-wrap items-center gap-3"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>

        <button onClick={() => setSelectedDate(d => offsetDate(d, -1))}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105 flex-shrink-0"
                style={{ background: 'var(--surface-s)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
          <IconChevL />
        </button>

        <div className="flex-1 min-w-[120px] text-center">
          <p className="font-bold text-base leading-tight" style={{ color: 'var(--text)' }}>{formatDisplayDate(selectedDate)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{selectedDate}</p>
        </div>

        <button onClick={() => setSelectedDate(d => offsetDate(d, 1))}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105 flex-shrink-0"
                style={{ background: 'var(--surface-s)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
          <IconChevR />
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          <input type="date" value={selectedDate}
                 onChange={e => setSelectedDate(e.target.value)}
                 className="rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                 style={{ background: 'var(--input-bg)', color: 'var(--text)', borderColor: 'var(--border)', colorScheme: 'dark' }} />

          {selectedDate !== todayIST() && (
            <button onClick={() => setSelectedDate(todayIST())}
                    className="px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 whitespace-nowrap"
                    style={{ background: 'linear-gradient(135deg,#7c3aed22,#3b82f622)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>
              Today
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="rounded-2xl p-4 space-y-3"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <div className="text-sm" style={{ color: 'var(--text-2)' }}>
              <span className="font-bold text-base" style={{ color: 'var(--text)' }}>{doneCount}</span>
              {' '}of {totalCount} tasks done
            </div>
            <span className="text-lg font-black transition-colors duration-500"
                  style={{ color: pct === 100 ? '#10b981' : '#a78bfa' }}>
              {pct}%
            </span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface-s)' }}>
            <div className="h-full rounded-full transition-all duration-700 ease-out"
                 style={{
                   width: `${pct}%`,
                   background: pct === 100
                     ? 'linear-gradient(90deg,#10b981,#34d399)'
                     : 'linear-gradient(90deg,#7c3aed,#3b82f6)',
                 }} />
          </div>
          {pct === 100 && (
            <div className="text-center text-sm font-semibold pt-1" style={{ color: '#10b981' }}>
              All tasks complete — fantastic work today!
            </div>
          )}
        </div>
      )}

      {/* Add Task button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-sm font-bold text-white transition-all duration-200 hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
        style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', boxShadow: '0 4px 20px rgba(124,58,237,0.35)' }}>
        <IconPlus />
        Add Task
      </button>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-sm font-medium"
             style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}>
          <span>{error}</span>
          <button onClick={() => setError('')}
                  className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center hover:scale-110 transition-transform"
                  style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
            ✕
          </button>
        </div>
      )}

      {/* Task list */}
      <div className="space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />
            ))}
          </div>
        ) : todosForDate.length === 0 ? (
          <div className="rounded-2xl flex flex-col items-center gap-3 py-16"
               style={{ border: '1px dashed var(--border)', background: 'var(--surface)' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--surface-s)' }}>
              <IconCalendar />
            </div>
            <div>
              <p className="font-semibold text-center" style={{ color: 'var(--text-2)' }}>No tasks for {formatDisplayDate(selectedDate)}</p>
              <p className="text-sm text-center mt-1" style={{ color: 'var(--text-3)' }}>Click "Add Task" above to get started</p>
            </div>
          </div>
        ) : (
          todosForDate.map(todo => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={toggleTodo}
              onDelete={deleteTodo}
              onEdit={setEditingTodo}
            />
          ))
        )}
      </div>

      {/* Jump to other dates */}
      {!loading && otherDates.length > 0 && (
        <div className="rounded-2xl p-5 space-y-3"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Jump to</p>
          <div className="flex flex-wrap gap-2">
            {otherDates.slice(0, 15).map(([date, info]) => (
              <button key={date} onClick={() => setSelectedDate(date)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-105"
                      style={{ background: 'var(--surface-s)', border: '1px solid var(--border-s)', color: 'var(--text-2)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'; e.currentTarget.style.color = 'var(--text)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-s)'; e.currentTarget.style.color = 'var(--text-2)'; }}>
                {formatDisplayDate(date)}
                {info.pending > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold text-white"
                        style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', minWidth: '1rem' }}>
                    {info.pending}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
