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
  const diff = Math.round((new Date(dy, dm - 1, dd) - new Date(ty, tm - 1, td)) / 86400000);
  if (diff === 0)  return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1)  return 'Tomorrow';
  return new Date(dy, dm - 1, dd).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}
function offsetDate(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(dt);
}
function getWeekDays(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const anchor = new Date(y, m - 1, d);
  const dow = anchor.getDay(); // 0=Sun
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - (dow === 0 ? 6 : dow - 1)); // ISO week: Mon start
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return {
      str:     new Intl.DateTimeFormat('en-CA').format(dt),
      dayName: dt.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum:  dt.getDate(),
    };
  });
}

/* ── Priority config ─────────────────────────────────────────────── */
const PRIORITY = {
  high:   { label: 'High',   color: '#f87171', bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.35)',  dot: '#ef4444', accent: '#ef4444' },
  medium: { label: 'Medium', color: '#fbbf24', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.35)', dot: '#f59e0b', accent: '#f59e0b' },
  low:    { label: 'Low',    color: '#34d399', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.35)', dot: '#10b981', accent: '#10b981' },
};

/* ── Icons ───────────────────────────────────────────────────────── */
const IconCheck    = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>;
const IconTrash    = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16" /></svg>;
const IconPlus     = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const IconChevL    = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>;
const IconChevR    = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>;
const IconPencil   = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
const IconX        = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const IconClock    = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconStar     = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;

/* ── Spinner ─────────────────────────────────────────────────────── */
function Spinner() {
  return <div className="w-4 h-4 border-2 rounded-full animate-spin flex-shrink-0" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />;
}

