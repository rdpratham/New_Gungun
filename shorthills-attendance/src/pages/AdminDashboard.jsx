import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import Navbar from '../components/Navbar';
import EmployeeCard from '../components/EmployeeCard';

function formatIST(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(d);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });
}

export default function AdminDashboard({ user }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('employees'); // 'employees' | 'attendance'
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loadingEmp, setLoadingEmp] = useState(true);
  const [loadingAtt, setLoadingAtt] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState(null);

  // Filters
  const [filterDate, setFilterDate] = useState('');
  const [filterName, setFilterName] = useState('');

  const fetchEmployees = useCallback(async () => {
    setLoadingEmp(true);
    try {
      const snap = await getDocs(query(collection(db, 'employees'), orderBy('createdAt', 'desc')));
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEmp(false);
    }
  }, []);

  const fetchAttendance = useCallback(async () => {
    setLoadingAtt(true);
    try {
      const snap = await getDocs(query(collection(db, 'attendance'), orderBy('date', 'desc')));
      setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAtt(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => {
    if (tab === 'attendance' && attendance.length === 0) fetchAttendance();
  }, [tab, attendance.length, fetchAttendance]);

  const filteredAttendance = attendance.filter(rec => {
    const dateMatch = filterDate ? rec.date === filterDate : true;
    const nameMatch = filterName
      ? rec.employeeName?.toLowerCase().includes(filterName.toLowerCase())
      : true;
    return dateMatch && nameMatch;
  });

  return (
    <div className="min-h-screen bg-navy-950">
      <Navbar user={user} role="admin" />

      {/* Photo lightbox */}
      {expandedPhoto && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setExpandedPhoto(null)}
        >
          <img src={expandedPhoto} alt="Attendance" className="max-w-full max-h-full rounded-xl shadow-2xl" />
          <button
            className="absolute top-4 right-4 text-white bg-navy-800 rounded-full p-2 hover:bg-navy-700"
            onClick={() => setExpandedPhoto(null)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-gray-400 mt-1">Manage employees and view attendance records</p>
          </div>
          <button
            onClick={() => navigate('/admin/add-employee')}
            className="btn-primary flex items-center gap-2 self-start sm:self-auto"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New Employee
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8 animate-fade-in">
          <div className="card text-center">
            <div className="text-3xl font-bold text-electric-500">{employees.length}</div>
            <div className="text-gray-400 text-sm mt-1">Total Employees</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-green-400">
              {attendance.filter(a => a.date === new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())).length}
            </div>
            <div className="text-gray-400 text-sm mt-1">Present Today</div>
          </div>
          <div className="card text-center col-span-2 sm:col-span-1">
            <div className="text-3xl font-bold text-white">{attendance.length}</div>
            <div className="text-gray-400 text-sm mt-1">Total Records</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-navy-700 mb-6">
          {['employees', 'attendance'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3 font-medium text-sm capitalize transition-all duration-200 border-b-2 -mb-px ${
                tab === t
                  ? 'text-electric-400 border-electric-500'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              {t === 'employees' ? `Employees (${employees.length})` : `Attendance Records`}
            </button>
          ))}
        </div>

        {/* Employees Tab */}
        {tab === 'employees' && (
          <div className="animate-fade-in">
            {loadingEmp ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-4 border-electric-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : employees.length === 0 ? (
              <div className="card text-center py-12">
                <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-gray-500">No employees yet.</p>
                <button onClick={() => navigate('/admin/add-employee')} className="btn-primary mt-4">
                  Add First Employee
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {employees.map(emp => (
                  <EmployeeCard key={emp.id} employee={emp} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Attendance Tab */}
        {tab === 'attendance' && (
          <div className="animate-fade-in space-y-4">
            {/* Filters */}
            <div className="card">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="label">Filter by Date</label>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div className="flex-1">
                  <label className="label">Filter by Employee Name</label>
                  <input
                    type="text"
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    placeholder="Search by name..."
                    className="input-field"
                  />
                </div>
                {(filterDate || filterName) && (
                  <div className="flex items-end">
                    <button
                      onClick={() => { setFilterDate(''); setFilterName(''); }}
                      className="btn-secondary whitespace-nowrap"
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
              </div>
              <p className="text-gray-500 text-sm mt-3">
                Showing {filteredAttendance.length} of {attendance.length} records
              </p>
            </div>

            {loadingAtt ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-4 border-electric-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredAttendance.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-gray-500">No attendance records found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAttendance.map((rec) => (
                  <div key={rec.id} className="card hover:border-electric-500/40 transition-all duration-200">
                    <div className="flex items-start gap-4">
                      {/* Photo */}
                      {(rec.photoBase64 || rec.photoURL) && (
                        <img
                          src={rec.photoBase64 || rec.photoURL}
                          alt={rec.employeeName}
                          className="w-16 h-16 rounded-xl object-cover flex-shrink-0 cursor-pointer border border-navy-700 hover:border-electric-500 transition-colors"
                          onClick={() => setExpandedPhoto(rec.photoBase64 || rec.photoURL)}
                          title="Click to enlarge"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold text-white">{rec.employeeName}</span>
                          {rec.type === 'signin' ? <span className="text-xs text-violet-400 bg-violet-400/10 border border-violet-500/20 px-2 py-0.5 rounded-full">Sign In</span> : rec.type === 'signout' ? <span className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">Sign Out</span> : <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">Submitted</span>}
                          <span className="text-xs text-gray-500">ID: {rec.employeeId}</span>
                        </div>
                        <div className="text-sm text-electric-400 mb-2">
                          {formatDate(rec.date)} &nbsp;·&nbsp; {formatIST(rec.submittedAt)}
                        </div>
                        <p className="text-gray-300 text-sm line-clamp-3">{rec.workSummary}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-gray-700 text-xs mt-10 pb-4">
          Made with ♥ by Pratham Jain &nbsp;|&nbsp; Garvix AI © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
