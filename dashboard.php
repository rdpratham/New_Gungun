<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/AttendanceModel.php';
require_once __DIR__ . '/models/LeaveModel.php';

requireLogin();

// Admin redirect
if (isAdmin()) {
    header('Location: /admin/');
    exit;
}

$emp       = currentEmployee();
$empId     = (int) $emp['employee_id'];
$today     = date('Y-m-d');
$yearMonth = date('Y-m');

$todayRecord = AttendanceModel::getTodayRecord($empId);
$monthStats  = AttendanceModel::getMonthlyStats($empId, $yearMonth);
$leaveBalance = LeaveModel::getBalanceSummary($empId, (int)date('Y'));
$recentLeaves = array_slice(LeaveModel::getByEmployee($empId), 0, 3);

// Handle check-in / check-out POST
$actionMsg = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    if ($action === 'checkin') {
        $result = AttendanceModel::checkIn($empId, $emp['shift_start']);
        flashSet($result['success'] ? 'success' : 'danger', $result['message']);
    } elseif ($action === 'checkout') {
        $result = AttendanceModel::checkOut($empId);
        flashSet($result['success'] ? 'success' : 'danger', $result['message']);
    }
    header('Location: /dashboard.php');
    exit;
}

$pageTitle = 'Dashboard';
include __DIR__ . '/includes/header.php';

$statusBadge = [
    'present'  => 'success',
    'late'     => 'warning',
    'half_day' => 'info',
    'on_leave' => 'secondary',
    'absent'   => 'danger',
    'holiday'  => 'primary',
];
?>

