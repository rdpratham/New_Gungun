export default function EmployeeCard({ employee, onClick }) {
  const initials = (employee.name || employee.email || '?')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div
      onClick={() => onClick?.(employee)}
      className="group relative cursor-pointer rounded-2xl overflow-hidden transition-all duration-300
                 hover:-translate-y-1 hover:shadow-2xl animate-fade-in"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Gradient top strip */}
      <div className="h-24 w-full relative overflow-hidden"
           style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 60%, #06b6d4 100%)' }}>
        <div className="absolute inset-0 opacity-30"
             style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, #ffffff22 0%, transparent 60%)' }} />
        {/* Status dot */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/30 backdrop-blur-sm rounded-full px-2 py-1">
          <span className={`w-1.5 h-1.5 rounded-full ${employee.profileComplete ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-white text-xs font-medium">{employee.profileComplete ? 'Active' : 'Pending'}</span>
        </div>
      </div>

      {/* Avatar — overlaps the strip */}
      <div className="flex justify-center -mt-10 mb-3 relative z-10">
        <div className="w-20 h-20 rounded-2xl overflow-hidden ring-4 shadow-xl flex-shrink-0"
             style={{ ringColor: 'var(--surface)', background: 'linear-gradient(135deg,#7c3aed33,#3b82f633)', border: '3px solid var(--surface)' }}>
          {employee.photoURL ? (
            <img src={employee.photoURL} alt={employee.name} className="w-full h-full object-cover"
                 onError={e => { e.target.style.display = 'none'; }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-bold"
                 style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff' }}>
              {initials}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="px-5 pb-5 text-center">
        <h3 className="font-bold text-base truncate mb-0.5" style={{ color: 'var(--text)' }}>
          {employee.name || employee.email?.split('@')[0] || '—'}
        </h3>
        <p className="text-xs truncate mb-3" style={{ color: 'var(--text-3)' }}>{employee.email}</p>

        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {employee.team && (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>
              {employee.team}
            </span>
          )}
          <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
            ID: {employee.employeeId}
          </span>
        </div>

        {employee.joiningDate && (
          <p className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>
            Joined&nbsp;
            {new Date(employee.joiningDate + 'T00:00:00').toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </p>
        )}

        <button
          className="w-full py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 group-hover:shadow-lg"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Manage
        </button>
      </div>
    </div>
  );
}
