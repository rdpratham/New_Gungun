import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  doc, query, where, serverTimestamp,
} from 'firebase/firestore';

/* ── Color palette ───────────────────────────────────────────────── */
const COLORS = [
  { id: 'default', label: 'Default', bg: 'var(--surface)',          border: 'var(--border)',              dot: '#475569' },
  { id: 'violet',  label: 'Violet',  bg: 'rgba(124,58,237,0.13)',   border: 'rgba(124,58,237,0.32)',      dot: '#7c3aed' },
  { id: 'blue',    label: 'Blue',    bg: 'rgba(59,130,246,0.13)',    border: 'rgba(59,130,246,0.32)',      dot: '#3b82f6' },
  { id: 'green',   label: 'Green',   bg: 'rgba(16,185,129,0.13)',    border: 'rgba(16,185,129,0.32)',      dot: '#10b981' },
  { id: 'yellow',  label: 'Yellow',  bg: 'rgba(245,158,11,0.13)',    border: 'rgba(245,158,11,0.32)',      dot: '#f59e0b' },
  { id: 'red',     label: 'Red',     bg: 'rgba(239,68,68,0.13)',     border: 'rgba(239,68,68,0.32)',       dot: '#ef4444' },
];
const getColor = id => COLORS.find(c => c.id === id) || COLORS[0];

function sortNotes(arr) {
  return [...arr].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0);
  });
}

/* ── Icons ───────────────────────────────────────────────────────── */
const IconPin    = ({ filled }) => <svg className="w-4 h-4" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>;
const IconEdit   = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
const IconTrash  = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16" /></svg>;
const IconCheck  = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
const IconClose  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const IconPlus   = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const IconSearch = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const IconNote   = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;

