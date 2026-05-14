<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/AttendanceModel.php';
require_once __DIR__ . '/../models/EmployeeModel.php';

requireAdmin();

$month = $_GET['month'] ?? date('Y-m');
$dept  = $_GET['dept']  ?? '';

$report      = AttendanceModel::getMonthlyReport($month, $dept ?: null);
$departments = EmployeeModel::getDepartments();

$from   = $month . '-01';
$to     = date('Y-m-t', strtotime($from));
$totalWorkDays = 0;
$d = new DateTime($from);
$e = new DateTime($to);
$e->modify('+1 day');
for ($x = clone $d; $x < $e; $x->modify('+1 day')) {
    if ($x->format('N') < 6) $totalWorkDays++;
}

$pageTitle = 'Reports';
include __DIR__ . '/../includes/header.php';
?>

<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
  <h5 class="fw-bold mb-0"><i class="bi bi-bar-chart-line me-2 text-primary"></i>Monthly Attendance Report</h5>
</div>

<!-- Filters -->
<div class="card shadow-sm mb-4">
  <div class="card-body py-2">
    <form class="row g-2 align-items-end" method="GET">
      <div class="col-sm-3">
        <label class="form-label small fw-semibold mb-1">Month</label>
        <input type="month" name="month" class="form-control form-control-sm"
               value="<?= h($month) ?>" max="<?= date('Y-m') ?>">
      </div>
      <div class="col-sm-3">
        <label class="form-label small fw-semibold mb-1">Department</label>
        <select name="dept" class="form-select form-select-sm">
          <option value="">All</option>
          <?php foreach ($departments as $d_): ?>
            <option value="<?= h($d_) ?>" <?= $dept === $d_ ? 'selected' : '' ?>><?= h($d_) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="col-auto">
        <button class="btn btn-primary btn-sm">Generate</button>
        <a href="/admin/reports.php" class="btn btn-outline-secondary btn-sm ms-1">Reset</a>
      </div>
    </form>
  </div>
</div>

<!-- Summary stats -->
<?php
$totPresent  = array_sum(array_column($report, 'present'));
$totLate     = array_sum(array_column($report, 'late'));
$totLeave    = array_sum(array_column($report, 'on_leave'));
$totAbsent   = array_sum(array_column($report, 'absent'));
$totHours    = array_sum(array_column($report, 'total_hours'));
?>
<div class="row g-3 mb-4">
  <?php
  $kpis = [
    ['Present Days', $totPresent,  'success', 'check-circle'],
    ['Late',         $totLate,     'warning',  'clock'],
    ['On Leave',     $totLeave,    'secondary','calendar-x'],
    ['Absent',       $totAbsent,   'danger',   'x-circle'],
    ['Total Hrs',    round($totHours,1).'h','primary','clock-history'],
    ['Work Days',    $totalWorkDays,'info',   'calendar-week'],
  ];
  foreach ($kpis as [$lbl,$val,$color,$icon]): ?>
  <div class="col-6 col-sm-4 col-lg-2">
    <div class="card kpi-card text-center shadow-sm">
      <div class="card-body py-3">
        <i class="bi bi-<?= $icon ?> fs-2 text-<?= $color ?> mb-1 d-block"></i>
        <div class="fw-bold fs-5"><?= $val ?></div>
        <div class="small text-muted"><?= $lbl ?></div>
      </div>
    </div>
  </div>
  <?php endforeach; ?>
</div>

