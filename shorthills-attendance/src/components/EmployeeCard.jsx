export default function EmployeeCard({ employee, onClick }) {
  return (
    <div
      onClick={() => onClick?.(employee)}
      className="card flex items-center gap-4 cursor-pointer animate-fade-in
                 hover:border-violet-500/40 hover:shadow-glow-violet transition-all duration-200 group"
    >
      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border border-white/10"
           style={{ background: 'linear-gradient(135deg, #7c3aed22, #3b82f622)' }}>
        {employee.photoURL ? (
          <img src={employee.photoURL} alt={employee.name}
               className="w-full h-full object-cover"
               onError={(e) => { e.target.style.display = 'none'; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-violet-400 text-xl font-bold">
            {employee.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white truncate">{employee.name}</div>
        <div className="text-sm text-gray-500 truncate">{employee.email}</div>
        <div className="text-xs text-violet-400 mt-0.5">ID: {employee.employeeId}</div>
      </div>

      <div className="text-gray-600 group-hover:text-violet-400 transition-colors flex-shrink-0">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}
