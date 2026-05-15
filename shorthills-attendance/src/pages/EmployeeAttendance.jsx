import { useEffect, useState, useCallback } from 'react';
import { doc, getDoc, collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import Navbar from '../components/Navbar';
import AttendancePopup from '../components/AttendancePopup';
import ProfileModal from '../components/ProfileModal';

function getISTDateString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function getISTTime() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(now);
  return {
    hour:   parseInt(parts.find(p => p.type === 'hour').value),
    minute: parseInt(parts.find(p => p.type === 'minute').value),
  };
}

function isSignInWindow() {
  const { hour, minute } = getISTTime();
  const mins = hour * 60 + minute;
  return mins >= 16 * 60 + 30 && mins <= 17 * 60 + 30;
}

function isSignOutWindow() {
  const { hour, minute } = getISTTime();
  const mins = hour * 60 + minute;
  return mins >= 1 * 60 + 30 && mins <= 2 * 60 + 30;
}

export default function EmployeeAttendance({ user }) {
  const [employeeData, setEmployeeData]   = useState(null);
  const [signInRecord, setSignInRecord]   = useState(null);
  const [signOutRecord, setSignOutRecord] = useState(null);
  const [recentRecords, setRecentRecords] = useState([]);
  const [loadingData, setLoadingData]     = useState(true);
  const [showPopup, setShowPopup]         = useState(false);
  const [popupType, setPopupType]         = useState('signin');
  const [currentTime, setCurrentTime]     = useState(new Date());
  const [showProfile, setShowProfile]     = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const empSnap = await getDoc(doc(db, 'employees', user.uid));
      setEmployeeData(empSnap.exists() ? { id: empSnap.id, ...empSnap.data() } : null);

      const today = getISTDateString();

      const siSnap = await getDocs(query(
        collection(db, 'attendance'),
        where('employeeUid', '==', user.uid),
        where('date', '==', today),
        where('type', '==', 'signin')
      ));
      setSignInRecord(siSnap.empty ? null : { id: siSnap.docs[0].id, ...siSnap.docs[0].data() });

      const soSnap = await getDocs(query(
        collection(db, 'attendance'),
        where('employeeUid', '==', user.uid),
        where('date', '==', today),
        where('type', '==', 'signout')
      ));
      setSignOutRecord(soSnap.empty ? null : { id: soSnap.docs[0].id, ...soSnap.docs[0].data() });

      const recentSnap = await getDocs(query(
        collection(db, 'attendance'),
        where('employeeUid', '==', user.uid),
        orderBy('date', 'desc'),
        limit(10)
      ));
      setRecentRecords(recentSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      if (!showPopup) {
        if (!signInRecord && isSignInWindow()) {
          setPopupType('signin'); setShowPopup(true);
        } else if (signInRecord && !signOutRecord && isSignOutWindow()) {
          setPopupType('signout'); setShowPopup(true);
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [signInRecord, signOutRecord, showPopup]);

  const openPopup = (type) => { setPopupType(type); setShowPopup(true); };
  const handleSubmitted = () => { setShowPopup(false); fetchData(); };

  const formatIST = (ts) => new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true,
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(ts instanceof Date ? ts : ts?.toDate?.() || new Date());

  const formatDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-');
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const formatTime = (ts) => new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(ts instanceof Date ? ts : ts?.toDate?.() || new Date());

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Navbar user={user} role="employee" avatarSrc={employeeData?.photoURL} onViewProfile={() => setShowProfile(true)} />
      {showProfile && (
        <ProfileModal
          user={user} role="employee" employeeData={employeeData}
          onClose={() => setShowProfile(false)}
          onUpdated={(updated) => setEmployeeData(updated)}
        />
      )}

      {showPopup && (
        <AttendancePopup
          user={user}
          employeeData={employeeData}
          attendanceType={popupType}
          onSubmitted={handleSubmitted}
        />
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        {loadingData ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500 text-sm">Loading your dashboard...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-5 animate-fade-in">

            {/* Profile Card */}
            <div className="card flex flex-col sm:flex-row items-center sm:items-start gap-5">
              <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 border border-violet-500/30"
                   style={{ background: 'linear-gradient(135deg, #7c3aed22, #3b82f622)' }}>
                {employeeData?.photoURL ? (
                  <img src={employeeData.photoURL} alt={employeeData.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-violet-400 text-3xl font-bold">
                    {employeeData?.name?.charAt(0) || '?'}
                  </div>
                )}
              </div>
              <div className="text-center sm:text-left flex-1">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{employeeData?.name || employeeData?.employeeId || 'Employee'}</h1>
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>{user.email}</p>
                <p className="text-violet-400 text-xs mt-1">ID: {employeeData?.employeeId}</p>
                <div className="mt-3 inline-flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                  <span className="text-gray-400 text-xs">Shift: 5:00 PM – 2:00 AM IST</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white font-mono tracking-tight">
                  {new Intl.DateTimeFormat('en-IN', {
                    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
                  }).format(currentTime)}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">IST</div>
              </div>
            </div>

            {/* Today Sign-In / Sign-Out Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Sign In */}
              <div className={`card border-2 transition-all duration-300 ${
                signInRecord ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/10'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      signInRecord ? 'bg-emerald-500/20' : 'bg-white/5'
                    }`}>
                      {signInRecord ? (
                        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Sign In</div>
                      <div className="text-xs text-gray-500">
                        {signInRecord ? formatTime(signInRecord.submittedAt?.toDate?.() || new Date()) : 'Window: 5:00 PM IST'}
                      </div>
                    </div>
                  </div>
                  {signInRecord
                    ? <span className="status-badge-green flex-shrink-0">Done</span>
                    : <span className="status-badge-yellow flex-shrink-0">Pending</span>
                  }
                </div>
                {!signInRecord && (
                  <button onClick={() => openPopup('signin')} className="btn-primary w-full mt-4 text-sm py-2">
                    Submit Sign In
                  </button>
                )}
              </div>

              {/* Sign Out */}
              <div className={`card border-2 transition-all duration-300 ${
                signOutRecord ? 'border-emerald-500/30 bg-emerald-500/5' :
                signInRecord ? 'border-white/10' : 'border-white/5 opacity-60'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      signOutRecord ? 'bg-emerald-500/20' : 'bg-white/5'
                    }`}>
                      {signOutRecord ? (
                        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Sign Out</div>
                      <div className="text-xs text-gray-500">
                        {signOutRecord ? formatTime(signOutRecord.submittedAt?.toDate?.() || new Date()) : 'Window: 2:00 AM IST'}
                      </div>
                    </div>
                  </div>
                  {signOutRecord
                    ? <span className="status-badge-green flex-shrink-0">Done</span>
                    : signInRecord
                    ? <span className="status-badge-yellow flex-shrink-0">Pending</span>
                    : <span className="status-badge-red flex-shrink-0">Sign in first</span>
                  }
                </div>
                {!signOutRecord && signInRecord && (
                  <button onClick={() => openPopup('signout')} className="btn-primary w-full mt-4 text-sm py-2">
                    Submit Sign Out
                  </button>
                )}
              </div>
            </div>

            {/* Location notice */}
            <div className="card border border-violet-500/20 bg-violet-500/5">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className="text-violet-300 text-sm font-medium">Location verified attendance</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    You must be physically present at <span className="text-violet-400">Ambience Mall, Gurugram</span>.
                    Both sign-in and sign-out require face + location verification.
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Records */}
            <div className="card">
              <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text)' }}>Recent Attendance</h2>
              {recentRecords.length === 0 ? (
                <div className="text-center py-10 text-gray-600">
                  <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  No attendance records yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {recentRecords.map((rec) => (
                    <div key={rec.id} className="flex items-start gap-3 rounded-xl p-4 border" style={{ background: 'var(--surface-s)', borderColor: 'var(--border-s)' }}>
                      {(rec.photoBase64 || rec.photoURL) && (
                        <img
                          src={rec.photoBase64 || rec.photoURL}
                          alt="Attendance"
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0 cursor-pointer hover:opacity-80"
                          style={{ border: '1px solid var(--border)' }}
                          onClick={() => window.open(rec.photoBase64 || rec.photoURL, '_blank')}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>{formatDate(rec.date)}</span>
                          {rec.type === 'signin'
                            ? <span className="status-badge-violet">Sign In</span>
                            : rec.type === 'signout'
                            ? <span className="status-badge-green">Sign Out</span>
                            : <span className="status-badge-green">Submitted</span>
                          }
                        </div>
                        <p className="text-gray-500 text-xs mt-1 line-clamp-2">{rec.workSummary}</p>
                        <p className="text-gray-700 text-xs mt-1">{formatIST(rec.submittedAt?.toDate?.() || new Date())}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-center text-gray-700 text-xs pb-4">
              Made with ♥ by Pratham Jain &nbsp;|&nbsp; Garvix Ops © {new Date().getFullYear()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
