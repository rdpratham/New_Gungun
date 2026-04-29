<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/ElectionModel.php';
require_once __DIR__ . '/../models/AuditModel.php';

requireRole('ec_admin', 'constituency_admin');

$action = $_GET['action'] ?? 'list';
$id     = (int) ($_GET['id'] ?? 0);
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $title       = trim($_POST['title'] ?? '');
    $description = trim($_POST['description'] ?? '');
    $start_time  = $_POST['start_time'] ?? '';
    $end_time    = $_POST['end_time']   ?? '';
    $status      = $_POST['status']     ?? 'draft';

    if (!$title)      $errors[] = 'Title is required.';
    if (!$start_time) $errors[] = 'Start time is required.';
    if (!$end_time)   $errors[] = 'End time is required.';
    if ($start_time && $end_time && $start_time >= $end_time)
        $errors[] = 'End time must be after start time.';

    if (empty($errors)) {
        $data = compact('title','description','start_time','end_time','status');
        if ($action === 'add') {
            $data['created_by'] = currentUserId();
            $newId = ElectionModel::create($data);
            AuditModel::log(currentUserId(), 'ELECTION_CREATED', "ID:{$newId} {$title}");
            flashSet('success', 'Election created successfully.');
        } else {
            ElectionModel::update($id, $data);
            AuditModel::log(currentUserId(), 'ELECTION_UPDATED', "ID:{$id} {$title}");
            flashSet('success', 'Election updated successfully.');
        }
        header('Location: ' . BASE_URL . '/admin/elections.php'); exit;
    }
}

// Status toggle
if ($action === 'status' && $id) {
    $new = $_GET['to'] ?? 'draft';
    if (in_array($new, ['draft','active','closed'], true)) {
        ElectionModel::updateStatus($id, $new);
        AuditModel::log(currentUserId(), 'ELECTION_STATUS', "ID:{$id} → {$new}");
        flashSet('success', "Election status updated to: {$new}");
    }
    header('Location: ' . BASE_URL . '/admin/elections.php'); exit;
}

if ($action === 'delete' && $id) {
    ElectionModel::delete($id);
    AuditModel::log(currentUserId(), 'ELECTION_DELETED', "ID:{$id}");
    flashSet('success', 'Election deleted.');
    header('Location: ' . BASE_URL . '/admin/elections.php'); exit;
}

$elections = ElectionModel::getAll();
$editing   = ($action === 'edit' && $id) ? ElectionModel::findById($id) : null;

$pageTitle = 'Elections – ' . APP_NAME;
require_once __DIR__ . '/../includes/header.php';
?>