<div class="row g-4">
  <!-- Welcome card -->
  <div class="col-12">
    <div class="card welcome-card border-0 shadow-sm">
      <div class="card-body d-flex align-items-center justify-content-between flex-wrap gap-3 p-4">
        <div>
          <h4 class="fw-bold mb-1">Good <?= date('H') < 12 ? 'Morning' : (date('H') < 17 ? 'Afternoon' : 'Evening') ?>,
            <?= h(explode(' ', $emp['full_name'])[0]) ?>!
          </h4>
          <p class="text-muted mb-0">
            <?= h($emp['designation']) ?> · <?= h($emp['department']) ?> ·
            Shift: <?= h($emp['shift_start']) ?>–<?= h($emp['shift_end']) ?>
          </p>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <?php if (!$todayRecord || !$todayRecord['check_in']): ?>
            <form method="POST" action="">
              <input type="hidden" name="action" value="checkin">
              <button type="submit" class="btn btn-success btn-lg px-4 fw-semibold">
                <i class="bi bi-box-arrow-in-right me-2"></i>Check In
              </button>
            </form>
          <?php elseif ($todayRecord['check_in'] && !$todayRecord['check_out']): ?>
            <div class="text-center">
              <small class="text-muted d-block mb-1">Checked in at
                <?= h(date('h:i A', strtotime($todayRecord['check_in']))) ?>
              </small>
              <form method="POST" action="">
                <input type="hidden" name="action" value="checkout">
                <button type="submit" class="btn btn-danger btn-lg px-4 fw-semibold">
                  <i class="bi bi-box-arrow-right me-2"></i>Check Out
                </button>
              </form>
            </div>
          <?php else: ?>
            <div class="text-center">
              <span class="badge bg-secondary fs-6 px-3 py-2">
                <i class="bi bi-check-circle me-1"></i>Day Complete
              </span>
              <div class="small text-muted mt-1">
                <?= h(date('h:i A', strtotime($todayRecord['check_in']))) ?> –
                <?= h(date('h:i A', strtotime($todayRecord['check_out']))) ?>
                (<?= $todayRecord['work_hours'] ?>h)
              </div>
            </div>
          <?php endif; ?>
        </div>
      </div>
    </div>
  </div>

  <!-- Today's status -->
  <div class="col-sm-6 col-lg-3">
    <div class="card kpi-card h-100 shadow-sm">
      <div class="card-body text-center p-4">
        <div class="kpi-icon text-primary mb-2"><i class="bi bi-calendar-today"></i></div>
        <div class="h4 fw-bold mb-1">
          <?php if ($todayRecord): ?>
            <span class="badge bg-<?= $statusBadge[$todayRecord['status']] ?? 'secondary' ?> fs-6">
              <?= ucfirst(str_replace('_', ' ', $todayRecord['status'])) ?>
            </span>
          <?php else: ?>
            <span class="badge bg-light text-dark border fs-6">Not Recorded</span>
          <?php endif; ?>
        </div>
        <p class="text-muted small mb-0">Today's Status</p>
      </div>
    </div>
  </div>

  <div class="col-sm-6 col-lg-3">
    <div class="card kpi-card h-100 shadow-sm">
      <div class="card-body text-center p-4">
        <div class="kpi-icon text-success mb-2"><i class="bi bi-check-circle"></i></div>
        <div class="h4 fw-bold mb-1"><?= (int)($monthStats['present'] ?? 0) + (int)($monthStats['late'] ?? 0) ?></div>
        <p class="text-muted small mb-0">Days Present (<?= date('M') ?>)</p>
      </div>
    </div>
  </div>

  <div class="col-sm-6 col-lg-3">
    <div class="card kpi-card h-100 shadow-sm">
      <div class="card-body text-center p-4">
        <div class="kpi-icon text-info mb-2"><i class="bi bi-clock-history"></i></div>
        <div class="h4 fw-bold mb-1"><?= $monthStats['total_hours'] ?? 0 ?>h</div>
        <p class="text-muted small mb-0">Hours Worked (<?= date('M') ?>)</p>
      </div>
    </div>
  </div>

  <div class="col-sm-6 col-lg-3">
    <div class="card kpi-card h-100 shadow-sm">
      <div class="card-body text-center p-4">
        <div class="kpi-icon text-warning mb-2"><i class="bi bi-calendar-minus"></i></div>
        <div class="h4 fw-bold mb-1"><?= $leaveBalance['casual']['remaining'] ?? 0 ?></div>
        <p class="text-muted small mb-0">Casual Leaves Left</p>
      </div>
    </div>
  </div>

  <!-- Leave balance -->
  <div class="col-md-6">
    <div class="card shadow-sm h-100">
      <div class="card-header bg-white fw-semibold border-bottom">
        <i class="bi bi-calendar-minus me-2 text-primary"></i>Leave Balance (<?= date('Y') ?>)
      </div>
      <div class="card-body p-0">
        <table class="table table-sm mb-0">
          <thead class="table-light">
            <tr><th>Type</th><th class="text-center">Allowed</th><th class="text-center">Used</th><th class="text-center">Remaining</th></tr>
          </thead>
          <tbody>
            <?php foreach ($leaveBalance as $type => $b): ?>
            <tr>
              <td><?= ucfirst($type) ?></td>
              <td class="text-center"><?= $b['allowed'] < 100 ? $b['allowed'] : '∞' ?></td>
              <td class="text-center"><?= $b['used'] ?></td>
              <td class="text-center fw-semibold text-<?= $b['remaining'] > 3 ? 'success' : ($b['remaining'] > 0 ? 'warning' : 'danger') ?>">
                <?= $b['allowed'] < 100 ? $b['remaining'] : '∞' ?>
              </td>
            </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Recent leaves -->
  <div class="col-md-6">
    <div class="card shadow-sm h-100">
      <div class="card-header bg-white fw-semibold border-bottom d-flex justify-content-between align-items-center">
        <span><i class="bi bi-calendar-x me-2 text-primary"></i>Recent Leave Requests</span>
        <a href="/leave_request.php" class="btn btn-sm btn-outline-primary">+ New</a>
      </div>
      <div class="card-body p-0">
        <?php if (empty($recentLeaves)): ?>
          <p class="text-muted text-center py-4 mb-0">No leave requests yet.</p>
        <?php else: ?>
          <table class="table table-sm mb-0">
            <thead class="table-light">
              <tr><th>Type</th><th>From</th><th>To</th><th>Status</th></tr>
            </thead>
            <tbody>
              <?php foreach ($recentLeaves as $lv): ?>
              <tr>
                <td><?= ucfirst($lv['leave_type']) ?></td>
                <td><?= h($lv['start_date']) ?></td>
                <td><?= h($lv['end_date']) ?></td>
                <td>
                  <span class="badge bg-<?= $lv['status'] === 'approved' ? 'success' : ($lv['status'] === 'rejected' ? 'danger' : 'warning') ?>">
                    <?= ucfirst($lv['status']) ?>
                  </span>
                </td>
              </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        <?php endif; ?>
      </div>
    </div>
  </div>

  <!-- Monthly stats chart -->
  <div class="col-12">
    <div class="card shadow-sm">
      <div class="card-header bg-white fw-semibold border-bottom">
        <i class="bi bi-bar-chart-line me-2 text-primary"></i>This Month – Attendance Breakdown
      </div>
      <div class="card-body">
        <canvas id="monthChart" height="80"></canvas>
      </div>
    </div>
  </div>

</div>

<script>
new Chart(document.getElementById('monthChart'), {
  type: 'doughnut',
  data: {
    labels: ['Present', 'Late', 'Half-Day', 'On Leave', 'Absent'],
    datasets: [{
      data: [
        <?= (int)($monthStats['present']  ?? 0) ?>,
        <?= (int)($monthStats['late']     ?? 0) ?>,
        <?= (int)($monthStats['half_day'] ?? 0) ?>,
        <?= (int)($monthStats['on_leave'] ?? 0) ?>,
        <?= (int)($monthStats['absent']   ?? 0) ?>
      ],
      backgroundColor: ['#198754','#ffc107','#0dcaf0','#6c757d','#dc3545'],
      borderWidth: 2
    }]
  },
  options: {
    plugins: { legend: { position: 'right' } },
    cutout: '65%'
  }
});
</script>

<?php include __DIR__ . '/includes/footer.php'; ?>
