export default function EmployeeCard({ employee }) {
  return (
    <div className="card hover:border-navy-600 transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl overflow-hidden bg-navy-700 flex-shrink-0">
          {employee.photoURL ? (
            <img
              src={employee.photoURL}
              alt={employee.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl font-bold text-electric-500">
              {employee.name?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold truncate">{employee.name}</p>
          <p className="text-slate-400 text-xs truncate mt-0.5">{employee.email}</p>
          <span className="inline-block mt-1.5 bg-navy-700 text-slate-300 text-xs px-2 py-0.5 rounded font-mono">
            {employee.employeeId}
          </span>
        </div>
      </div>
    </div>
  )
}
