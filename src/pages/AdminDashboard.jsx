import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { db, auth } from '../firebase'
import Navbar from '../components/Navbar'
import EmployeeCard from '../components/EmployeeCard'

function formatIST(ts) {
  if (!ts) return '—'
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date)
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('employees')
  const [employees, setEmployees] = useState([])
  const [attendance, setAttendance] = useState([])
  const [filteredAttendance, setFilteredAttendance] = useState([])
  const [loadingEmp, setLoadingEmp] = useState(true)
  const [loadingAtt, setLoadingAtt] = useState(false)
  const [filterDate, setFilterDate] = useState('')
  const [filterName, setFilterName] = useState('')
  const [expandedPhoto, setExpandedPhoto] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchEmployees()
  }, [])

  useEffect(() => {
    if (tab === 'attendance' && attendance.length === 0) {
      fetchAttendance()
    }
  }, [tab])

  useEffect(() => {
    let list = [...attendance]
    if (filterDate) list = list.filter(r => r.date === filterDate)
    if (filterName) list = list.filter(r => r.employeeName?.toLowerCase().includes(filterName.toLowerCase()))
    setFilteredAttendance(list)
  }, [attendance, filterDate, filterName])

  async function fetchEmployees() {
    setLoadingEmp(true)
    try {
      const snap = await getDocs(query(collection(db, 'employees'), orderBy('createdAt', 'desc')))
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingEmp(false)
    }
  }

  async function fetchAttendance() {
    setLoadingAtt(true)
    try {
      const snap = await getDocs(query(collection(db, 'attendance'), orderBy('submittedAt', 'desc')))
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setAttendance(records)
      setFilteredAttendance(records)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingAtt(false)
    }
  }

  async function handleLogout() {
    await signOut(auth)
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen bg-navy-900 flex flex-col">
      <Navbar isAdmin onLogout={handleLogout} />

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">Manage employees and attendance records</p>
          </div>
          <button onClick={() => navigate('/admin/add-employee')} className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New Employee
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-navy-800 rounded-xl p-1 mb-8 w-fit">
          <button
            onClick={() => setTab('employees')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === 'employees'
                ? 'bg-electric-500 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Employees ({employees.length})
          </button>
          <button
            onClick={() => setTab('attendance')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === 'attendance'
                ? 'bg-electric-500 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Attendance Reports
          </button>
        </div>

        {/* Employees Tab */}
        {tab === 'employees' && (
          <>
            {loadingEmp ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-electric-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : employees.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <svg className="w-12 h-12 mx-auto mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="font-medium">No employees yet</p>
                <p className="text-sm mt-1">Click "Add New Employee" to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {employees.map(emp => (
                  <EmployeeCard key={emp.id} employee={emp} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Attendance Tab */}
        {tab === 'attendance' && (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <input
                type="date"
                className="input-field sm:w-48"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
              />
              <input
                type="text"
                className="input-field sm:w-64"
                placeholder="Filter by employee name…"
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
              />
              {(filterDate || filterName) && (
                <button
                  onClick={() => { setFilterDate(''); setFilterName('') }}
                  className="btn-secondary text-sm"
                >
                  Clear filters
                </button>
              )}
            </div>

            {loadingAtt ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-electric-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredAttendance.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <p className="font-medium">No attendance records found</p>
                {(filterDate || filterName) && <p className="text-sm mt-1">Try adjusting your filters</p>}
              </div>
            ) : (
              <div className="card overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-navy-700">
                      <th className="text-left text-slate-400 font-medium px-5 py-3.5">Employee</th>
                      <th className="text-left text-slate-400 font-medium px-5 py-3.5">Date</th>
                      <th className="text-left text-slate-400 font-medium px-5 py-3.5">Submitted At</th>
                      <th className="text-left text-slate-400 font-medium px-5 py-3.5">Work Summary</th>
                      <th className="text-left text-slate-400 font-medium px-5 py-3.5">Photo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendance.map((rec, i) => (
                      <tr key={rec.id} className={`border-b border-navy-700/50 hover:bg-navy-700/30 transition-colors ${i % 2 === 0 ? '' : 'bg-navy-800/30'}`}>
                        <td className="px-5 py-3.5 font-medium text-white">{rec.employeeName || '—'}</td>
                        <td className="px-5 py-3.5 text-slate-300">{rec.date}</td>
                        <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap">{formatIST(rec.submittedAt)}</td>
                        <td className="px-5 py-3.5 text-slate-300 max-w-xs">
                          <p className="line-clamp-2">{rec.workSummary}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          {rec.photoURL ? (
                            <button
                              onClick={() => setExpandedPhoto(rec.photoURL)}
                              className="block w-10 h-10 rounded-lg overflow-hidden border border-navy-600 hover:border-electric-500 transition-colors"
                            >
                              <img src={rec.photoURL} alt="Attendance" className="w-full h-full object-cover" />
                            </button>
                          ) : <span className="text-slate-500">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Photo Lightbox */}
      {expandedPhoto && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setExpandedPhoto(null)}
        >
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <img src={expandedPhoto} alt="Attendance photo" className="w-full rounded-xl shadow-2xl" />
            <button
              onClick={() => setExpandedPhoto(null)}
              className="absolute -top-3 -right-3 bg-navy-800 border border-navy-600 rounded-full p-1.5 hover:bg-navy-700 transition-colors"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
