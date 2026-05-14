<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/LeaveModel.php';

requireAdmin();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $leaveId = (int)($_POST['leave_id'] ?? 0);
    $action  = $_POST['action'] ?? '';
    $note    = trim($_POST['reviewer_note'] ?? '');

    if ($leaveId && in_array($action, ['approved', 'rejected'])) {
        $reviewerId = (int)currentEmployee()['employee_id'];
        $ok = LeaveModel::review($leaveId, $reviewerId, $action, $note);
        if ($ok && $action === 'approved') {
            LeaveModel::markAttendance($leaveId);
        }
        flashSet($ok ? 'success' : 'warning',
                 $ok ? 'Leave request ' . $action . '.' : 'Could not update – already reviewed?');
    }
    header('Location: /admin/leaves.php');
    exit;
}

$filterStatus = $_GET['status'] ?? 'pending';
$leaves       = LeaveModel::getAll($filterStatus ?: null);

$pageTitle = 'Leave Management';
include __DIR__ . '/../includes/header.php';
?>

<div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
  <h5 class="fw-bold mb-0"><i class="bi bi-calendar-x me-2 text-primary"></i>Leave Management</h5>
  <div class="btn-group btn-group-sm" role="group">
    <?php foreach (['pending','approved','rejected',''] as $s):
      $lbl = $s ? ucfirst($s) : 'All'; ?>
    <a href="?status=<?= urlencode($s) ?>"
       class="btn btn-<?= $filterStatus === $s ? 'primary' : 'outline-primary' ?>">
      <?= $lbl ?>
      <?php if ($s === 'pending'): ?>
        <span class="badge bg-<?= $filterStatus === 'pending' ? 'light text-primary' : 'danger' ?> ms-1">
          <?= LeaveModel::pendingCount() ?>
        </span>
      <?php endif; ?>
    </a>
    <?php endforeach; ?>
  </div>
</div>

<div class="card shadow-sm">
  <div class="card-body p-0">
    <?php if (empty($leaves)): ?>
      <p class="text-center text-muted py-5 mb-0">No leave requests found.</p>
    <?php else: ?>
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead class="table-light">
          <tr>
            <th>Employee</th><th>Type</th><th>From</th><th>To</th>
            <th>Days</th><th>Reason</th><th>Applied</th><th>Status</th>
            <?php if ($filterStatus === 'pending'): ?><th class="text-center">Actions</th><?php endif; ?>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($leaves as $lv): ?>
          <tr>
            <td>
              <div class="fw-semibold"><?= h($lv['full_name']) ?></div>
              <div class="small text-muted"><?= h($lv['employee_code']) ?> · <?= h($lv['department']) ?></div>
            </td>
            <td><?= ucfirst($lv['leave_type']) ?></td>
            <td><?= h($lv['start_date']) ?></td>
            <td><?= h($lv['end_date'])   ?></td>
            <td><?= $lv['days_count'] ?></td>
            <td class="small text-muted" style="max-width:200px;">
              <?= h(mb_strimwidth($lv['reason'], 0, 60, '…')) ?>
            </td>
            <td class="small"><?= h(date('d M', strtotime($lv['created_at']))) ?></td>
            <td>
              <span class="badge bg-<?= $lv['status'] === 'approved' ? 'success' : ($lv['status'] === 'rejected' ? 'danger' : 'warning') ?>">
                <?= ucfirst($lv['status']) ?>
              </span>
            </td>
            <?php if ($filterStatus === 'pending'): ?>
            <td class="text-center">
              <button class="btn btn-sm btn-success me-1"
                      data-bs-toggle="modal"
                      data-bs-target="#reviewModal"
                      data-id="<?= $lv['leave_id'] ?>"
                      data-action="approved"
                      data-name="<?= h($lv['full_name']) ?>">
                <i class="bi bi-check-lg"></i> Approve
              </button>
              <button class="btn btn-sm btn-outline-danger"
                      data-bs-toggle="modal"
                      data-bs-target="#reviewModal"
                      data-id="<?= $lv['leave_id'] ?>"
                      data-action="rejected"
                      data-name="<?= h($lv['full_name']) ?>">
                <i class="bi bi-x-lg"></i> Reject
              </button>
            </td>
            <?php endif; ?>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
    <?php endif; ?>
  </div>
</div>

<!-- Review Modal -->
<div class="modal fade" id="reviewModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <form method="POST" action="">
        <input type="hidden" name="leave_id"  id="mLeaveId">
        <input type="hidden" name="action"    id="mAction">
        <div class="modal-header">
          <h5 class="modal-title fw-bold" id="mTitle">Review Leave</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <p class="mb-3" id="mDesc"></p>
          <label class="form-label fw-semibold">Note (optional)</label>
          <textarea name="reviewer_note" class="form-control" rows="2"
                    placeholder="Add a note for the employee…"></textarea>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="submit" class="btn fw-semibold" id="mBtn">Confirm</button>
        </div>
      </form>
    </div>
  </div>
</div>

<script>
document.getElementById('reviewModal').addEventListener('show.bs.modal', e => {
  const btn    = e.relatedTarget;
  const id     = btn.dataset.id;
  const action = btn.dataset.action;
  const name   = btn.dataset.name;
  document.getElementById('mLeaveId').value = id;
  document.getElementById('mAction').value  = action;
  document.getElementById('mTitle').textContent = (action === 'approved' ? 'Approve' : 'Reject') + ' Leave';
  document.getElementById('mDesc').textContent  = `${action === 'approved' ? 'Approve' : 'Reject'} leave request for ${name}?`;
  const mbtn = document.getElementById('mBtn');
  mbtn.textContent = action === 'approved' ? 'Approve' : 'Reject';
  mbtn.className   = 'btn fw-semibold ' + (action === 'approved' ? 'btn-success' : 'btn-danger');
});
</script>

<?php include __DIR__ . '/../includes/footer.php'; ?>
