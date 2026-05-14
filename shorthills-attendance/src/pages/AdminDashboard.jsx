import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import Navbar from '../components/Navbar';
import EmployeeCard from '../components/EmployeeCard';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard({ user }) {
  const [tab, setTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState('');
  const [filterName, setFilterName] = useState('');
  const [expandedPhoto, setExpandedPhoto] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const empSnap = await getDocs(collection(db, 'employees'));
        setEmployees(empSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        const attSnap = await getDocs(query(collection(db, 'attendance'), orderBy('date', 'desc')));
        setAttendance(attSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredAttendance = attendance.filter(r => {
    const matchDate = filterDate ? r.date === filterDate : true;
    const matchName = filterName ? r.employeeName?.toLowerCase().includes(filterName.toLowerCase()) : true;
    return matchDate && matchName;
  });

  return (
    <div className="min-h-screen bg-navy-900">
      <Navbar title="Admin Dashboard" />

      <div className="max-w-5xl mx-auto p-4 space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 bg-navy-800 border border-navy-700 rounded-xl p-1">
          <button
            onClick={() => setTab('employees')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'employees' ? 'bg-electric-500 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Employees ({employees.length})
          </button>
          <button
            onClick={() => setTab('reports')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'reports' ? 'bg-electric-500 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Attendance Reports
          </button>
        </div>

        {/* Employees Tab */}
        {tab === 'employees' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white text-xl font-bold">All Employees</h2>
              <button
                onClick={() => navigate('/admin/add-employee')}
                className="px-5 py-2 bg-electric-500 hover:bg-electric-600 text-white font-medium rounded-xl text-sm transition-colors"
              >
                + Add New Employee
              </button>
            </div>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-electric-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : employees.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <p className="text-lg">No employees yet.</p>
                <p className="text-sm mt-1">Click "Add New Employee" to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {employees.map(emp => <EmployeeCard key={emp.id} employee={emp} />)}
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {tab === 'reports' && (
          <div className="space-y-4">
            <h2 className="text-white text-xl font-bold">Attendance Reports</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="date"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                className="flex-1 bg-navy-700 border border-navy-600 text-white rounded-xl px-4 py-2 outline-none focus:border-electric-500 text-sm transition-colors"
              />
              <input
                type="text"
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
                placeholder="Filter by employee name"
                className="flex-1 bg-navy-700 border border-navy-600 text-white placeholder-gray-500 rounded-xl px-4 py-2 outline-none focus:border-electric-500 text-sm transition-colors"
              />
              {(filterDate || filterName) && (
                <button
                  onClick={() => { setFilterDate(''); setFilterName(''); }}
                  className="px-4 py-2 bg-navy-700 hover:bg-navy-600 text-gray-400 rounded-xl text-sm transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-electric-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredAttendance.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <p className="text-lg">No attendance records found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAttendance.map(record => (
                  <div key={record.id} className="bg-navy-800 border border-navy-700 rounded-xl p-4">
                    <div className="flex items-start gap-4">
                      {record.photoURL && (
                        <button onClick={() => setExpandedPhoto(record.photoURL)} className="flex-shrink-0">
                          <img src={record.photoURL} alt="" className="w-16 h-16 rounded-xl object-cover hover:ring-2 hover:ring-electric-500 transition-all" />
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                          <p className="text-white font-semibold">{record.employeeName}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-electric-400 text-sm font-mono">{record.date}</span>
                            {record.submittedAt?.toDate && (
                              <span className="text-gray-500 text-xs">
                                {new Intl.DateTimeFormat('en-IN', {
                                  timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit'
                                }).format(record.submittedAt.toDate())} IST
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-400 text-sm leading-relaxed">{record.workSummary}</p>
                        <p className="text-gray-600 text-xs mt-1">Employee ID: {record.employeeId}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-gray-600 text-xs pb-4">Made by Pratham Jain</p>
      </div>

      {/* Photo Modal */}
      {expandedPhoto && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setExpandedPhoto(null)}
        >
          <img src={expandedPhoto} alt="Attendance" className="max-w-full max-h-full rounded-2xl" />
          <button className="absolute top-4 right-4 text-white text-3xl font-bold">×</button>
        </div>
      )}
    </div>
  );
}
