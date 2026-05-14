import { useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '../firebase';
import WebcamCapture from './WebcamCapture';

const MIN_SUMMARY_LENGTH = 50;

function getISTDateString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export default function AttendancePopup({ user, employeeData, onSubmitted }) {
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [workSummary, setWorkSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleCapture = (photoData) => {
    setCapturedPhoto(photoData);
    setError('');
  };

  const handleSubmit = async () => {
    setError('');

    if (!capturedPhoto?.blob) {
      setError('Please capture your photo first.');
      return;
    }
    if (workSummary.trim().length < MIN_SUMMARY_LENGTH) {
      setError(`Work summary must be at least ${MIN_SUMMARY_LENGTH} characters. Currently: ${workSummary.trim().length}`);
      return;
    }

    setSubmitting(true);
    try {
      const dateStr = getISTDateString();
      const employeeId = employeeData?.employeeId || user.uid;

      // Upload photo to Firebase Storage
      const photoRef = ref(storage, `attendance/${employeeId}/${dateStr}.jpg`);
      await uploadBytes(photoRef, capturedPhoto.blob, { contentType: 'image/jpeg' });
      const photoURL = await getDownloadURL(photoRef);

      // Save attendance record to Firestore
      await addDoc(collection(db, 'attendance'), {
        employeeId,
        employeeUid: user.uid,
        employeeName: employeeData?.name || user.displayName || user.email,
        date: dateStr,
        submittedAt: serverTimestamp(),
        workSummary: workSummary.trim(),
        photoURL,
      });

      setSuccess(true);
      setTimeout(() => onSubmitted?.(), 2000);
    } catch (err) {
      console.error(err);
      setError('Submission failed. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-navy-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center animate-fade-in">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Attendance Submitted!</h2>
          <p className="text-gray-400">Your attendance for today has been recorded successfully.</p>
          <p className="text-electric-400 text-sm mt-2">Great work today! See you tomorrow.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-navy-900/97 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="card max-w-2xl w-full my-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-navy-700">
          <div className="w-10 h-10 bg-electric-500 rounded-lg flex items-center justify-center text-white font-bold">S</div>
          <div>
            <h2 className="text-xl font-bold text-white">Daily Attendance Check-In</h2>
            <p className="text-sm text-electric-400">
              Shift: 5:00 PM – 1:30 AM IST &nbsp;|&nbsp; {new Intl.DateTimeFormat('en-IN', {
                timeZone: 'Asia/Kolkata', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              }).format(new Date())}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Webcam section */}
          <WebcamCapture onCapture={handleCapture} onError={(msg) => setError(msg)} />

          {/* Work summary */}
          <div>
            <label className="label">
              What did you work on today?
              <span className="text-red-400 ml-1">*</span>
            </label>
            <textarea
              value={workSummary}
              onChange={(e) => { setWorkSummary(e.target.value); setError(''); }}
              rows={5}
              placeholder="e.g. Completed API integration, fixed 3 bugs in dashboard, attended standup, reviewed 2 PRs..."
              className="input-field resize-none"
              maxLength={2000}
            />
            <div className="flex justify-between mt-1">
              <span className={`text-xs ${workSummary.trim().length < MIN_SUMMARY_LENGTH ? 'text-red-400' : 'text-green-400'}`}>
                {workSummary.trim().length}/{MIN_SUMMARY_LENGTH} minimum characters
              </span>
              <span className="text-xs text-gray-500">{workSummary.length}/2000</span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !capturedPhoto}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Submitting Attendance...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Submit Attendance
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-500">
            This popup cannot be dismissed without submitting attendance.
          </p>
        </div>
      </div>
    </div>
  );
}
