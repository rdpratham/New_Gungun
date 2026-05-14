<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/LeaveModel.php';

requireLogin();
if (isAdmin()) { header('Location: /admin/leaves.php'); exit; }

$emp   = currentEmployee();
$empId = (int) $emp['employee_id'];

$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $type  = $_POST['leave_type']  ?? '';
    $start = $_POST['start_date']  ?? '';
    $end   = $_POST['end_date']    ?? '';
    $reason = trim($_POST['reason'] ?? '');

    $validTypes = ['sick', 'casual', 'earned', 'unpaid'];
    if (!in_array($type, $validTypes))   $errors[] = 'Invalid leave type.';
    if (empty($start) || empty($end))    $errors[] = 'Start and end dates are required.';
    if ($start > $end)                   $errors[] = 'End date must be on or after start date.';
    if (empty($reason))                  $errors[] = 'Please provide a reason.';

    if (empty($errors)) {
        LeaveModel::create([
            'employee_id' => $empId,
            'leave_type'  => $type,
            'start_date'  => $start,
            'end_date'    => $end,
            'reason'      => $reason,
        ]);
        flashSet('success', 'Leave request submitted successfully!');
        header('Location: /leave_request.php');
        exit;
    }
}

$leaveBalance = LeaveModel::getBalanceSummary($empId, (int)date('Y'));
$myLeaves     = LeaveModel::getByEmployee($empId);

$pageTitle = 'Leave Request';
include __DIR__ . '/includes/header.php';
?>

<div class="row g-4">
  <!-- Form -->
  <div class="col-lg-5">
    <div class="card shadow-sm">
      <div class="card-header bg-white fw-semibold border-bottom">
        <i class="bi bi-calendar-plus me-2 text-primary"></i>New Leave Request
      </div>
      <div class="card-body p-4">
        <?php if (!empty($errors)): ?>
          <div class="alert alert-danger py-2">
            <?php foreach ($errors as $e): ?><div><i class="bi bi-exclamation-circle me-1"></i><?= h($e) ?></div><?php endforeach; ?>
          </div>
        <?php endif; ?>

        <form method="POST" action="">
          <div class="mb-3">
            <label class="form-label fw-semibold">Leave Type</label>
            <select name="leave_type" class="form-select" required>
              <option value="">Select type…</option>
              <?php foreach (['sick','casual','earned','unpaid'] as $lt):
                $bal = $leaveBalance[$lt] ?? null; ?>
              <option value="<?= $lt ?>" <?= ($_POST['leave_type'] ?? '') === $lt ? 'selected' : '' ?>>
                <?= ucfirst($lt) ?> Leave
                <?php if ($bal && $bal['allowed'] < 100): ?>
                  (<?= $bal['remaining'] ?> days left)
                <?php endif; ?>
              </option>
              <?php endforeach; ?>
            </select>
          </div>

          <div class="row g-3 mb-3">
            <div class="col-6">
              <label class="form-label fw-semibold">From</label>
              <input type="date" name="start_date" class="form-control"
                     value="<?= h($_POST['start_date'] ?? '') ?>" required
                     min="<?= date('Y-m-d') ?>">
            </div>
            <div class="col-6">
              <label class="form-label fw-semibold">To</label>
              <input type="date" name="end_date" class="form-control"
                     value="<?= h($_POST['end_date'] ?? '') ?>" required
                     min="<?= date('Y-m-d') ?>">
            </div>
          </div>

          <div class="mb-4">
            <label class="form-label fw-semibold">Reason</label>
            <textarea name="reason" class="form-control" rows="3" required
                      placeholder="Briefly describe your reason…"><?= h($_POST['reason'] ?? '') ?></textarea>
          </div>

          <button type="submit" class="btn btn-primary w-100 fw-semibold">
            <i class="bi bi-send me-2"></i>Submit Request
          </button>
        </form>
      </div>
    </div>

    <!-- Balance -->
    <div class="card shadow-sm mt-3">
      <div class="card-header bg-white fw-semibold border-bottom">
        <i class="bi bi-pie-chart me-2 text-primary"></i>Leave Balance (<?= date('Y') ?>)
      </div>
      <div class="card-body p-0">
        <table class="table table-sm mb-0">
          <thead class="table-light"><tr><th>Type</th><th>Total</th><th>Used</th><th>Left</th></tr></thead>
          <tbody>
            <?php foreach ($leaveBalance as $type => $b): ?>
            <tr>
              <td><?= ucfirst($type) ?></td>
              <td><?= $b['allowed'] < 100 ? $b['allowed'] : '∞' ?></td>
              <td><?= $b['used'] ?></td>
              <td class="fw-semibold text-<?= $b['remaining'] > 3 ? 'success' : ($b['remaining'] > 0 ? 'warning' : 'danger') ?>">
                <?= $b['allowed'] < 100 ? $b['remaining'] : '∞' ?>
              </td>
            </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- History -->
  <div class="col-lg-7">
    <div class="card shadow-sm">
      <div class="card-header bg-white fw-semibold border-bottom">
        <i class="bi bi-list-ul me-2 text-primary"></i>My Leave History
      </div>
      <div class="card-body p-0">
        <?php if (empty($myLeaves)): ?>
          <p class="text-muted text-center py-5 mb-0">No leave requests yet.</p>
        <?php else: ?>
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th>Applied</th></tr>
            </thead>
            <tbody>
              <?php foreach ($myLeaves as $lv): ?>
              <tr>
                <td><?= ucfirst($lv['leave_type']) ?></td>
                <td><?= h($lv['start_date']) ?></td>
                <td><?= h($lv['end_date']) ?></td>
                <td><?= $lv['days_count'] ?></td>
                <td>
                  <span class="badge bg-<?= $lv['status'] === 'approved' ? 'success' : ($lv['status'] === 'rejected' ? 'danger' : 'warning') ?>">
                    <?= ucfirst($lv['status']) ?>
                  </span>
                </td>
                <td class="text-muted small"><?= h(date('d M Y', strtotime($lv['created_at']))) ?></td>
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

<?php include __DIR__ . '/includes/footer.php'; ?>
