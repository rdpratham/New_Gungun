import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, addDoc, onSnapshot, updateDoc, deleteDoc,
  doc, query, where, serverTimestamp,
} from 'firebase/firestore';

const PALETTES = [
  { bg: 'rgba(124,58,237,0.15)', border: 'rgba(124,58,237,0.3)', text: '#a78bfa', grad: 'linear-gradient(135deg,#7c3aed,#a78bfa)' },
  { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.3)', text: '#60a5fa', grad: 'linear-gradient(135deg,#3b82f6,#60a5fa)' },
  { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', text: '#34d399', grad: 'linear-gradient(135deg,#10b981,#34d399)' },
  { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', text: '#fbbf24', grad: 'linear-gradient(135deg,#f59e0b,#fbbf24)' },
  { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.3)',  text: '#f87171', grad: 'linear-gradient(135deg,#ef4444,#f87171)' },
  { bg: 'rgba(6,182,212,0.15)',  border: 'rgba(6,182,212,0.3)',  text: '#22d3ee', grad: 'linear-gradient(135deg,#06b6d4,#22d3ee)' },
];

function getPalette(title) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = ((hash << 5) - hash) + title.charCodeAt(i);
  return PALETTES[Math.abs(hash) % PALETTES.length];
}

const IconKey = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

const IconPlus = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const IconSearch = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const IconClose = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const IconCopy = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const IconEye = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const IconEyeOff = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

const IconEdit = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const IconTrash = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16" />
  </svg>
);

const IconUser = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const IconLock = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const IconNote = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

