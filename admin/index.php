<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/EmployeeModel.php';
require_once __DIR__ . '/../models/AttendanceModel.php';
require_once __DIR__ . '/../models/LeaveModel.php';

requireAdmin();

$todaySummary  = AttendanceModel::getTodaySummary();
$totalEmp      = EmployeeModel::count();
$pendingLeaves = LeaveModel::pendingCount();

// Total absent today = total active employees minus those with any record
$presentToday  = (int)($todaySummary['present'] ?? 0)
               + (int)($todaySummary['late']     ?? 0)
               + (int)($todaySummary['half_day'] ?? 0)
               + (int)($todaySummary['on_leave'] ?? 0);
$absentToday   = max(0, $totalEmp - $presentToday - (int)($todaySummary['on_leave'] ?? 0));

// Recent attendance (today)
$recentRecords = array_slice(AttendanceModel::getAll(date('Y-m-d')), 0, 10);

// Monthly trend: last 6 months present-count
$db = Database::getConnection();
$monthTrend = [];
for ($i = 5; $i >= 0; $i--) {
    $ym   = date('Y-m', strtotime("-$i months"));
    $from = $ym . '-01';
    $to   = date('Y-m-t', strtotime($from));
    $row  = $db->prepare(
        "SELECT COUNT(*) FROM attendance
         WHERE date BETWEEN ? AND ?
           AND status IN ('present','late','half_day')"
    );
    $row->execute([$from, $to]);
    $monthTrend[] = [
        'label' => date('M', strtotime($from)),
        'count' => (int)$row->fetchColumn(),
    ];
}

$pageTitle = 'Admin Dashboard';
include __DIR__ . '/../includes/header.php';
?>

<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
  <h5 class="fw-bold mb-0"><i class="bi bi-speedometer2 me-2 text-primary"></i>Admin Dashboard</h5>
  <span class="text-muted small"><i class="bi bi-calendar3 me-1"></i><?= date('l, d F Y') ?></span>
</div>

<!-- KPI Cards -->
<div class="row g-3 mb-4">
  <?php
  $kpis = [
    ['label'=>'Total Employees', 'val'=>$totalEmp,
     'icon'=>'people-fill',    'color'=>'primary',   'link'=>'/admin/employees.php'],
    ['label'=>'Present Today',   'val'=>(int)($todaySummary['present'] ?? 0),
     'icon'=>'check-circle-fill','color'=>'success', 'link'=>'/admin/attendance.php'],
    ['label'=>'Late Today',      'val'=>(int)($todaySummary['late'] ?? 0),
     'icon'=>'clock-fill',      'color'=>'warning',  'link'=>'/admin/attendance.php'],
    ['label'=>'On Leave Today',  'val'=>(int)($todaySummary['on_leave'] ?? 0),
     'icon'=>'calendar-x-fill', 'color'=>'secondary','link'=>'/admin/leaves.php'],
    ['label'=>'Still Checked-In','val'=>(int)($todaySummary['still_in'] ?? 0),
     'icon'=>'door-open-fill',  'color'=>'info',     'link'=>'/admin/attendance.php'],
    ['label'=>'Pending Leaves',  'val'=>$pendingLeaves,
     'icon'=>'hourglass-split', 'color'=>'danger',   'link'=>'/admin/leaves.php'],
  ];
  foreach ($kpis as $k): ?>
  <div class="col-6 col-sm-4 col-xl-2">
    <a href="<?= $k['link'] ?>" class="text-decoration-none">
      <div class="card kpi-card shadow-sm h-100">
        <div class="card-body text-center py-3">
          <i class="bi bi-<?= $k['icon'] ?> fs-2 text-<?= $k['color'] ?> mb-2 d-block"></i>
          <div class="fw-bold fs-4"><?= $k['val'] ?></div>
          <div class="small text-muted"><?= $k['label'] ?></div>
        </div>
      </div>
    </a>
  </div>
  <?php endforeach; ?>
</div>

<div class="row g-4">
  <!-- Trend chart -->
  <div class="col-lg-7">
    <div class="card shadow-sm h-100">
      <div class="card-header bg-white fw-semibold border-bottom">
        <i class="bi bi-bar-chart me-2 text-primary"></i>6-Month Attendance Trend
      </div>
      <div class="card-body">
        <canvas id="trendChart" height="120"></canvas>
      </div>
    </div>
  </div>

  <!-- Today donut -->
  <div class="col-lg-5">
    <div class="card shadow-sm h-100">
      <div class="card-header bg-white fw-semibold border-bottom">
        <i class="bi bi-pie-chart me-2 text-primary"></i>Today's Status Breakdown
      </div>
      <div class="card-body d-flex align-items-center justify-content-center">
        <canvas id="todayChart" style="max-height:220px;"></canvas>
      </div>
    </div>
  </div>

  <!-- Recent check-ins table -->
  <div class="col-12">
    <div class="card shadow-sm">
      <div class="card-header bg-white fw-semibold border-bottom d-flex justify-content-between align-items-center">
        <span><i class="bi bi-list-check me-2 text-primary"></i>Today's Attendance</span>
        <a href="/admin/attendance.php" class="btn btn-sm btn-outline-primary">View All</a>
      </div>
      <div class="card-body p-0">
        <?php if (empty($recentRecords)): ?>
          <p class="text-center text-muted py-4 mb-0">No check-ins recorded today.</p>
        <?php else: ?>
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr><th>Employee</th><th>Dept</th><th>Check In</th><th>Check Out</th><th>Hours</th><th>Status</th></tr>
            </thead>
            <tbody>
              <?php foreach ($recentRecords as $r):
                $badge = ['present'=>'success','late'=>'warning','half_day'=>'info',
                          'on_leave'=>'secondary','absent'=>'danger','holiday'=>'primary'];
              ?>
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
                  <span class="badge bg-<?= $badge[$r['status']] ?? 'secondary' ?>">
                    <?= ucfirst(str_replace('_',' ',$r['status'])) ?>
                  </span>
                </td>
              </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
        <?php endif; ?>
      </div>
    </div>
  </div>
</div>

<script>
const trendLabels = <?= json_encode(array_column($monthTrend, 'label')) ?>;
const trendData   = <?= json_encode(array_column($monthTrend, 'count')) ?>;

new Chart(document.getElementById('trendChart'), {
  type: 'bar',
  data: {
    labels: trendLabels,
    datasets: [{
      label: 'Days Attended',
      data: trendData,
      backgroundColor: '#0d6efd88',
      borderColor: '#0d6efd',
      borderWidth: 2,
      borderRadius: 6
    }]
  },
  options: {
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
  }
});

new Chart(document.getElementById('todayChart'), {
  type: 'doughnut',
  data: {
    labels: ['Present','Late','Half-Day','On Leave','Absent'],
    datasets: [{
      data: [
        <?= (int)($todaySummary['present']  ?? 0) ?>,
        <?= (int)($todaySummary['late']     ?? 0) ?>,
        <?= (int)($todaySummary['half_day'] ?? 0) ?>,
        <?= (int)($todaySummary['on_leave'] ?? 0) ?>,
        <?= max(0, $totalEmp - $presentToday) ?>
      ],
      backgroundColor: ['#198754','#ffc107','#0dcaf0','#6c757d','#dc3545'],
      borderWidth: 2
    }]
  },
  options: { plugins: { legend: { position: 'bottom' } }, cutout: '60%' }
});
</script>

<?php include __DIR__ . '/../includes/footer.php'; ?>
