export default function EmployeeCard({ employee }) {
  return (
    <div className="bg-navy-800 border border-navy-700 rounded-xl p-4 flex items-center gap-4 hover:border-electric-500 transition-colors">
      <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-navy-700">
        {employee.photoURL ? (
          <img src={employee.photoURL} alt={employee.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl text-gray-400">
            {employee.name?.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold truncate">{employee.name}</p>
        <p className="text-gray-400 text-sm truncate">{employee.email}</p>
        <p className="text-electric-400 text-xs mt-1">ID: {employee.employeeId}</p>
      </div>
    </div>
  );
}
