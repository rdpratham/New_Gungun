<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/ElectionModel.php';
require_once __DIR__ . '/../models/ConstituencyModel.php';
require_once __DIR__ . '/../models/AuditModel.php';

requireRole('ec_admin', 'constituency_admin');

$action = $_GET['action'] ?? 'list';
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name       = trim($_POST['name'] ?? '');
    $electionId = (int) ($_POST['election_id'] ?? 0);
    if (!$name)       $errors[] = 'Constituency name is required.';
    if (!$electionId) $errors[] = 'Election is required.';
    if (empty($errors)) {
        $newId = ConstituencyModel::create($name, $electionId);
        AuditModel::log(currentUserId(), 'CONSTITUENCY_CREATED', "ID:{$newId} {$name}");
        flashSet('success', 'Constituency created.');
        header('Location: ' . BASE_URL . '/admin/constituencies.php'); exit;
    }
}

if ($action === 'delete') {
    $id = (int) ($_GET['id'] ?? 0);
    ConstituencyModel::delete($id);
    AuditModel::log(currentUserId(), 'CONSTITUENCY_DELETED', "ID:{$id}");
    flashSet('success', 'Constituency deleted.');
    header('Location: ' . BASE_URL . '/admin/constituencies.php'); exit;
}

$constituencies = ConstituencyModel::getAll();
$elections      = ElectionModel::getAll();

$pageTitle = 'Constituencies – ' . APP_NAME;
require_once __DIR__ . '/../includes/header.php';
?>

<div class="container-fluid py-2">
  <h3 class="fw-bold mb-4"><i class="bi bi-geo-alt text-primary me-2"></i>Constituencies</h3>

  <div class="row g-4">
    <div class="col-md-4">
      <div class="card border-0 shadow-sm">
        <div class="card-header py-3 fw-semibold">Add Constituency</div>
        <div class="card-body">
          <?php foreach ($errors as $e): ?>
            <div class="alert alert-danger py-2"><?= htmlspecialchars($e) ?></div>
          <?php endforeach; ?>
          <form method="POST">
            <div class="mb-3">
              <label class="form-label fw-semibold">Election *</label>
              <select name="election_id" class="form-select" required>
                <option value="">Select election…</option>
                <?php foreach ($elections as $e): ?>
                  <option value="<?= $e['election_id'] ?>"><?= sanitize($e['title']) ?></option>
                <?php endforeach; ?>
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label fw-semibold">Constituency Name *</label>
              <input type="text" name="name" class="form-control" required
                     value="<?= sanitize($_POST['name'] ?? '') ?>">
            </div>
            <button type="submit" class="btn btn-primary w-100">
              <i class="bi bi-plus-lg me-1"></i>Add Constituency
            </button>
          </form>
        </div>
      </div>
    </div>

    <div class="col-md-8">
      <div class="card border-0 shadow-sm">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead><tr>
              <th>ID</th><th>Name</th><th>Election</th><th>Actions</th>
            </tr></thead>
            <tbody>
              <?php foreach ($constituencies as $c): ?>
              <tr>
                <td class="text-muted small">#<?= $c['constituency_id'] ?></td>
                <td class="fw-semibold"><?= sanitize($c['name']) ?></td>
                <td><?= sanitize($c['election_title']) ?></td>
                <td>
                  <a href="?action=delete&id=<?= $c['constituency_id'] ?>"
                     class="btn btn-sm btn-outline-danger"
                     onclick="return confirm('Delete this constituency?')">
                    <i class="bi bi-trash"></i>
                  </a>
                </td>
              </tr>
              <?php endforeach; ?>
              <?php if (empty($constituencies)): ?>
                <tr><td colspan="4" class="text-center text-muted py-4">No constituencies yet.</td></tr>
              <?php endif; ?>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