/* ── TaskForm (shared add/edit) ──────────────────────────────────── */
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
         style={{ background: 'rgba(4,8,15,0.85)', backdropFilter: 'blur(12px)' }}>
      <div className="max-w-md w-full rounded-3xl overflow-hidden animate-slide-up shadow-2xl"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between"
             style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}>
          <h2 className="text-base font-bold text-white">{modalTitle}</h2>
          <button onClick={onClose}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all hover:scale-110"
                  style={{ background: 'rgba(255,255,255,0.15)' }}>
            <IconX />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label block mb-1.5">Title <span style={{ color: '#ef4444' }}>*</span></label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                   placeholder="What needs to be done?"
                   className="input-field w-full" autoFocus />
          </div>

          <div>
            <label className="label block mb-1.5">Description <span style={{ color: 'var(--text-3)', fontSize: '0.7rem' }}>(optional)</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
                      placeholder="Add more details…" className="input-field w-full resize-none" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1.5">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                     className="input-field w-full" style={{ colorScheme: 'dark' }} />
            </div>
            <div>
              <label className="label block mb-1.5">Time <span style={{ color: 'var(--text-3)', fontSize: '0.7rem' }}>(optional)</span></label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                     className="input-field w-full" style={{ colorScheme: 'dark' }} />
            </div>
          </div>

          <div>
            <label className="label block mb-2">Priority</label>
            <div className="flex gap-2">
              {(['high', 'medium', 'low']).map(p => {
                const cfg = PRIORITY[p];
                const sel = priority === p;
                return (
                  <button key={p} type="button" onClick={() => setPriority(p)}
                          className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105"
                          style={sel
                            ? { background: `linear-gradient(135deg,${cfg.dot},${cfg.dot}cc)`, color: '#fff', border: 'none', boxShadow: `0 4px 14px ${cfg.dot}44` }
                            : { background: 'var(--surface-s)', border: `1px solid ${cfg.border}`, color: cfg.color }}>
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {err && (
            <p className="text-sm font-medium px-3 py-2 rounded-xl"
               style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              {err}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving}
                    className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving ? <Spinner /> : null}
              {saveLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const AddTodoModal  = ({ selectedDate, onSave, onClose }) =>
  <TaskForm initial={null}  selectedDate={selectedDate} onSave={onSave} onClose={onClose} modalTitle="New Task"  saveLabel="Save Task"   />;
const EditTodoModal = ({ todo, selectedDate, onSave, onClose }) =>
  <TaskForm initial={todo}  selectedDate={selectedDate} onSave={onSave} onClose={onClose} modalTitle="Edit Task" saveLabel="Update Task" />;

/* ── TodoItem ────────────────────────────────────────────────────── */
function TodoItem({ todo, onToggle, onDelete, onEdit }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const pCfg = PRIORITY[todo.priority] || PRIORITY.medium;

  function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 2500); return; }
    onDelete(todo.id);
  }

  return (
    <div className="group flex items-start gap-3 rounded-2xl p-4 transition-all duration-200"
         style={{
           background: 'var(--surface)',
           border: `1px solid var(--border)`,
           borderLeft: `3px solid ${todo.completed ? 'var(--border)' : pCfg.accent}`,
         }}
         onMouseEnter={e => { if (!todo.completed) { e.currentTarget.style.boxShadow = `0 4px 20px ${pCfg.accent}20`; e.currentTarget.style.borderColor = pCfg.accent + '60'; } }}
         onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'var(--border)'; }}>

      {/* Checkbox */}
      <button onClick={() => onToggle(todo)}
              className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center mt-0.5 transition-all duration-200 hover:scale-110 active:scale-95"
              style={todo.completed
                ? { background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', border: 'none', boxShadow: '0 3px 10px rgba(16,185,129,0.4)' }
                : { border: `2px solid var(--border)`, background: 'transparent' }}
              onMouseEnter={e => { if (!todo.completed) { e.currentTarget.style.borderColor = pCfg.accent; e.currentTarget.style.background = pCfg.accent + '15'; } }}
              onMouseLeave={e => { if (!todo.completed) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent'; } }}>
        {todo.completed && <IconCheck />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug"
           style={{ color: todo.completed ? 'var(--text-3)' : 'var(--text)', textDecoration: todo.completed ? 'line-through' : 'none' }}>
          {todo.title || todo.text || '—'}
        </p>

        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {todo.time && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: '#a78bfa' }}>
              <IconClock /> {todo.time}
            </span>
          )}
          {todo.description && (
            <span className="text-xs truncate max-w-[200px]" style={{ color: 'var(--text-3)' }}>
              {todo.description}
            </span>
          )}
        </div>

        <div className="mt-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: pCfg.bg, color: pCfg.color, border: `1px solid ${pCfg.border}` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: pCfg.dot }} />
            {pCfg.label}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-150">
        <button onClick={() => onEdit(todo)}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                style={{ background: 'var(--surface-s)', color: 'var(--text-3)', border: '1px solid var(--border-s)' }}
                title="Edit">
          <IconPencil />
        </button>
        <button onClick={handleDelete}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                style={confirmDel
                  ? { background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' }
                  : { background: 'var(--surface-s)', color: 'var(--text-3)', border: '1px solid var(--border-s)' }}
                title={confirmDel ? 'Click again to confirm' : 'Delete'}>
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

  const today        = todayIST();
  const weekDays     = getWeekDays(selectedDate);
  const todosForDate = todos.filter(t => t.date === selectedDate);
  const doneCount    = todosForDate.filter(t => t.completed).length;
  const totalCount   = todosForDate.length;
  const pct          = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Dates with tasks (for week strip dots)
  const datesWithTasks = new Set(todos.map(t => t.date));

  // Jump-to dates (other weeks/days with tasks)
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
    try { await updateDoc(doc(db, 'todos', todo.id), { completed: !todo.completed }); }
    catch (err) { console.error(err); setError(err.message); }
  }
  async function deleteTodo(id) {
    try { await deleteDoc(doc(db, 'todos', id)); }
    catch (err) { console.error(err); setError(err.message); }
  }

  /* SVG ring */
  const R    = 32;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">

      {/* Modals */}
      {showAddModal && <AddTodoModal selectedDate={selectedDate} onSave={handleAdd} onClose={() => setShowAddModal(false)} />}
      {editingTodo  && <EditTodoModal todo={editingTodo} selectedDate={selectedDate} onSave={handleEdit} onClose={() => setEditingTodo(null)} />}

      {/* ── Hero header ── */}
      <div className="relative rounded-3xl overflow-hidden p-5"
           style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#3b82f6 60%,#06b6d4 100%)' }}>
        <div className="absolute inset-0 opacity-10"
             style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #fff 0%, transparent 55%)' }} />
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 text-white">
            <IconStar />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-black text-white">{title || 'My To-Do'}</h1>
            <p className="text-white/60 text-xs mt-0.5">{formatDisplayDate(selectedDate)}</p>
          </div>
          {/* Progress ring */}
          {totalCount > 0 && (
            <div className="flex flex-col items-center flex-shrink-0">
              <svg width="72" height="72" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="6" />
                <circle cx="40" cy="40" r={R} fill="none"
                        stroke={pct === 100 ? '#34d399' : '#fff'}
                        strokeWidth="6"
                        strokeDasharray={`${CIRC * pct / 100} ${CIRC}`}
                        strokeLinecap="round"
                        transform="rotate(-90 40 40)"
                        style={{ transition: 'stroke-dasharray 0.7s ease' }} />
                <text x="40" y="45" textAnchor="middle" fontSize="14" fontWeight="900" fill="white">{pct}%</text>
              </svg>
              <span className="text-white/55 text-[10px] -mt-0.5">{doneCount}/{totalCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Week strip ── */}
      <div className="rounded-2xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {/* Nav row */}
        <div className="flex items-center justify-between mb-3 px-1">
          <button onClick={() => setSelectedDate(d => offsetDate(d, -7))}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                  style={{ background: 'var(--surface-s)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            <IconChevL />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
              {new Date(...selectedDate.split('-').map((v,i) => i===1 ? v-1 : +v)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </span>
            {selectedDate !== today && (
              <button onClick={() => setSelectedDate(today)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all hover:scale-105"
                      style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>
                Today
              </button>
            )}
          </div>
          <button onClick={() => setSelectedDate(d => offsetDate(d, 7))}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                  style={{ background: 'var(--surface-s)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            <IconChevR />
          </button>
        </div>

        {/* 7-day strip */}
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(day => {
            const isSelected = day.str === selectedDate;
            const isToday    = day.str === today;
            const hasTasks   = datesWithTasks.has(day.str);
            return (
              <button
                key={day.str}
                onClick={() => setSelectedDate(day.str)}
                className="flex flex-col items-center py-2.5 rounded-2xl transition-all duration-200 hover:scale-105"
                style={isSelected
                  ? { background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', boxShadow: '0 4px 14px rgba(124,58,237,0.35)' }
                  : isToday
                  ? { background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }
                  : { background: 'var(--surface-s)' }}>
                <span className="text-[10px] font-semibold"
                      style={{ color: isSelected ? 'rgba(255,255,255,0.75)' : 'var(--text-3)' }}>
                  {day.dayName}
                </span>
                <span className="text-base font-black leading-tight mt-0.5"
                      style={{ color: isSelected ? '#fff' : isToday ? '#a78bfa' : 'var(--text)' }}>
                  {day.dayNum}
                </span>
                <span className="w-1.5 h-1.5 rounded-full mt-1"
                      style={{ background: hasTasks ? (isSelected ? 'rgba(255,255,255,0.7)' : '#a78bfa') : 'transparent' }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Task progress bar (if tasks exist) ── */}
      {totalCount > 0 && (
        <div className="rounded-2xl px-5 py-4 space-y-2.5"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--text-2)' }}>
              <span className="font-black text-base" style={{ color: 'var(--text)' }}>{doneCount}</span>
              {' '}of {totalCount} tasks done today
            </span>
            <span className="font-black text-lg transition-colors"
                  style={{ color: pct === 100 ? '#10b981' : '#a78bfa' }}>
              {pct}%
            </span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-s)' }}>
            <div className="h-full rounded-full transition-all duration-700"
                 style={{
                   width: `${pct}%`,
                   background: pct === 100 ? 'linear-gradient(90deg,#10b981,#34d399)' : 'linear-gradient(90deg,#7c3aed,#3b82f6)',
                 }} />
          </div>
          {pct === 100 && (
            <p className="text-center text-sm font-bold" style={{ color: '#10b981' }}>
              All done — great work today! 🎉
            </p>
          )}
        </div>
      )}

      {/* ── Add Task button ── */}
      <button
        onClick={() => setShowAddModal(true)}
        className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-sm font-bold text-white transition-all duration-200 hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
        style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', boxShadow: '0 4px 20px rgba(124,58,237,0.35)' }}>
        <IconPlus />
        Add Task for {formatDisplayDate(selectedDate)}
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-sm"
             style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}>
          <span>{error}</span>
          <button onClick={() => setError('')}
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 hover:scale-110 transition-transform"
                  style={{ background: 'rgba(239,68,68,0.2)' }}>
            <IconX />
          </button>
        </div>
      )}

      {/* ── Task list ── */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />)}
        </div>
      ) : todosForDate.length === 0 ? (
        <div className="rounded-2xl flex flex-col items-center gap-3 py-16"
             style={{ border: '1px dashed var(--border)', background: 'var(--surface)' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl"
               style={{ background: 'var(--surface-s)' }}>
            {selectedDate < today ? '📅' : selectedDate === today ? '✨' : '🗓'}
          </div>
          <div className="text-center">
            <p className="font-bold" style={{ color: 'var(--text-2)' }}>
              No tasks for {formatDisplayDate(selectedDate)}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
              Click "Add Task" above to get started
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {todosForDate.map(todo => (
            <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} onEdit={setEditingTodo} />
          ))}
        </div>
      )}

      {/* ── Jump to other dates ── */}
      {!loading && otherDates.length > 0 && (
        <div className="rounded-2xl p-5 space-y-3"
             style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
            Other dates with tasks
          </p>
          <div className="flex flex-wrap gap-2">
            {otherDates.slice(0, 15).map(([date, info]) => (
              <button key={date} onClick={() => setSelectedDate(date)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105"
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
