import { useState } from 'react';
import { doc, updateDoc, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

export default function EditEmployeeModal({ employee, onClose, onUpdated, onDeleted }) {
  const [form, setForm] = useState({
    name:       employee.name       || '',
    employeeId: employee.employeeId || '',
    mobile:     employee.mobile     || '',
    joiningDate:employee.joiningDate|| '',
    team:       employee.team       || 'Sales Team',
  });
  const [saving, setSaving]             = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSave = async () => {
    if (!form.employeeId.trim()) { setError('Employee ID is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const updates = {
        name:        form.name.trim(),
        employeeId:  form.employeeId.trim(),
        mobile:      form.mobile.trim(),
        joiningDate: form.joiningDate,
        team:        form.team.trim() || 'Sales Team',
      };
      await updateDoc(doc(db, 'employees', employee.id), updates);
      setSuccess('Employee updated successfully!');
      onUpdated?.({ ...employee, ...updates });
      setTimeout(onClose, 1200);
    } catch (err) {
      setError('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const batch = writeBatch(db);

      // Collect all attendance docs across three possible field values
      const queries = [
        getDocs(query(collection(db, 'attendance'), where('employeeUid', '==', employee.id))),
        getDocs(query(collection(db, 'attendance'), where('employeeId',  '==', employee.id))),
      ];
      if (employee.employeeId) {
        queries.push(getDocs(query(collection(db, 'attendance'), where('employeeId', '==', employee.employeeId))));
      }

      const snaps = await Promise.all(queries);
      const seen = new Set();
      snaps.forEach(snap => snap.docs.forEach(d => {
        if (!seen.has(d.id)) { seen.add(d.id); batch.delete(d.ref); }
      }));

      batch.delete(doc(db, 'employees', employee.id));
      await batch.commit();
      onDeleted?.(employee.id);
      onClose();
    } catch (err) {
      setError('Delete failed: ' + err.message);
      setDeleting(false);
    }
  };

  const photoSrc = employee.photoURL;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
         style={{ background: 'rgba(4, 8, 15, 0.95)', backdropFilter: 'blur(16px)' }}>
      <div className="card max-w-2xl w-full my-6 animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Employee Details</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{employee.email}</p>
          </div>
          <button onClick={onClose}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--text-3)' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-emerald-400 font-medium">{success}</p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* Profile photo + status */}
            <div className="flex items-center gap-5 p-4 rounded-xl border" style={{ background: 'var(--surface-s)', borderColor: 'var(--border-s)' }}>
              <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 border border-violet-500/30">
                {photoSrc ? (
                  <img src={photoSrc} alt="Employee" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-violet-400 text-3xl font-bold"
                       style={{ background: 'linear-gradient(135deg,#7c3aed22,#3b82f622)' }}>
                    {employee.employeeId?.charAt(0) || '?'}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold" style={{ color: 'var(--text)' }}>{employee.email}</p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>ID: {employee.employeeId || '—'}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {employee.profileComplete
                    ? <span className="status-badge-green">Profile Complete</span>
                    : <span className="status-badge-yellow">Setup Pending</span>
                  }
                  {employee.createdAt && (
                    <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                      Added {new Date(employee.createdAt?.toDate?.() || employee.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Editable fields */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>
                Employee Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Full Name</label>
                  <input type="text" name="name" value={form.name} onChange={handleChange}
                         placeholder="e.g. Pratham Jain" className="input-field" />
                </div>
                <div>
                  <label className="label">Employee ID</label>
                  <input type="text" name="employeeId" value={form.employeeId} onChange={handleChange}
                         placeholder="e.g. EMP001" className="input-field" />
                </div>
                <div>
                  <label className="label">Team</label>
                  <input type="text" name="team" value={form.team} onChange={handleChange}
                         placeholder="Sales Team" className="input-field" />
                </div>
                <div>
                  <label className="label">Mobile Number</label>
                  <input type="tel" name="mobile" value={form.mobile} onChange={handleChange}
                         placeholder="+91 98765 43210" maxLength={15} className="input-field" />
                </div>
                <div>
                  <label className="label">Joining Date</label>
                  <input type="date" name="joiningDate" value={form.joiningDate} onChange={handleChange}
                         className="input-field" style={{ colorScheme: 'auto' }} />
                </div>
              </div>
            </div>

            {/* Read-only fields */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>
                Account (Read-only)
              </h3>
              <div>
                <label className="label">Work Email</label>
                <div className="input-field cursor-not-allowed select-none opacity-60">{employee.email}</div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Email is tied to the login account and cannot be changed here.</p>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Save / Cancel */}
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                      className="btn-primary flex-1 flex items-center justify-center gap-2">
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
                  : 'Save Changes'}
              </button>
            </div>

            {/* Delete */}
            <div className="pt-3 border-t" style={{ borderColor: 'var(--border-s)' }}>
              {confirmDelete ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <p className="text-red-300 text-sm font-medium mb-1">Delete {employee.employeeId || employee.email}?</p>
                  <p className="text-sm mb-3" style={{ color: 'var(--text-3)' }}>
                    Permanently deletes their profile, all attendance records, and revokes login access.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
                    <button onClick={handleDelete} disabled={deleting}
                            className="flex-1 py-2 text-sm font-semibold rounded-xl text-white flex items-center justify-center gap-2 disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)' }}>
                      {deleting
                        ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Deleting...</>
                        : 'Yes, Delete Employee'}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                        className="w-full flex items-center justify-center gap-2 text-sm py-2 rounded-xl border transition-all duration-200"
                        style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.2)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Employee
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
