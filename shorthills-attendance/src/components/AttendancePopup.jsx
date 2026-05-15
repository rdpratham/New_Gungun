import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import WebcamCapture from './WebcamCapture';
import { getDescriptorFromDataURL, isFaceMatch } from '../utils/faceRecognition';
import { getCurrentLocation, isWithinOffice } from '../utils/locationVerification';

const MIN_SUMMARY_LENGTH = 50;

function getISTDateString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function compressImage(dataURL) {
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

// locationStatus: 'checking' | 'ok' | 'outside' | 'error'
// faceStatus:     'waiting'  | 'verifying' | 'ok' | 'mismatch' | 'noface'
export default function AttendancePopup({ user, employeeData, attendanceType = 'signin', onSubmitted }) {
  const [locationStatus, setLocationStatus] = useState('checking');
  const [locationInfo, setLocationInfo]     = useState(null);
  const [locationError, setLocationError]   = useState('');

  const [capturedPhoto, setCapturedPhoto]   = useState(null);
  const [faceStatus, setFaceStatus]         = useState('waiting');
  const [faceError, setFaceError]           = useState('');

  const [workSummary, setWorkSummary]       = useState('');
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState('');
  const [success, setSuccess]               = useState(false);

  const isSignIn = attendanceType === 'signin';

  // Auto-check location on mount
  useEffect(() => {
    let cancelled = false;
    getCurrentLocation()
      .then((coords) => {
        if (cancelled) return;
        const result = isWithinOffice(coords.lat, coords.lng);
        setLocationInfo({ ...coords, ...result });
        setLocationStatus(result.withinRange ? 'ok' : 'outside');
      })
      .catch((err) => {
        if (cancelled) return;
        setLocationError(err.message);
        setLocationStatus('error');
      });
    return () => { cancelled = true; };
  }, []);

  const retryLocation = () => {
    setLocationStatus('checking');
    setLocationError('');
    setLocationInfo(null);
    getCurrentLocation()
      .then((coords) => {
        const result = isWithinOffice(coords.lat, coords.lng);
        setLocationInfo({ ...coords, ...result });
        setLocationStatus(result.withinRange ? 'ok' : 'outside');
      })
      .catch((err) => {
        setLocationError(err.message);
        setLocationStatus('error');
      });
  };

  const handleCapture = async (photoData) => {
    if (!photoData) { setCapturedPhoto(null); setFaceStatus('waiting'); return; }
    setCapturedPhoto(photoData);
    setFaceStatus('verifying');
    setFaceError('');

    try {
      const capturedDescriptor = await getDescriptorFromDataURL(photoData.dataURL);
      if (!capturedDescriptor) {
        setFaceStatus('noface');
        setCapturedPhoto(null);
        setFaceError('No face detected. Look directly at the camera with good lighting and retake.');
        return;
      }
      const stored = employeeData?.faceDescriptor;
      if (!stored?.length) {
        setFaceStatus('ok');
        return;
      }
      if (isFaceMatch(stored, capturedDescriptor)) {
        setFaceStatus('ok');
      } else {
        setFaceStatus('mismatch');
        setCapturedPhoto(null);
        setFaceError('Face does not match our records. Ensure good lighting, face the camera directly, and retake.');
      }
    } catch {
      setFaceStatus('ok'); // allow on error to avoid blocking
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (locationStatus !== 'ok') { setError('Location verification required.'); return; }
    if (!capturedPhoto?.dataURL || faceStatus !== 'ok') { setError('Face verification required.'); return; }
    if (workSummary.trim().length < MIN_SUMMARY_LENGTH) {
      setError(`Please write at least ${MIN_SUMMARY_LENGTH} characters. (${workSummary.trim().length} so far)`);
      return;
    }

    setSubmitting(true);
    try {
      const compressedPhoto = await compressImage(capturedPhoto.dataURL);
      await addDoc(collection(db, 'attendance'), {
        employeeId:   employeeData?.employeeId || user.uid,
        employeeUid:  user.uid,
        employeeName: employeeData?.name || user.displayName || user.email,
        date:         getISTDateString(),
        type:         attendanceType,
        submittedAt:  serverTimestamp(),
        workSummary:  workSummary.trim(),
        photoBase64:  compressedPhoto,
        location: {
          lat: locationInfo?.lat,
          lng: locationInfo?.lng,
          accuracy: locationInfo?.accuracy,
        },
      });
      setSuccess(true);
      setTimeout(() => onSubmitted?.(), 2500);
    } catch (err) {
      console.error(err);
      setError('Submission failed. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = locationStatus === 'ok' && faceStatus === 'ok' &&
                    workSummary.trim().length >= MIN_SUMMARY_LENGTH && !submitting;

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
           style={{ background: 'rgba(4, 8, 15, 0.97)', backdropFilter: 'blur(20px)' }}>
        <div className="card max-w-sm w-full text-center animate-slide-up">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
               style={{ background: 'linear-gradient(135deg, #7c3aed22, #3b82f622)', border: '2px solid #34d39940' }}>
            <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {isSignIn ? 'Signed In!' : 'Signed Out!'}
          </h2>
          <p className="text-gray-400 text-sm">
            {isSignIn ? 'Have a great shift!' : 'See you tomorrow — great work!'}
          </p>
          <div className="mt-4 status-badge-green mx-auto w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
            Attendance recorded
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
         style={{ background: 'rgba(4, 8, 15, 0.97)', backdropFilter: 'blur(20px)' }}>
      <div className="card max-w-2xl w-full my-4 animate-slide-up">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-5 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-lg"
               style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)' }}>
            G
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">
              {isSignIn ? 'Sign In — Start of Shift' : 'Sign Out — End of Shift'}
            </h2>
            <p className="text-xs text-gray-500">
              {new Intl.DateTimeFormat('en-IN', {
                timeZone: 'Asia/Kolkata', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              }).format(new Date())}
            </p>
          </div>
          <div className={isSignIn ? 'status-badge-violet' : 'status-badge-yellow'}>
            {isSignIn ? '5:00 PM' : '1:45 AM'}
          </div>
        </div>

        {/* Verification Steps */}
        <div className="space-y-2 mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Verification</p>

          {/* Step 1 — Location */}
          <div className={`verify-step ${
            locationStatus === 'checking' ? 'verify-step-checking' :
            locationStatus === 'ok'       ? 'verify-step-ok' :
            'verify-step-fail'
          }`}>
            <div className="flex-shrink-0">
              {locationStatus === 'checking' && (
                <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              )}
              {locationStatus === 'ok' && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {(locationStatus === 'outside' || locationStatus === 'error') && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">
                {locationStatus === 'checking' && 'Checking your location...'}
                {locationStatus === 'ok' && `Location verified — ${locationInfo?.office?.name}`}
                {locationStatus === 'outside' && `Outside office (${locationInfo?.distance}m away)`}
                {locationStatus === 'error' && 'Location check failed'}
              </div>
              {locationStatus === 'ok' && locationInfo?.accuracy && (
                <div className="text-xs opacity-70 mt-0.5">GPS accuracy: ±{locationInfo.accuracy}m</div>
              )}
              {(locationStatus === 'outside') && (
                <div className="text-xs opacity-80 mt-0.5">
                  You must be at Ambience Mall, Gurugram to submit attendance.
                </div>
              )}
              {locationStatus === 'error' && (
                <div className="text-xs opacity-80 mt-0.5">{locationError}</div>
              )}
            </div>
            {(locationStatus === 'outside' || locationStatus === 'error') && (
              <button onClick={retryLocation}
                      className="flex-shrink-0 text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition-colors">
                Retry
              </button>
            )}
          </div>

          {/* Step 2 — Face */}
          <div className={`verify-step ${
            faceStatus === 'waiting'    ? 'verify-step-pending' :
            faceStatus === 'verifying'  ? 'verify-step-checking' :
            faceStatus === 'ok'         ? 'verify-step-ok' :
            'verify-step-fail'
          }`}>
            <div className="flex-shrink-0">
              {faceStatus === 'waiting' && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10 12a2 2 0 100-4 2 2 0 000 4zm6 0a2 2 0 100-4 2 2 0 000 4zM4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              )}
              {faceStatus === 'verifying' && (
                <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              )}
              {faceStatus === 'ok' && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {(faceStatus === 'mismatch' || faceStatus === 'noface') && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">
                {faceStatus === 'waiting'   && 'Face scan — capture photo below'}
                {faceStatus === 'verifying' && 'Verifying your face...'}
                {faceStatus === 'ok'        && 'Face verified'}
                {faceStatus === 'mismatch'  && 'Face mismatch — retake photo'}
                {faceStatus === 'noface'    && 'No face detected — retake photo'}
              </div>
              {faceError && <div className="text-xs opacity-80 mt-0.5">{faceError}</div>}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {/* Camera */}
          <WebcamCapture onCapture={handleCapture} onError={(msg) => setFaceError(msg)} />

          {/* Work summary */}
          <div>
            <label className="label">
              {isSignIn ? 'What are you planning to work on today?' : 'What did you work on today?'}
              <span className="text-red-400 ml-1">*</span>
            </label>
            <textarea
              value={workSummary}
              onChange={(e) => { setWorkSummary(e.target.value); setError(''); }}
              rows={4}
              placeholder={isSignIn
                ? 'e.g. Planning to work on API integration, code review for PR #42, standup at 5:30 PM...'
                : 'e.g. Completed API integration, fixed 3 bugs in dashboard, attended standup, reviewed 2 PRs...'}
              className="input-field resize-none"
              maxLength={2000}
            />
            <div className="flex justify-between mt-1.5">
              <span className={`text-xs ${workSummary.trim().length < MIN_SUMMARY_LENGTH ? 'text-red-400' : 'text-emerald-400'}`}>
                {workSummary.trim().length}/{MIN_SUMMARY_LENGTH} min chars
              </span>
              <span className="text-xs text-gray-600">{workSummary.length}/2000</span>
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

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {isSignIn ? 'Submit Sign In' : 'Submit Sign Out'}
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-600">
            This popup cannot be dismissed without submitting attendance.
          </p>
        </div>
      </div>
    </div>
  );
}
