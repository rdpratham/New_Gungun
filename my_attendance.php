<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/AttendanceModel.php';

requireLogin();
if (isAdmin()) { header('Location: /admin/attendance.php'); exit; }

$emp   = currentEmployee();
$empId = (int) $emp['employee_id'];

$month = $_GET['month'] ?? date('Y-m');
$from  = $month . '-01';
$to    = date('Y-m-t', strtotime($from));

$records    = AttendanceModel::getByEmployee($empId, $from, $to);
$monthStats = AttendanceModel::getMonthlyStats($empId, $month);

$statusBadge = [
    'present'  => 'success',
    'late'     => 'warning',
    'half_day' => 'info',
    'on_leave' => 'secondary',
    'absent'   => 'danger',
    'holiday'  => 'primary',
];

$pageTitle = 'My Attendance';
include __DIR__ . '/includes/header.php';
?>

<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
  <h5 class="fw-bold mb-0"><i class="bi bi-calendar-check me-2 text-primary"></i>My Attendance</h5>
  <form class="d-flex gap-2 align-items-center" method="GET">
    <label class="text-muted small">Month:</label>
    <input type="month" name="month" class="form-control form-control-sm"
           value="<?= h($month) ?>" max="<?= date('Y-m') ?>">
    <button class="btn btn-sm btn-primary">Go</button>
  </form>
</div>

<!-- Stats row -->
<div class="row g-3 mb-4">
  <?php
  $kpis = [
    ['label'=>'Present',   'val'=>(int)($monthStats['present']  ?? 0) + (int)($monthStats['late'] ?? 0),
     'color'=>'success', 'icon'=>'check-circle'],
    ['label'=>'Late',      'val'=>(int)($monthStats['late']     ?? 0), 'color'=>'warning',   'icon'=>'clock'],
    ['label'=>'Half-Day',  'val'=>(int)($monthStats['half_day'] ?? 0), 'color'=>'info',      'icon'=>'clock-history'],
    ['label'=>'On Leave',  'val'=>(int)($monthStats['on_leave'] ?? 0), 'color'=>'secondary', 'icon'=>'calendar-x'],
    ['label'=>'Absent',    'val'=>(int)($monthStats['absent']   ?? 0), 'color'=>'danger',    'icon'=>'x-circle'],
    ['label'=>'Total Hrs', 'val'=>($monthStats['total_hours']   ?? 0).'h', 'color'=>'primary','icon'=>'clock-fill'],
  ];
  foreach ($kpis as $k): ?>
  <div class="col-6 col-sm-4 col-lg-2">
    <div class="card kpi-card text-center shadow-sm h-100">
      <div class="card-body py-3">
        <i class="bi bi-<?= $k['icon'] ?> fs-3 text-<?= $k['color'] ?> mb-1 d-block"></i>
        <div class="fw-bold fs-5"><?= h((string)$k['val']) ?></div>
        <div class="small text-muted"><?= $k['label'] ?></div>
      </div>
    </div>
  </div>
  <?php endforeach; ?>
</div>

<!-- Records table -->
<div class="card shadow-sm">
  <div class="card-header bg-white fw-semibold border-bottom">
    Attendance Records – <?= date('F Y', strtotime($from)) ?>
  </div>
  <div class="card-body p-0">
    <?php if (empty($records)): ?>
      <p class="text-muted text-center py-5 mb-0">No records found for this month.</p>
    <?php else: ?>
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead class="table-light">
          <tr>
            <th>Date</th>
            <th>Day</th>
            <th>Check In</th>
            <th>Check Out</th>
            <th>Hours</th>
            <th>Status</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($records as $r): ?>
          <tr>
            <td><?= h($r['date']) ?></td>
            <td class="text-muted small"><?= date('D', strtotime($r['date'])) ?></td>
            <td><?= $r['check_in']  ? h(date('h:i A', strtotime($r['check_in'])))  : '–' ?></td>
            <td><?= $r['check_out'] ? h(date('h:i A', strtotime($r['check_out']))) : '–' ?></td>
            <td><?= $r['work_hours'] ? $r['work_hours'].'h' : '–' ?></td>
            <td>
              <span class="badge bg-<?= $statusBadge[$r['status']] ?? 'secondary' ?>">
                <?= ucfirst(str_replace('_', ' ', $r['status'])) ?>
              </span>
            </td>
            <td class="text-muted small"><?= $r['notes'] ? h($r['notes']) : '–' ?></td>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
    <?php endif; ?>
  </div>
</div>

<?php include __DIR__ . '/includes/footer.php'; ?>