<!-- Report table -->
<div class="card shadow-sm">
  <div class="card-header bg-white fw-semibold border-bottom d-flex justify-content-between align-items-center">
    <span><?= date('F Y', strtotime($from)) ?> – Employee Breakdown (<?= $totalWorkDays ?> working days)</span>
    <button onclick="printTable()" class="btn btn-sm btn-outline-secondary">
      <i class="bi bi-printer me-1"></i>Print
    </button>
  </div>
  <div class="card-body p-0" id="printArea">
    <?php if (empty($report)): ?>
      <p class="text-center text-muted py-5 mb-0">No data for this period.</p>
    <?php else: ?>
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0" id="reportTable">
        <thead class="table-light">
          <tr>
            <th>Code</th><th>Name</th><th>Department</th>
            <th class="text-center">Present</th>
            <th class="text-center">Late</th>
            <th class="text-center">Half-Day</th>
            <th class="text-center">On Leave</th>
            <th class="text-center">Absent</th>
            <th class="text-center">Total Hrs</th>
            <th class="text-center">Attendance %</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($report as $row):
            $daysPresent = (int)$row['present'] + (int)$row['late'] + (int)$row['half_day'] * 0.5;
            $pct = $totalWorkDays > 0 ? round($daysPresent / $totalWorkDays * 100, 1) : 0;
            $pctColor = $pct >= 90 ? 'success' : ($pct >= 75 ? 'warning' : 'danger');
          ?>
          <tr>
            <td class="font-monospace small"><?= h($row['employee_code']) ?></td>
            <td><?= h($row['full_name']) ?></td>
            <td><?= h($row['department']) ?></td>
            <td class="text-center"><?= (int)$row['present'] ?></td>
            <td class="text-center"><?= (int)$row['late'] ?></td>
            <td class="text-center"><?= (int)$row['half_day'] ?></td>
            <td class="text-center"><?= (int)$row['on_leave'] ?></td>
            <td class="text-center"><?= (int)$row['absent'] ?></td>
            <td class="text-center"><?= $row['total_hours'] ?>h</td>
            <td class="text-center">
              <div class="d-flex align-items-center gap-2">
                <div class="progress flex-grow-1" style="height:8px;">
                  <div class="progress-bar bg-<?= $pctColor ?>" style="width:<?= $pct ?>%"></div>
                </div>
                <span class="small fw-semibold text-<?= $pctColor ?>"><?= $pct ?>%</span>
              </div>
            </td>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
    <?php endif; ?>
  </div>
</div>

<!-- Chart -->
<?php if (!empty($report)): ?>
<div class="card shadow-sm mt-4">
  <div class="card-header bg-white fw-semibold border-bottom">
    <i class="bi bi-bar-chart me-2 text-primary"></i>Attendance % by Employee
  </div>
  <div class="card-body">
    <canvas id="reportChart" height="80"></canvas>
  </div>
</div>
<script>
const names = <?= json_encode(array_column($report, 'full_name')) ?>;
const pcts  = <?= json_encode(array_map(function($r) use ($totalWorkDays) {
    $d = (int)$r['present'] + (int)$r['late'] + (int)$r['half_day'] * 0.5;
    return $totalWorkDays > 0 ? round($d / $totalWorkDays * 100, 1) : 0;
}, $report)) ?>;

new Chart(document.getElementById('reportChart'), {
  type: 'bar',
  data: {
    labels: names,
    datasets: [{
      label: 'Attendance %',
      data: pcts,
      backgroundColor: pcts.map(p => p >= 90 ? '#198754aa' : (p >= 75 ? '#ffc107aa' : '#dc3545aa')),
      borderColor:     pcts.map(p => p >= 90 ? '#198754'   : (p >= 75 ? '#ffc107'   : '#dc3545')),
      borderWidth: 2,
      borderRadius: 5
    }]
  },
  options: {
    plugins: { legend: { display: false } },
    scales: {
      y: { min: 0, max: 100, ticks: { callback: v => v + '%' } }
    }
  }
});
</script>
<?php endif; ?>

<script>
function printTable() {
  const w = window.open('', '_blank');
  w.document.write('<html><head><title>Attendance Report</title>'
    + '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">'
    + '</head><body class="p-4">'
    + '<h4><?= APP_NAME ?> – Attendance Report <?= date('F Y', strtotime($from)) ?></h4>'
    + document.getElementById('printArea').innerHTML
    + '</body></html>');
  w.document.close();
  w.print();
}
</script>

<?php include __DIR__ . '/../includes/footer.php'; ?>
