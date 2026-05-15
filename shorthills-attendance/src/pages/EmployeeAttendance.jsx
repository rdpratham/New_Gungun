import { useEffect, useState, useCallback } from 'react';
import { doc, getDoc, collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import Navbar from '../components/Navbar';
import AttendancePopup from '../components/AttendancePopup';

function getISTDateString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function getISTTime() {
  const now = new Date();
  const ist = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(now);
  const h = parseInt(ist.find(p => p.type === 'hour').value);
  const m = parseInt(ist.find(p => p.type === 'minute').value);
  return { hour: h, minute: m };
}

function isAttendanceTime() {
  const { hour, minute } = getISTTime();
  // Trigger at 1:45 AM IST (hour=1, minute>=45)
  return hour === 1 && minute >= 45;
}

export default function EmployeeAttendance({ user }) {
  const [employeeData, setEmployeeData] = useState(null);
  const [todayRecord, setTodayRecord] = useState(null);
  const [recentRecords, setRecentRecords] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showPopup, setShowPopup] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const checkAndShowPopup = useCallback((alreadySubmitted) => {
    if (!alreadySubmitted && isAttendanceTime()) {
      setShowPopup(true);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      // Fetch employee profile
      const empSnap = await getDoc(doc(db, 'employees', user.uid));
      const empData = empSnap.exists() ? { id: empSnap.id, ...empSnap.data() } : null;
      setEmployeeData(empData);

      // Check today's attendance
      const today = getISTDateString();
      const attQ = query(
        collection(db, 'attendance'),
        where('employeeUid', '==', user.uid),
        where('date', '==', today)
      );
      const attSnap = await getDocs(attQ);
      const submitted = !attSnap.empty;
      setTodayRecord(submitted ? { id: attSnap.docs[0].id, ...attSnap.docs[0].data() } : null);

      // Fetch recent records (last 7)
      const recentQ = query(
        collection(db, 'attendance'),
        where('employeeUid', '==', user.uid),
        orderBy('date', 'desc'),
        limit(7)
      );
      const recentSnap = await getDocs(recentQ);
      setRecentRecords(recentSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      checkAndShowPopup(submitted);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoadingData(false);
    }
  }, [user, checkAndShowPopup]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Clock + popup trigger interval (every 30s)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      if (!todayRecord && !showPopup) {
        checkAndShowPopup(false);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [todayRecord, showPopup, checkAndShowPopup]);

  const handleSubmitted = () => {
    setShowPopup(false);
    fetchData();
  };

  const formatIST = (date) => new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit', minute: '2-digit', hour12: true,
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(date instanceof Date ? date : date?.toDate?.() || new Date());

  const formatDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-');
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div className="min-h-screen bg-navy-900">
      <Navbar user={user} role="employee" />

      {showPopup && (
        <AttendancePopup
          user={user}
          employeeData={employeeData}
          onSubmitted={handleSubmitted}
        />
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        {loadingData ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-electric-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Loading your dashboard...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            {/* Profile Card */}
            <div className="card flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <div className="w-24 h-24 rounded-full overflow-hidden flex-shrink-0 bg-navy-700 border-4 border-electric-500/30">
                {employeeData?.photoURL ? (
                  <img src={employeeData.photoURL} alt={employeeData.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-electric-400 text-3xl font-bold">
                    {employeeData?.name?.charAt(0) || '?'}
                  </div>
                )}
              </div>
              <div className="text-center sm:text-left flex-1">
                <h1 className="text-2xl font-bold text-white">{employeeData?.name || 'Employee'}</h1>
                <p className="text-gray-400">{user.email}</p>
                <p className="text-electric-400 text-sm mt-1">ID: {employeeData?.employeeId}</p>
                <div className="mt-3 inline-flex items-center gap-2 bg-navy-700 px-3 py-1.5 rounded-full text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-gray-300">Shift: 5:00 PM – 1:30 AM IST</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">
                  {new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).format(currentTime)}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">IST</div>
              </div>
            </div>

            {/* Today's Status */}
            <div className={`card border-2 ${todayRecord ? 'border-green-500/40 bg-green-500/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  {todayRecord ? (
                    <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-white">
                      {todayRecord ? '✓ Attendance Submitted Today' : 'Attendance Pending'}
                    </div>
                    <div className="text-sm text-gray-400">
                      {todayRecord
                        ? `Submitted at ${formatIST(todayRecord.submittedAt?.toDate?.() || new Date())}`
                        : 'Attendance window opens at 1:45 AM IST'}
                    </div>
                  </div>
                </div>

                {!todayRecord && (
                  <button
                    onClick={() => setShowPopup(true)}
                    className="btn-primary flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 4v16m8-8H4" />
                    </svg>
                    Submit Now
                  </button>
                )}
              </div>

              {todayRecord?.workSummary && (
                <div className="mt-4 pt-4 border-t border-navy-700">
                  <p className="text-xs text-gray-500 mb-1">Today's work summary:</p>
                  <p className="text-gray-300 text-sm">{todayRecord.workSummary}</p>
                </div>
              )}
            </div>

            {/* Recent Attendance */}
            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4">Recent Attendance</h2>
              {recentRecords.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-10 h-10 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  No attendance records yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentRecords.map((rec) => (
                    <div key={rec.id} className="flex items-start gap-4 bg-navy-900 rounded-xl p-4">
                      {(rec.photoBase64 || rec.photoURL) && (
                        <img
                          src={rec.photoBase64 || rec.photoURL}
                          alt="Attendance"
                          className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-navy-700 cursor-pointer"
                          onClick={() => window.open(rec.photoBase64 || rec.photoURL, '_blank')}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white">{formatDate(rec.date)}</span>
                          <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full flex-shrink-0">Submitted</span>
                        </div>
                        <p className="text-gray-400 text-sm mt-1 line-clamp-2">{rec.workSummary}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          at {formatIST(rec.submittedAt?.toDate?.() || new Date())}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-center text-gray-700 text-xs pb-4">
              Made with ♥ by Pratham Jain &nbsp;|&nbsp; Attendance-US © {new Date().getFullYear()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
