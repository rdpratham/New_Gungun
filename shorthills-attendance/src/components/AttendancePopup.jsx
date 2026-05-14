import { useState } from 'react';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../firebase';
import WebcamCapture from './WebcamCapture';

export default function AttendancePopup({ user, employeeData, onSuccess }) {
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [workSummary, setWorkSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const getISTDate = () => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
  };

  const handleSubmit = async () => {
    setError('');
    if (!capturedPhoto) { setError('Please capture a photo first.'); return; }
    if (workSummary.trim().length < 50) { setError('Work summary must be at least 50 characters.'); return; }

    setSubmitting(true);
    try {
      const dateStr = getISTDate();
      const photoRef = ref(storage, `attendance/${user.uid}/${dateStr}.jpg`);
      await uploadString(photoRef, capturedPhoto, 'data_url');
      const photoURL = await getDownloadURL(photoRef);

      await addDoc(collection(db, 'attendance'), {
        employeeId: employeeData.employeeId,
        employeeName: employeeData.name,
        employeeUID: user.uid,
        date: dateStr,
        submittedAt: serverTimestamp(),
        workSummary: workSummary.trim(),
        photoURL,
      });

      onSuccess();
    } catch (err) {
      setError('Submission failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-navy-800 border border-navy-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-navy-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-electric-500 rounded-xl flex items-center justify-center font-bold text-white">SA</div>
            <div>
              <h2 className="text-white font-bold text-xl">Daily Attendance</h2>
              <p className="text-gray-400 text-sm">Shorthills AI — Shift: 5:00 PM – 1:30 AM IST</p>
            </div>
          </div>
          <div className="mt-3 px-3 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <p className="text-orange-300 text-sm">Please submit your attendance to continue. This form cannot be dismissed.</p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <WebcamCapture onCapture={setCapturedPhoto} />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              What did you work on today?
              <span className="text-gray-500 ml-1">(min. 50 characters)</span>
            </label>
            <textarea
              value={workSummary}
              onChange={e => setWorkSummary(e.target.value)}
              rows={4}
              placeholder="e.g. Completed API integration, fixed 3 bugs in dashboard, attended standup..."
              className="w-full bg-navy-700 border border-navy-600 focus:border-electric-500 text-white placeholder-gray-500 rounded-xl px-4 py-3 outline-none resize-none text-sm transition-colors"
            />
            <p className={`text-xs ${workSummary.length >= 50 ? 'text-green-400' : 'text-gray-500'}`}>
              {workSummary.length}/50 characters minimum
            </p>
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || !capturedPhoto || workSummary.trim().length < 50}
            className="w-full py-4 bg-electric-500 hover:bg-electric-600 disabled:bg-navy-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Submitting...
              </>
            ) : 'Submit Attendance'}
          </button>
        </div>
      </div>
    </div>
  );
}
