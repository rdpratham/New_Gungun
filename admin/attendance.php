<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/AttendanceModel.php';
require_once __DIR__ . '/../models/EmployeeModel.php';

requireAdmin();

// Handle manual record update/add
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $empId = (int)($_POST['employee_id'] ?? 0);
    $date  = $_POST['date'] ?? '';

    if ($empId && $date) {
        $workHours = 0;
        if (!empty($_POST['check_in']) && !empty($_POST['check_out'])) {
            $diff = strtotime($date . ' ' . $_POST['check_out'])
                  - strtotime($date . ' ' . $_POST['check_in']);
            $workHours = round(max(0, $diff) / 3600, 2);
        }
        AttendanceModel::upsert($empId, $date, [
            'check_in'   => !empty($_POST['check_in'])  ? $date . ' ' . $_POST['check_in']  : null,
            'check_out'  => !empty($_POST['check_out']) ? $date . ' ' . $_POST['check_out'] : null,
            'status'     => $_POST['status']     ?? 'present',
            'work_hours' => $workHours,
            'notes'      => trim($_POST['notes'] ?? ''),
        ]);
        flashSet('success', 'Attendance record saved.');
    }
    header('Location: /admin/attendance.php?' . http_build_query([
        'date' => $date,
        'dept' => $_POST['dept_filter'] ?? '',
    ]));
    exit;
}

$filterDate = $_GET['date'] ?? date('Y-m-d');
$filterDept = $_GET['dept'] ?? '';
$records    = AttendanceModel::getAll($filterDate, $filterDept ?: null);
$employees  = EmployeeModel::getAll(true);
$departments= EmployeeModel::getDepartments();

$statusBadge = [
    'present'  => 'success',
    'late'     => 'warning',
    'half_day' => 'info',
    'on_leave' => 'secondary',
    'absent'   => 'danger',
    'holiday'  => 'primary',
];

$pageTitle = 'Attendance';
include __DIR__ . '/../includes/header.php';
?>

<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
  <h5 class="fw-bold mb-0"><i class="bi bi-calendar-check me-2 text-primary"></i>Attendance Records</h5>
  <button class="btn btn-outline-primary" data-bs-toggle="modal" data-bs-target="#addModal">
    <i class="bi bi-plus-lg me-1"></i>Add / Edit Record
  </button>
</div>

<!-- Filters -->
<div class="card shadow-sm mb-4">
  <div class="card-body py-2">
    <form class="row g-2 align-items-end" method="GET">
      <div class="col-sm-4 col-lg-3">
        <label class="form-label small fw-semibold mb-1">Date</label>
        <input type="date" name="date" class="form-control form-control-sm"
               value="<?= h($filterDate) ?>">
      </div>
      <div class="col-sm-4 col-lg-3">
        <label class="form-label small fw-semibold mb-1">Department</label>
        <select name="dept" class="form-select form-select-sm">
          <option value="">All Departments</option>
          <?php foreach ($departments as $d): ?>
            <option value="<?= h($d) ?>" <?= $filterDept === $d ? 'selected' : '' ?>><?= h($d) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="col-auto">
        <button class="btn btn-primary btn-sm">Filter</button>
        <a href="/admin/attendance.php" class="btn btn-outline-secondary btn-sm ms-1">Reset</a>
      </div>
    </form>
  </div>
</div>

<!-- Records -->
<div class="card shadow-sm">
  <div class="card-header bg-white d-flex justify-content-between align-items-center border-bottom">
    <span class="fw-semibold">
      <?= date('l, d F Y', strtotime($filterDate)) ?>
      <?= $filterDept ? '· '.h($filterDept) : '' ?>
      <span class="badge bg-secondary ms-1"><?= count($records) ?> records</span>
    </span>
  </div>
  <div class="card-body p-0">
    <?php if (empty($records)): ?>
      <p class="text-center text-muted py-5 mb-0">No records for this date.</p>
    <?php else: ?>
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead class="table-light">
          <tr>
            <th>Employee</th><th>Dept</th><th>Check In</th>
            <th>Check Out</th><th>Hours</th><th>Status</th><th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($records as $r): ?>
          <tr>
            <td>
              <div class="fw-semibold"><?= h($r['full_name']) ?></div>
              <div class="small text-muted"><?= h($r['employee_code']) ?></div>
            </td>
            <td><?= h($r['department']) ?></td>
            <td><?= $r['check_in']  ? h(date('h:i A', strtotime($r['check_in'])))  : '–' ?></td>
            <td><?= $r['check_out'] ? h(date('h:i A', strtotime($r['check_out']))) : '–' ?></td>
            <td><?= $r['work_hours'] ? $r['work_hours'].'h' : '–' ?></td>
            <td>
              <span class="badge bg-<?= $statusBadge[$r['status']] ?? 'secondary' ?>">
                <?= ucfirst(str_replace('_',' ',$r['status'])) ?>
              </span>
            </td>
            <td class="small text-muted"><?= $r['notes'] ? h($r['notes']) : '–' ?></td>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
    <?php endif; ?>
  </div>
</div>

<!-- Add/Edit Modal -->
<div class="modal fade" id="addModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <form method="POST" action="">
        <input type="hidden" name="dept_filter" value="<?= h($filterDept) ?>">
        <div class="modal-header">
          <h5 class="modal-title fw-bold"><i class="bi bi-calendar-plus me-2"></i>Add / Edit Record</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="row g-3">
            <div class="col-12">
              <label class="form-label fw-semibold">Employee *</label>
              <select name="employee_id" class="form-select" required>
                <option value="">Select employee…</option>
                <?php foreach ($employees as $emp): ?>
                  <option value="<?= $emp['employee_id'] ?>">
                    <?= h($emp['employee_code']) ?> – <?= h($emp['full_name']) ?>
                  </option>
                <?php endforeach; ?>
              </select>
            </div>
            <div class="col-12">
              <label class="form-label fw-semibold">Date *</label>
              <input type="date" name="date" class="form-control"
                     value="<?= h($filterDate) ?>" required>
            </div>
            <div class="col-6">
              <label class="form-label fw-semibold">Check In</label>
              <input type="time" name="check_in" class="form-control">
            </div>
            <div class="col-6">
              <label class="form-label fw-semibold">Check Out</label>
              <input type="time" name="check_out" class="form-control">
            </div>
            <div class="col-12">
              <label class="form-label fw-semibold">Status</label>
              <select name="status" class="form-select">
                <?php foreach (['present','late','half_day','absent','on_leave','holiday'] as $s): ?>
                  <option value="<?= $s ?>"><?= ucfirst(str_replace('_',' ',$s)) ?></option>
                <?php endforeach; ?>
              </select>
            </div>
            <div class="col-12">
              <label class="form-label fw-semibold">Notes</label>
              <input type="text" name="notes" class="form-control" placeholder="Optional note">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="submit" class="btn btn-primary fw-semibold">
            <i class="bi bi-check-lg me-1"></i>Save Record
          </button>
        </div>
      </form>
    </div>
  </div>
</div>

<?php include __DIR__ . '/../includes/footer.php'; ?>
