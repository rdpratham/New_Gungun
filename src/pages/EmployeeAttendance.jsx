import { useState, useEffect, useCallback } from 'react'
import { signOut } from 'firebase/auth'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { auth, db } from '../firebase'
import Navbar from '../components/Navbar'
import AttendancePopup from '../components/AttendancePopup'

function getISTDateString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function getISTTime() {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(now)
  const hour = parseInt(parts.find(p => p.type === 'hour').value)
  const minute = parseInt(parts.find(p => p.type === 'minute').value)
  return { hour, minute }
}

function formatDisplayTime(ts) {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(date)
}

export default function EmployeeAttendance() {
  const [employee, setEmployee] = useState(null)
  const [todayRecord, setTodayRecord] = useState(null)
  const [showPopup, setShowPopup] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState('')
  const navigate = useNavigate()

  const today = getISTDateString()

  const checkAndShowPopup = useCallback((submitted) => {
    if (submitted) return
    const { hour, minute } = getISTTime()
    if (hour === 1 && minute >= 45) {
      setShowPopup(true)
    }
  }, [])

  useEffect(() => {
    async function init() {
      const user = auth.currentUser
      if (!user) return

      const empSnap = await getDoc(doc(db, 'employees', user.uid))
      if (!empSnap.exists()) return

      const empData = { id: empSnap.id, ...empSnap.data() }
      setEmployee(empData)

      // Check if attendance already submitted today
      const attQuery = query(
        collection(db, 'attendance'),
        where('employeeId', '==', user.uid),
        where('date', '==', today)
      )
      const attSnap = await getDocs(attQuery)
      const rec = attSnap.empty ? null : { id: attSnap.docs[0].id, ...attSnap.docs[0].data() }
      setTodayRecord(rec)
      setLoading(false)

      checkAndShowPopup(!!rec)
    }
    init()
  }, [today, checkAndShowPopup])

  // Clock display
  useEffect(() => {
    function tick() {
      setCurrentTime(new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true,
      }).format(new Date()))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Attendance popup interval check every 30 seconds
  useEffect(() => {
    if (todayRecord) return
    const id = setInterval(() => {
      checkAndShowPopup(!!todayRecord)
    }, 30_000)
    return () => clearInterval(id)
  }, [todayRecord, checkAndShowPopup])

  async function handleLogout() {
    await signOut(auth)
    navigate('/login')
  }

  function handleAttendanceSubmitted(record) {
    setTodayRecord(record)
    setShowPopup(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-electric-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy-900 flex flex-col">
      <Navbar onLogout={handleLogout} />

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        {/* Employee profile header */}
        <div className="card mb-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-navy-700 flex-shrink-0">
              {employee?.photoURL ? (
                <img src={employee.photoURL} alt={employee.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-electric-500">
                  {employee?.name?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate">{employee?.name}</h2>
              <p className="text-slate-400 text-sm mt-0.5 truncate">{employee?.email}</p>
              <p className="text-slate-500 text-xs mt-1">ID: {employee?.employeeId}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-electric-400 font-mono text-sm font-medium">{currentTime}</div>
              <div className="text-slate-500 text-xs mt-1">IST</div>
            </div>
          </div>
        </div>

        {/* Shift info */}
        <div className="card mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-slate-400 text-sm font-medium uppercase tracking-wide mb-1">Today's Shift</p>
              <div className="flex items-center gap-3">
                <span className="text-white font-semibold">5:00 PM</span>
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <span className="text-white font-semibold">1:30 AM</span>
              </div>
            </div>
            <div className="bg-navy-700 rounded-lg px-4 py-2 text-sm text-slate-300">
              {today}
            </div>
          </div>
        </div>

        {/* Attendance status */}
        <div className="card">
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wide mb-4">Today's Attendance</p>

          {todayRecord ? (
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-green-400 font-semibold">Attendance Submitted</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Submitted at {formatDisplayTime(todayRecord.submittedAt)} IST
                  </p>
                </div>
              </div>

              <div className="flex gap-4 flex-wrap">
                {todayRecord.photoURL && (
                  <div className="w-24 h-24 rounded-xl overflow-hidden border border-navy-600 flex-shrink-0">
                    <img src={todayRecord.photoURL} alt="Attendance" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-2">Work Summary</p>
                  <p className="text-slate-200 text-sm leading-relaxed bg-navy-700/50 rounded-lg p-3">
                    {todayRecord.workSummary}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-yellow-400 font-semibold">Pending</p>
                  <p className="text-slate-500 text-xs mt-0.5">Attendance popup appears at 1:45 AM IST</p>
                </div>
              </div>

              <button
                onClick={() => setShowPopup(true)}
                className="btn-primary"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Submit Attendance Now
              </button>
            </div>
          )}
        </div>
      </div>

      {showPopup && employee && (
        <AttendancePopup
          employee={employee}
          today={today}
          onSubmitted={handleAttendanceSubmitted}
          dismissible={!!todayRecord}
          onClose={() => todayRecord && setShowPopup(false)}
        />
      )}
    </div>
  )
}
