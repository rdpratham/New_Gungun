import { useState } from 'react';
import { doc, updateDoc, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import WebcamCapture from './WebcamCapture';
import { getDescriptorFromDataURL } from '../utils/faceRecognition';

function compressDataURL(dataURL) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxW = 400;
      const ratio = Math.min(1, maxW / img.width);
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.5));
    };
    img.src = dataURL;
  });
}

export default function EditEmployeeModal({ employee, onClose, onUpdated, onDeleted }) {
  const [name, setName]           = useState(employee.name || '');
  const [employeeId, setEmpId]    = useState(employee.employeeId || '');
  const [newPhoto, setNewPhoto]   = useState(null);
  const [retakingPhoto, setRetakingPhoto] = useState(false);
  const [faceStatus, setFaceStatus]       = useState(null); // null | 'detecting' | 'ok' | 'noface'
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  const handleCapture = async (photoData) => {
    if (!photoData) { setNewPhoto(null); setFaceStatus(null); return; }
    setFaceStatus('detecting');
    setError('');
    try {
      const descriptor = await getDescriptorFromDataURL(photoData.dataURL);
      if (!descriptor) {
        setFaceStatus('noface');
        setError('No face detected. Please retake with the face clearly visible.');
        setNewPhoto(null);
        return;
      }
      setNewPhoto({ ...photoData, descriptor });
      setFaceStatus('ok');
    } catch {
      setNewPhoto(photoData);
      setFaceStatus('ok');
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !employeeId.trim()) {
      setError('Name and Employee ID are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updates = {
        name: name.trim(),
        employeeId: employeeId.trim(),
      };
      if (newPhoto?.descriptor) {
        const compressed = await compressDataURL(newPhoto.dataURL);
        updates.photoURL = compressed;
        updates.faceDescriptor = newPhoto.descriptor;
      }
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

      // Delete all attendance records for this employee
      const attSnap = await getDocs(query(
        collection(db, 'attendance'),
        where('employeeUid', '==', employee.id)
      ));
      attSnap.docs.forEach(d => batch.delete(d.ref));

      // Delete the employee Firestore document
      batch.delete(doc(db, 'employees', employee.id));

      await batch.commit();

      // Firebase Auth account deletion requires Admin SDK (server-side only).
      // Without the Firestore doc the app auto-signs-out this user on next load,
      // so the account is permanently blocked even though the Auth record remains.

      onDeleted?.(employee.id);
      onClose();
    } catch (err) {
      setError('Delete failed: ' + err.message);
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
         style={{ background: 'rgba(4, 8, 15, 0.95)', backdropFilter: 'blur(16px)' }}>
      <div className="card max-w-xl w-full my-4 animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white">Manage Employee</h2>
            <p className="text-xs text-gray-500 mt-0.5">{employee.email}</p>
          </div>
          <button onClick={onClose}
                  className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {success ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-emerald-400 font-medium">{success}</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Current photo preview */}
            {!retakingPhoto && (
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-white/10"
                     style={{ background: 'linear-gradient(135deg, #7c3aed22, #3b82f622)' }}>
                  {(newPhoto?.dataURL || employee.photoURL) ? (
                    <img src={newPhoto?.dataURL || employee.photoURL} alt={employee.name}
                         className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-violet-400 text-2xl font-bold">
                      {employee.name?.charAt(0) || '?'}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-white font-medium">{employee.name}</p>
                  <p className="text-xs text-gray-500">Current photo</p>
                  <button
                    onClick={() => { setRetakingPhoto(true); setNewPhoto(null); setFaceStatus(null); }}
                    className="mt-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Retake face photo
                  </button>
                </div>
                {faceStatus === 'ok' && (
                  <span className="status-badge-green text-xs flex-shrink-0">New face saved</span>
                )}
              </div>
            )}

            {/* Webcam retake */}
            {retakingPhoto && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-white">Capture new face photo</p>
                  <button onClick={() => { setRetakingPhoto(false); setNewPhoto(null); setFaceStatus(null); }}
                          className="text-xs text-gray-500 hover:text-gray-300">Cancel retake</button>
                </div>
                <div className="bg-navy-900/60 border border-white/5 rounded-xl p-4">
                  <WebcamCapture onCapture={handleCapture} onError={(m) => setError(m)} />
                </div>
                {faceStatus === 'detecting' && (
                  <div className="flex items-center gap-2 mt-2 text-amber-400 text-xs">
                    <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    Detecting face...
                  </div>
                )}
                {faceStatus === 'ok' && (
                  <div className="flex items-center gap-2 mt-2 text-emerald-400 text-xs">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Face detected — new photo ready
                  </div>
                )}
              </div>
            )}

            {/* Edit fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name</label>
                <input type="text" value={name} onChange={(e) => { setName(e.target.value); setError(''); }}
                       className="input-field" placeholder="Full name" />
              </div>
              <div>
                <label className="label">Employee ID</label>
                <input type="text" value={employeeId} onChange={(e) => { setEmpId(e.target.value); setError(''); }}
                       className="input-field" placeholder="e.g. EMP001" />
              </div>
            </div>

            <div>
              <label className="label">Email (read-only)</label>
              <div className="input-field text-gray-500 cursor-not-allowed select-none">{employee.email}</div>
              <p className="text-xs text-gray-600 mt-1">Email is linked to the login account and cannot be changed here.</p>
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

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                      className="btn-primary flex-1 flex items-center justify-center gap-2">
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
                ) : 'Save Changes'}
              </button>
            </div>

            {/* Delete section */}
            <div className="pt-3 border-t border-white/10">
              {confirmDelete ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <p className="text-red-300 text-sm font-medium mb-1">Delete {employee.name || employee.employeeId}?</p>
                  <p className="text-gray-500 text-xs mb-3">
                    This permanently deletes their profile and <strong className="text-gray-400">all attendance records</strong>.
                    Their login will stop working immediately.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDelete(false)}
                            className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
                    <button onClick={handleDelete} disabled={deleting}
                            className="flex-1 py-2 text-sm font-semibold rounded-xl text-white transition-all duration-200
                                       flex items-center justify-center gap-2 disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)' }}>
                      {deleting ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Deleting...</>
                      ) : 'Yes, Delete Employee'}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                        className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300
                                   text-sm py-2 rounded-xl border border-red-500/20 hover:bg-red-500/10 transition-all duration-200">
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