<div class="container-fluid py-2">
  <div class="d-flex justify-content-between align-items-center mb-4">
    <h3 class="fw-bold mb-0"><i class="bi bi-calendar-event text-primary me-2"></i>Elections</h3>
    <?php if ($action === 'list'): ?>
      <a href="?action=add" class="btn btn-primary"><i class="bi bi-plus-lg me-1"></i>New Election</a>
    <?php else: ?>
      <a href="?" class="btn btn-outline-secondary"><i class="bi bi-arrow-left me-1"></i>Back</a>
    <?php endif; ?>
  </div>

  <?php if ($action !== 'list'): ?>
  <div class="card border-0 shadow-sm mb-4" style="max-width:600px">
    <div class="card-header py-3 fw-semibold">
      <?= $action === 'add' ? 'Create New Election' : 'Edit Election' ?>
    </div>
    <div class="card-body">
      <?php foreach ($errors as $e): ?>
        <div class="alert alert-danger py-2"><?= htmlspecialchars($e) ?></div>
      <?php endforeach; ?>
      <form method="POST">
        <div class="mb-3">
          <label class="form-label fw-semibold">Title *</label>
          <input type="text" name="title" class="form-control" required
                 value="<?= sanitize($_POST['title'] ?? $editing['title'] ?? '') ?>">
        </div>
        <div class="mb-3">
          <label class="form-label fw-semibold">Description</label>
          <textarea name="description" class="form-control" rows="3"><?= sanitize($_POST['description'] ?? $editing['description'] ?? '') ?></textarea>
        </div>
        <div class="row g-2 mb-3">
          <div class="col-md-6">
            <label class="form-label fw-semibold">Start Date &amp; Time *</label>
            <input type="datetime-local" name="start_time" class="form-control" required
                   value="<?= isset($editing['start_time']) ? date('Y-m-d\TH:i', strtotime($editing['start_time'])) : '' ?>">
          </div>
          <div class="col-md-6">
            <label class="form-label fw-semibold">End Date &amp; Time *</label>
            <input type="datetime-local" name="end_time" class="form-control" required
                   value="<?= isset($editing['end_time']) ? date('Y-m-d\TH:i', strtotime($editing['end_time'])) : '' ?>">
          </div>
        </div>
        <div class="mb-4">
          <label class="form-label fw-semibold">Status</label>
          <select name="status" class="form-select">
            <?php foreach (['draft','active','closed'] as $s): ?>
              <option value="<?= $s ?>" <?= ($editing['status'] ?? 'draft') === $s ? 'selected' : '' ?>>
                <?= ucfirst($s) ?>
              </option>
            <?php endforeach; ?>
          </select>
        </div>
        <button type="submit" class="btn btn-primary">
          <i class="bi bi-save me-1"></i><?= $action === 'add' ? 'Create' : 'Update' ?> Election
        </button>
      </form>
    </div>
  </div>
  <?php else: ?>

  <div class="card border-0 shadow-sm">
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead><tr>
          <th>ID</th><th>Title</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          <?php foreach ($elections as $e): ?>
          <tr>
            <td class="text-muted small">#<?= $e['election_id'] ?></td>
            <td class="fw-semibold"><?= sanitize($e['title']) ?></td>
            <td><?= date('d M Y, h:i A', strtotime($e['start_time'])) ?></td>
            <td><?= date('d M Y, h:i A', strtotime($e['end_time'])) ?></td>
            <td>
              <?php $badges = ['draft'=>'secondary','active'=>'success','closed'=>'dark']; ?>
              <span class="badge bg-<?= $badges[$e['status']] ?? 'secondary' ?>"><?= ucfirst($e['status']) ?></span>
            </td>
            <td>
              <div class="btn-group btn-group-sm">
                <a href="?action=edit&id=<?= $e['election_id'] ?>" class="btn btn-outline-secondary">
                  <i class="bi bi-pencil"></i>
                </a>
                <?php if ($e['status'] === 'draft'): ?>
                  <a href="?action=status&id=<?= $e['election_id'] ?>&to=active"
                     class="btn btn-outline-success" title="Activate"
                     onclick="return confirm('Activate this election?')">
                    <i class="bi bi-play-fill"></i>
                  </a>
                <?php elseif ($e['status'] === 'active'): ?>
                  <a href="?action=status&id=<?= $e['election_id'] ?>&to=closed"
                     class="btn btn-outline-danger" title="Close"
                     onclick="return confirm('Close this election?')">
                    <i class="bi bi-stop-fill"></i>
                  </a>
                <?php endif; ?>
                <a href="<?= BASE_URL ?>/results.php?id=<?= $e['election_id'] ?>"
                   class="btn btn-outline-primary" title="Results">
                  <i class="bi bi-bar-chart"></i>
                </a>
                <a href="?action=delete&id=<?= $e['election_id'] ?>"
                   class="btn btn-outline-danger"
                   onclick="return confirm('Delete this election and all its data?')">
                  <i class="bi bi-trash"></i>
                </a>
              </div>
            </td>
          </tr>
          <?php endforeach; ?>
          <?php if (empty($elections)): ?>
            <tr><td colspan="6" class="text-center text-muted py-4">No elections yet.</td></tr>
          <?php endif; ?>
        </tbody>
      </table>
    </div>
  </div>
  <?php endif; ?>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
