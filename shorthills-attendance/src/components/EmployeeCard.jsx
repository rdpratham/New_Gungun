export default function EmployeeCard({ employee, onClick }) {
  const initials = (employee.name || employee.email || '?')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div
      onClick={() => onClick?.(employee)}
      className="group relative cursor-pointer rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl animate-fade-in"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Slim gradient top strip */}
      <div className="h-12 w-full relative overflow-hidden flex-shrink-0"
           style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 60%, #06b6d4 100%)' }}>
        <div className="absolute inset-0 opacity-20"
             style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, #ffffff22 0%, transparent 60%)' }} />
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/30 backdrop-blur-sm rounded-full px-1.5 py-0.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${employee.profileComplete ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          <span className="text-white font-medium" style={{ fontSize: 9 }}>{employee.profileComplete ? 'Active' : 'Pending'}</span>
        </div>
      </div>

      {/* Avatar — overlaps strip */}
      <div className="flex justify-center -mt-6 mb-1.5 relative z-10">
        <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg flex-shrink-0"
             style={{ background: 'linear-gradient(135deg,#7c3aed33,#3b82f633)', border: '2px solid var(--surface)' }}>
          {employee.photoURL ? (
            <img src={employee.photoURL} alt={employee.name} className="w-full h-full object-cover"
                 onError={e => { e.target.style.display = 'none'; }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-bold"
                 style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff', fontSize: 16 }}>
              {initials}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="px-3 pb-3 text-center">
        <h3 className="font-bold truncate mb-0.5" style={{ fontSize: 12, color: 'var(--text)' }}>
          {employee.name || employee.email?.split('@')[0] || '—'}
        </h3>
        <p className="truncate mb-2" style={{ fontSize: 10, color: 'var(--text-3)' }}>{employee.email}</p>

        <div className="flex flex-wrap gap-1 justify-center mb-2">
          {employee.team && (
            <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 99, fontWeight: 500, background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>
              {employee.team}
            </span>
          )}
          <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 99, fontWeight: 500, background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
            ID: {employee.employeeId}
          </span>
        </div>

        <button
          className="w-full rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 group-hover:shadow-md"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff', fontSize: 11, padding: '5px 0' }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Manage
        </button>
      </div>
    </div>
  );
}
