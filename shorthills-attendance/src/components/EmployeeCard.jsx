export default function EmployeeCard({ employee, onSelect }) {
  return (
    <div
      className="card flex items-center gap-4 cursor-pointer hover:border-electric-500 transition-all duration-200 animate-fade-in"
      onClick={() => onSelect && onSelect(employee)}
    >
      <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-navy-700 border-2 border-navy-600">
        {employee.photoURL ? (
          <img
            src={employee.photoURL}
            alt={employee.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-electric-400 text-xl font-bold">
            {employee.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white truncate">{employee.name}</div>
        <div className="text-sm text-gray-400 truncate">{employee.email}</div>
        <div className="text-xs text-electric-400 mt-0.5">ID: {employee.employeeId}</div>
      </div>

      <div className="text-navy-700">
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}