/* ── NoteModal ───────────────────────────────────────────────────── */
function NoteModal({ initial, onSave, onClose }) {
  const [title,   setTitle]   = useState(initial?.title   || '');
  const [content, setContent] = useState(initial?.content || '');
  const [color,   setColor]   = useState(initial?.color   || 'default');
  const [pinned,  setPinned]  = useState(initial?.pinned  || false);
  const [saving,  setSaving]  = useState(false);

  const col = getColor(color);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try { await onSave({ title, content, color, pinned }); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(4,8,15,0.75)', backdropFilter: 'blur(6px)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-up"
           style={{ background: col.bg, border: `1px solid ${col.border}`, backdropFilter: 'blur(16px)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4"
             style={{ borderBottom: `1px solid ${col.border}` }}>
          <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>
            {initial ? 'Edit Note' : 'New Note'}
          </h3>
          <div className="flex items-center gap-2">
            {/* Pin toggle */}
            <button onClick={() => setPinned(p => !p)}
                    title={pinned ? 'Unpin' : 'Pin this note'}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                    style={{ background: pinned ? 'rgba(245,158,11,0.2)' : 'var(--surface-s)', color: pinned ? '#f59e0b' : 'var(--text-3)', border: '1px solid var(--border-s)' }}>
              <IconPin filled={pinned} />
            </button>
            <button onClick={onClose}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                    style={{ background: 'var(--surface-s)', color: 'var(--text-3)', border: '1px solid var(--border-s)' }}>
              <IconClose />
            </button>
          </div>
        </div>

        {/* Inputs */}
        <div className="px-5 pt-4 space-y-3">
          <input type="text" placeholder="Title (optional)" value={title}
                 onChange={e => setTitle(e.target.value)}
                 className="input-field font-semibold text-base" />
          <textarea placeholder="Write your note here…" value={content}
                    onChange={e => setContent(e.target.value)}
                    rows={5}
                    className="input-field resize-none text-sm leading-relaxed" />

          {/* Color picker */}
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>Color</span>
            <div className="flex items-center gap-2">
              {COLORS.map(c => (
                <button key={c.id} onClick={() => setColor(c.id)}
                        title={c.label}
                        className="w-6 h-6 rounded-full transition-all duration-200 hover:scale-125 flex-shrink-0"
                        style={{
                          background: c.dot,
                          outline: color === c.id ? `2.5px solid ${c.dot}` : '2.5px solid transparent',
                          outlineOffset: '2px',
                          boxShadow: color === c.id ? `0 0 8px ${c.dot}66` : 'none',
                        }} />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-5">
          <button onClick={handleSave}
                  disabled={saving || (!title.trim() && !content.trim())}
                  className="btn-primary w-full flex items-center justify-center gap-2">
            {saving
              ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</>
              : <><IconCheck /> {initial ? 'Update Note' : 'Save Note'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── NoteCard ────────────────────────────────────────────────────── */
function NoteCard({ note, onEdit, onDelete }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const col = getColor(note.color);

  function handleDeleteClick() {
    if (!confirmDel) {
      setConfirmDel(true);
      setTimeout(() => setConfirmDel(false), 2500);
      return;
    }
    onDelete(note.id);
  }

  return (
    <div className="break-inside-avoid mb-4 rounded-2xl overflow-hidden transition-all duration-200 group hover:shadow-xl hover:-translate-y-0.5 relative"
         style={{ background: col.bg, border: `1px solid ${col.border}` }}>

      {/* Pinned badge */}
      {note.pinned && (
        <div className="absolute top-3 right-3 z-10 text-amber-400 pointer-events-none">
          <IconPin filled />
        </div>
      )}

      {/* Content — click opens edit */}
      <div className="px-4 pt-4 pb-2 cursor-pointer min-h-[72px]" onClick={() => onEdit(note)}>
        {note.title && (
          <p className="font-bold text-base mb-2 leading-tight pr-6" style={{ color: 'var(--text)' }}>
            {note.title}
          </p>
        )}
        {note.content && (
          <p className="text-sm leading-relaxed line-clamp-6" style={{ color: 'var(--text-2)' }}>
            {note.content}
          </p>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-end gap-1 px-3 pb-3 transition-all duration-150 opacity-0 group-hover:opacity-100"
           style={{ borderTop: `1px solid ${col.border}`, paddingTop: '0.5rem', marginTop: '0.25rem' }}>
        <button onClick={() => onEdit(note)}
                title="Edit note"
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                style={{ background: 'rgba(59,130,246,0.18)', color: '#60a5fa' }}>
          <IconEdit />
        </button>
        <button onClick={handleDeleteClick}
                title={confirmDel ? 'Confirm delete' : 'Delete note'}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                style={confirmDel
                  ? { background: 'rgba(239,68,68,0.3)', color: '#f87171' }
                  : { background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
          {confirmDel ? <IconCheck /> : <IconTrash />}
        </button>
      </div>
    </div>
  );
}

/* ── NotesPage ───────────────────────────────────────────────────── */
export default function NotesPage({ user }) {
  const [notes,        setNotes]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNote,  setEditingNote]  = useState(null);
  const [searchQuery,  setSearchQuery]  = useState('');

  /* Fetch */
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    getDocs(query(collection(db, 'notes'), where('uid', '==', user.uid)))
      .then(snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setNotes(sortNotes(data));
      })
      .catch(err => console.error('fetchNotes:', err))
      .finally(() => setLoading(false));
  }, [user?.uid]);

  /* Filtered */
  const filtered = notes.filter(n => {
    const q = searchQuery.toLowerCase();
    return !q || n.title?.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q);
  });

  /* Handlers */
  async function handleAdd({ title, content, color, pinned }) {
    try {
      const docRef = await addDoc(collection(db, 'notes'), {
        uid: user.uid, title, content, color, pinned,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      const newNote = { id: docRef.id, uid: user.uid, title, content, color, pinned, updatedAt: { seconds: Date.now() / 1000 } };
      setNotes(prev => sortNotes([newNote, ...prev]));
      setShowAddModal(false);
    } catch (err) { console.error('addNote:', err); }
  }

  async function handleUpdate({ title, content, color, pinned }) {
    try {
      await updateDoc(doc(db, 'notes', editingNote.id), { title, content, color, pinned, updatedAt: serverTimestamp() });
      setNotes(prev => sortNotes(prev.map(n =>
        n.id === editingNote.id ? { ...n, title, content, color, pinned, updatedAt: { seconds: Date.now() / 1000 } } : n
      )));
      setEditingNote(null);
    } catch (err) { console.error('updateNote:', err); }
  }

  async function handleDelete(id) {
    try {
      await deleteDoc(doc(db, 'notes', id));
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (err) { console.error('deleteNote:', err); }
  }

  /* ── Render ── */
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
               style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}>
            <IconNote />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Notes</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              {notes.length} note{notes.length !== 1 ? 's' : ''} · {notes.filter(n => n.pinned).length} pinned
            </p>
          </div>
        </div>

        <button onClick={() => setShowAddModal(true)}
                className="btn-primary flex items-center gap-2">
          <IconPlus /> Add Note
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-3)' }}>
          <IconSearch />
        </div>
        <input type="text" placeholder="Search by title or content…"
               value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
               className="input-field pl-10" />
      </div>

      {/* Notes grid */}
      {loading ? (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="break-inside-avoid mb-4 rounded-2xl animate-pulse"
                 style={{ height: `${100 + i * 28}px`, background: 'var(--surface)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 rounded-2xl"
             style={{ border: '1px dashed var(--border)' }}>
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
               style={{ background: 'var(--surface)' }}>
            {searchQuery ? '🔍' : '📝'}
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg" style={{ color: 'var(--text-2)' }}>
              {searchQuery ? 'No notes found' : 'No notes yet'}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
              {searchQuery ? 'Try a different keyword' : 'Click "Add Note" to create your first note'}
            </p>
          </div>
          {!searchQuery && (
            <button onClick={() => setShowAddModal(true)} className="btn-primary mt-2">
              Create First Note
            </button>
          )}
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
          {filtered.map(note => (
            <NoteCard key={note.id} note={note} onEdit={setEditingNote} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <NoteModal onSave={handleAdd} onClose={() => setShowAddModal(false)} />
      )}
      {editingNote && (
        <NoteModal initial={editingNote} onSave={handleUpdate} onClose={() => setEditingNote(null)} />
      )}
    </div>
  );
}
