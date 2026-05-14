import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import Navbar from '../components/Navbar';
import AttendancePopup from '../components/AttendancePopup';

function getISTDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function getISTTime() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric', minute: 'numeric', hour12: false
  }).formatToParts(now);
  const h = parseInt(parts.find(p => p.type === 'hour').value);
  const m = parseInt(parts.find(p => p.type === 'minute').value);
  return { hour: h, minute: m };
}

export default function EmployeeAttendance({ user }) {
  const [employeeData, setEmployeeData] = useState(null);
  const [attendanceSubmitted, setAttendanceSubmitted] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recentAttendance, setRecentAttendance] = useState([]);

  const checkAttendance = useCallback(async () => {
    const today = getISTDate();
    const q = query(
      collection(db, 'attendance'),
      where('employeeUID', '==', user.uid),
      where('date', '==', today)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  }, [user.uid]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const empDoc = await getDoc(doc(db, 'employees', user.uid));
      if (empDoc.exists()) setEmployeeData(empDoc.data());

      const submitted = await checkAttendance();
      setAttendanceSubmitted(submitted);

      const q = query(collection(db, 'attendance'), where('employeeUID', '==', user.uid));
      const snap = await getDocs(q);
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      records.sort((a, b) => (b.date > a.date ? 1 : -1));
      setRecentAttendance(records.slice(0, 7));
    } finally {
      setLoading(false);
    }
  }, [user.uid, checkAttendance]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const checkTime = async () => {
      const { hour, minute } = getISTTime();
      if (hour === 1 && minute >= 45) {
        const submitted = await checkAttendance();
        if (!submitted) setShowPopup(true);
      }
    };
    checkTime();
    const interval = setInterval(checkTime, 30000);
    return () => clearInterval(interval);
  }, [checkAttendance]);

  const handleSuccess = () => {
    setShowPopup(false);
    setAttendanceSubmitted(true);
    loadData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-electric-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const today = getISTDate();
  const { hour, minute } = getISTTime();
  const currentIST = `${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')} IST`;

  return (
    <div className="min-h-screen bg-navy-900">
      <Navbar title="Employee Portal" />

      {showPopup && employeeData && (
        <AttendancePopup user={user} employeeData={employeeData} onSuccess={handleSuccess} />
      )}

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Profile Card */}
        <div className="bg-navy-800 border border-navy-700 rounded-2xl p-6 flex items-center gap-5">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-navy-700 flex-shrink-0">
            {employeeData?.photoURL ? (
              <img src={employeeData.photoURL} alt={employeeData?.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl text-gray-400">
                {employeeData?.name?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-white text-2xl font-bold">{employeeData?.name}</h2>
            <p className="text-gray-400 text-sm">{user.email}</p>
            <p className="text-electric-400 text-xs mt-1">ID: {employeeData?.employeeId}</p>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Today's Status</p>
            {attendanceSubmitted ? (
              <div className="flex items-center gap-2">
                <span className="text-green-400 text-lg">✓</span>
                <span className="text-green-400 font-semibold">Submitted</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-orange-400 text-lg">○</span>
                <span className="text-orange-400 font-semibold">Pending</span>
              </div>
            )}
            <p className="text-gray-500 text-xs mt-1">{today}</p>
          </div>
          <div className="bg-navy-800 border border-navy-700 rounded-2xl p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Current Time</p>
            <p className="text-white font-semibold">{currentIST}</p>
            <p className="text-gray-500 text-xs mt-1">Shift: 5 PM – 1:30 AM</p>
          </div>
        </div>

        {/* Manual Submit Button */}
        {!attendanceSubmitted && (
          <button
            onClick={() => setShowPopup(true)}
            className="w-full py-4 bg-electric-500 hover:bg-electric-600 text-white font-semibold rounded-2xl transition-colors"
          >
            Submit Today's Attendance
          </button>
        )}

        {/* Recent Records */}
        {recentAttendance.length > 0 && (
          <div className="bg-navy-800 border border-navy-700 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-4">Recent Attendance (Last 7 days)</h3>
            <div className="space-y-3">
              {recentAttendance.map(record => (
                <div key={record.id} className="flex items-start gap-3 py-3 border-b border-navy-700 last:border-0">
                  {record.photoURL && (
                    <img src={record.photoURL} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-white text-sm font-medium">{record.date}</p>
                      <span className="text-green-400 text-xs">✓ Submitted</span>
                    </div>
                    <p className="text-gray-400 text-xs mt-1 truncate">{record.workSummary}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-gray-600 text-xs">Made by Pratham Jain</p>
      </div>
    </div>
  );
}
