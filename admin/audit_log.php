<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/AuditModel.php';

requireRole('ec_admin', 'constituency_admin');

$logs = AuditModel::getAll(500);

$pageTitle = 'Audit Log – ' . APP_NAME;
require_once __DIR__ . '/../includes/header.php';
?>

<div class="container-fluid py-2">
  <div class="d-flex justify-content-between align-items-center mb-4">
    <h3 class="fw-bold mb-0"><i class="bi bi-journal-text text-primary me-2"></i>Audit Log</h3>
    <span class="text-muted small"><?= count($logs) ?> recent entries</span>
  </div>

  <div class="card border-0 shadow-sm">
    <div class="card-body p-0">
      <div class="p-3 border-bottom">
        <input type="search" id="logSearch" class="form-control" placeholder="Filter log entries…">
      </div>
      <div class="table-responsive" style="max-height:75vh; overflow-y:auto">
        <table class="table table-sm table-hover align-middle mb-0" id="logTable">
          <thead class="sticky-top bg-white">
            <tr>
              <th>Timestamp</th><th>User</th><th>Action</th><th>Details</th><th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($logs as $log): ?>
            <tr>
              <td class="font-monospace small text-muted nowrap">
                <?= date('d M Y H:i:s', strtotime($log['created_at'])) ?>
              </td>
              <td>
                <?php if ($log['username']): ?>
                  <strong><?= sanitize($log['username']) ?></strong>
                  <div class="text-muted small"><?= sanitize($log['full_name'] ?? '') ?></div>
                <?php else: ?>
                  <span class="text-muted">System</span>
                <?php endif; ?>
              </td>
              <td>
                <?php
                $actionColors = [
                  'VOTE_CAST'        => 'success',
                  'LOGIN_SUCCESS'    => 'primary',
                  'ADMIN_LOGIN'      => 'info',
                  'LOGOUT'           => 'secondary',
                  'LOGIN_FAILED'     => 'danger',
                  'OTP_FAILED'       => 'warning',
                  'VOTE_FAILED'      => 'danger',
                ];
                $color = $actionColors[$log['action']] ?? 'secondary';
                ?>
                <span class="badge bg-<?= $color ?>-subtle text-<?= $color ?> border border-<?= $color ?>-subtle">
                  <?= sanitize($log['action']) ?>
                </span>
              </td>
              <td class="text-muted small"><?= sanitize($log['details']) ?></td>
              <td class="font-monospace small text-muted"><?= sanitize($log['ip_address']) ?></td>
            </tr>
            <?php endforeach; ?>
            <?php if (empty($logs)): ?>
              <tr><td colspan="5" class="text-center text-muted py-4">No audit entries yet.</td></tr>
            <?php endif; ?>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<script>
document.getElementById('logSearch').addEventListener('input', function() {
  const q = this.value.toLowerCase();
  document.querySelectorAll('#logTable tbody tr').forEach(r => {
    r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
});
</script>

<style>.nowrap { white-space: nowrap; }</style>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