function ViewModal({ credential, onClose, onEdit, onDelete }) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const palette = getPalette(credential.title || ' ');

  function handleCopy(key, value) {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  }

  function handleDeleteClick() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(credential.id);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(4,8,15,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-up"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div
          className="px-6 pt-6 pb-5 flex items-center gap-4"
          style={{ background: palette.grad }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-xl shadow-lg"
            style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}
          >
            {(credential.title || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-white leading-tight truncate">{credential.title}</h3>
            {credential.username && (
              <p className="text-sm text-white/75 truncate mt-0.5">{credential.username}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white/80 hover:text-white transition-all hover:scale-110"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <IconClose />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {credential.username && (
            <div>
              <p className="label mb-1.5 flex items-center gap-1.5">
                <IconUser />
                Username / Email
              </p>
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--border-s)' }}
              >
                <span className="flex-1 text-sm font-mono truncate" style={{ color: 'var(--text)' }}>
                  {credential.username}
                </span>
                <button
                  onClick={() => handleCopy('username', credential.username)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:scale-105 flex-shrink-0"
                  style={{
                    background: copied === 'username' ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.15)',
                    color: copied === 'username' ? '#34d399' : '#60a5fa',
                    border: copied === 'username' ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(59,130,246,0.3)',
                  }}
                >
                  {copied === 'username' ? 'Copied!' : <><IconCopy /> Copy</>}
                </button>
              </div>
            </div>
          )}

          {credential.password && (
            <div>
              <p className="label mb-1.5 flex items-center gap-1.5">
                <IconLock />
                Password
              </p>
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--border-s)' }}
              >
                <span className="flex-1 text-sm font-mono truncate" style={{ color: 'var(--text)' }}>
                  {showPassword ? credential.password : '••••••••'}
                </span>
                <button
                  onClick={() => setShowPassword(p => !p)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110 flex-shrink-0"
                  style={{ background: 'var(--surface-s)', color: 'var(--text-3)', border: '1px solid var(--border-s)' }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <IconEyeOff /> : <IconEye />}
                </button>
                <button
                  onClick={() => handleCopy('password', credential.password)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:scale-105 flex-shrink-0"
                  style={{
                    background: copied === 'password' ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.15)',
                    color: copied === 'password' ? '#34d399' : '#60a5fa',
                    border: copied === 'password' ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(59,130,246,0.3)',
                  }}
                >
                  {copied === 'password' ? 'Copied!' : <><IconCopy /> Copy</>}
                </button>
              </div>
            </div>
          )}

          {credential.comments && (
            <div>
              <p className="label mb-1.5 flex items-center gap-1.5">
                <IconNote />
                Notes
              </p>
              <div
                className="px-3 py-2.5 rounded-xl text-sm leading-relaxed"
                style={{
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border-s)',
                  color: 'var(--text-2)',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '140px',
                  overflowY: 'auto',
                }}
              >
                {credential.comments}
              </div>
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            {!confirmDelete ? (
              <button
                onClick={handleDeleteClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all hover:scale-105"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <IconTrash /> Delete
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-3)' }}>Sure?</span>
                <button
                  onClick={() => onDelete(credential.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
                  style={{ background: 'rgba(239,68,68,0.3)', color: '#f87171', border: '1px solid rgba(239,68,68,0.5)' }}
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                  style={{ background: 'var(--surface-s)', color: 'var(--text-3)', border: '1px solid var(--border-s)' }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          <button onClick={onEdit} className="btn-primary flex items-center gap-1.5">
            <IconEdit /> Edit
          </button>
        </div>
      </div>
    </div>
  );
}

function CredentialFormModal({ initial, onSave, onClose, saving }) {
  const [title,    setTitle]    = useState(initial?.title    || '');
  const [username, setUsername] = useState(initial?.username || '');
  const [password, setPassword] = useState(initial?.password || '');
  const [comments, setComments] = useState(initial?.comments || '');
  const [showPass, setShowPass] = useState(false);

  const isEdit = Boolean(initial);

  async function handleSubmit() {
    if (!title.trim() || saving) return;
    await onSave({ title: title.trim(), username: username.trim(), password, comments: comments.trim() });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(4,8,15,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-up"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div
          className="px-6 pt-6 pb-5 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#3b82f6 60%,#06b6d4 100%)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg"
              style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}
            >
              <IconKey />
            </div>
            <h3 className="font-bold text-lg text-white">
              {isEdit ? 'Edit Credential' : 'Add Credential'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/80 hover:text-white transition-all hover:scale-110"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <IconClose />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="label mb-1.5 flex items-center gap-1">
              Title
              <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Gmail, GitHub, Netflix"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="input-field"
              autoFocus
            />
          </div>

          <div>
            <label className="label mb-1.5">Username / Email</label>
            <input
              type="text"
              placeholder="username or email"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="label mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-all hover:scale-110"
                style={{ color: 'var(--text-3)' }}
                tabIndex={-1}
              >
                {showPass ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </div>

          <div>
            <label className="label mb-1.5">Notes / Comments</label>
            <textarea
              placeholder="Any additional info…"
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={3}
              className="input-field resize-none"
            />
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !title.trim()}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              isEdit ? 'Save Changes' : 'Add Credential'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function CredentialCard({ credential, onClick }) {
  const palette = getPalette(credential.title || ' ');
  const initial = (credential.title || '?')[0].toUpperCase();

  return (
    <div
      className="card rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 group"
      style={{ border: `1px solid ${palette.border}`, background: 'var(--surface)' }}
      onClick={onClick}
    >
      <div className="h-1.5" style={{ background: palette.grad }} />

      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0 text-white shadow-sm"
            style={{ background: palette.grad }}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm leading-tight truncate" style={{ color: 'var(--text)' }}>
              {credential.title}
            </p>
            {credential.username && (
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-3)' }}>
                {credential.username}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {credential.password && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: palette.bg, color: palette.text, border: `1px solid ${palette.border}` }}
            >
              <IconLock />
              Password saved
            </span>
          )}
          {credential.comments && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(100,116,139,0.12)', color: 'var(--text-3)', border: '1px solid var(--border-s)' }}
            >
              <IconNote />
              Note
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CredentialsPage({ user }) {
  const [credentials, setCredentials] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [selected,    setSelected]    = useState(null);
  const [editing,     setEditing]     = useState(null);
  const [showAdd,     setShowAdd]     = useState(false);
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'credentials'), where('uid', '==', user.uid)),
      snap => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setCredentials(data);
        setLoading(false);
      },
      err => { console.error(err); setLoading(false); }
    );
    return () => unsub();
  }, [user?.uid]);

  const filtered = credentials.filter(c => {
    const q = search.toLowerCase();
    return !q || c.title?.toLowerCase().includes(q) || c.username?.toLowerCase().includes(q);
  });

  async function handleAdd({ title, username, password, comments }) {
    setSaving(true);
    try {
      await addDoc(collection(db, 'credentials'), {
        uid: user.uid, title, username, password, comments,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setShowAdd(false);
    } catch (err) {
      console.error('addCredential:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate({ title, username, password, comments }) {
    if (!editing) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'credentials', editing.id), {
        title, username, password, comments, updatedAt: serverTimestamp(),
      });
      setEditing(null);
      setSelected(null);
    } catch (err) {
      console.error('updateCredential:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteDoc(doc(db, 'credentials', id));
      setSelected(null);
    } catch (err) {
      console.error('deleteCredential:', err);
    }
  }

  function handleEditFromView() {
    setEditing(selected);
    setSelected(null);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}
          >
            <IconKey />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Credentials</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              {credentials.length} saved credential{credentials.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <IconPlus /> Add Credential
        </button>
      </div>

      {credentials.length > 0 && (
        <div className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-3)' }}>
            <IconSearch />
          </div>
          <input
            type="text"
            placeholder="Search by title or username…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div
              key={i}
              className="rounded-2xl animate-pulse"
              style={{ height: '112px', background: 'var(--surface)' }}
            />
          ))}
        </div>
      ) : credentials.length === 0 ? (
        <div
          className="flex flex-col items-center gap-4 py-24 rounded-2xl"
          style={{ border: '1px dashed var(--border)' }}
        >
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--surface)' }}
          >
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-3)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg" style={{ color: 'var(--text-2)' }}>No credentials yet</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
              Click "Add Credential" to store your first password
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary mt-2 flex items-center gap-2">
            <IconPlus /> Add Credential
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="flex flex-col items-center gap-4 py-20 rounded-2xl"
          style={{ border: '1px dashed var(--border)' }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--surface)' }}
          >
            <IconSearch />
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg" style={{ color: 'var(--text-2)' }}>No results found</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Try a different title or username</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(cred => (
            <CredentialCard key={cred.id} credential={cred} onClick={() => setSelected(cred)} />
          ))}
        </div>
      )}

      {selected && (
        <ViewModal
          credential={selected}
          onClose={() => setSelected(null)}
          onEdit={handleEditFromView}
          onDelete={handleDelete}
        />
      )}

      {(showAdd || editing) && (
        <CredentialFormModal
          initial={editing || null}
          onSave={editing ? handleUpdate : handleAdd}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          saving={saving}
        />
      )}
    </div>
  );
}
