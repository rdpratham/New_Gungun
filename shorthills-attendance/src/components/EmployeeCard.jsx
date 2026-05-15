import { useState } from 'react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function EmployeeCard({ employee, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'employees', employee.id));
      onDeleted?.(employee.id);
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete employee. Please try again.');
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <div className="card flex items-center gap-4 animate-fade-in hover:border-violet-500/40 transition-all duration-200">
      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border border-white/10"
           style={{ background: 'linear-gradient(135deg, #7c3aed22, #3b82f622)' }}>
        {employee.photoURL ? (
          <img
            src={employee.photoURL}
            alt={employee.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-violet-400 text-xl font-bold">
            {employee.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white truncate">{employee.name}</div>
        <div className="text-sm text-gray-500 truncate">{employee.email}</div>
        <div className="text-xs text-violet-400 mt-0.5">ID: {employee.employeeId}</div>
      </div>

      {/* Delete controls */}
      {confirming ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-400">Sure?</span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs bg-red-500/20 hover:bg-red-500/40 border border-red-500/40 text-red-400
                       px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
          >
            {deleting ? '...' : 'Yes'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400
                       px-2 py-1 rounded-lg transition-colors"
          >
            No
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="flex-shrink-0 text-gray-600 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10"
          title="Delete employee"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}
