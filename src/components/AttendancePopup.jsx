import { useRef, useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'
import WebcamCapture from './WebcamCapture'

const MIN_SUMMARY_LENGTH = 50

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export default function AttendancePopup({ employee, today, onSubmitted, dismissible, onClose }) {
  const webcamRef = useRef(null)
  const [capturedBlob, setCapturedBlob] = useState(null)
  const [workSummary, setWorkSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('form') // 'form' | 'success'

  const summaryLen = workSummary.trim().length

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!capturedBlob) {
      setError('Please capture a photo before submitting.')
      return
    }
    if (summaryLen < MIN_SUMMARY_LENGTH) {
      setError(`Work summary must be at least ${MIN_SUMMARY_LENGTH} characters (${summaryLen}/${MIN_SUMMARY_LENGTH}).`)
      return
    }

    setLoading(true)
    try {
      const user = auth.currentUser

      // Convert photo to base64 and store directly in Firestore (no Storage needed)
      const photoBase64 = await blobToBase64(capturedBlob)

      const record = {
        employeeId: user.uid,
        employeeName: employee.name,
        date: today,
        submittedAt: serverTimestamp(),
        workSummary: workSummary.trim(),
        photoURL: photoBase64,
      }

      const docRef = await addDoc(collection(db, 'attendance'), record)
      setStep('success')
      setTimeout(() => {
        onSubmitted({ id: docRef.id, ...record, submittedAt: { toDate: () => new Date() } })
      }, 1800)
    } catch (err) {
      console.error(err)
      setError('Submission failed. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="popup-enter bg-navy-800 border border-navy-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">

        {step === 'success' ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-5">
              <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Attendance Submitted!</h3>
            <p className="text-slate-400 text-sm">Your attendance for today has been recorded successfully.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-navy-700">
              <div>
                <h2 className="text-lg font-bold text-white">Daily Attendance</h2>
                <p className="text-slate-400 text-sm mt-0.5">End of shift — {today}</p>
              </div>
              {dismissible && (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-slate-500 hover:text-white transition-colors p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="p-6 space-y-6">
              {!dismissible && (
                <div className="bg-electric-500/10 border border-electric-500/20 rounded-lg px-4 py-3 text-sm text-electric-300 flex items-start gap-2.5">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  This form must be submitted to continue. It cannot be dismissed.
                </div>
              )}

              {/* Webcam */}
              <div>
                <p className="label mb-3">
                  Step 1: Take a selfie
                  <span className="text-red-400 ml-1">*</span>
                </p>
                <WebcamCapture
                  ref={webcamRef}
                  onCapture={blob => setCapturedBlob(blob)}
                />
              </div>

              {/* Work summary */}
              <div>
                <label className="label">
                  Step 2: Work Summary
                  <span className="text-red-400 ml-1">*</span>
                </label>
                <textarea
                  className="input-field min-h-[120px] resize-none"
                  placeholder="e.g. Completed API integration, fixed 3 bugs in dashboard, attended standup, reviewed 2 PRs..."
                  value={workSummary}
                  onChange={e => setWorkSummary(e.target.value)}
                  rows={5}
                />
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-slate-500">Describe your full day's tasks</span>
                  <span className={`text-xs font-medium ${summaryLen >= MIN_SUMMARY_LENGTH ? 'text-green-400' : 'text-slate-500'}`}>
                    {summaryLen}/{MIN_SUMMARY_LENGTH}
                  </span>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary w-full py-3"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting attendance…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Submit Attendance
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
