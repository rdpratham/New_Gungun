<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/UserModel.php';
require_once __DIR__ . '/../models/VoterModel.php';
require_once __DIR__ . '/../models/ConstituencyModel.php';
require_once __DIR__ . '/../models/AuditModel.php';

requireRole('ec_admin', 'constituency_admin');

$action = $_GET['action'] ?? 'list';
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'add') {
    $full_name      = trim($_POST['full_name']      ?? '');
    $username       = trim($_POST['username']        ?? '');
    $email          = trim($_POST['email']           ?? '');
    $mobile         = trim($_POST['mobile']          ?? '');
    $password       = $_POST['password']             ?? '';
    $voter_card_no  = trim($_POST['voter_card_no']   ?? '');
    $constituency_id= (int) ($_POST['constituency_id'] ?? 0);

    if (!$full_name)        $errors[] = 'Full name is required.';
    if (!$username)         $errors[] = 'Username is required.';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Valid email required.';
    if (strlen($mobile) < 10) $errors[] = 'Valid mobile number required.';
    if (strlen($password) < 6) $errors[] = 'Password must be at least 6 characters.';
    if (!$voter_card_no)    $errors[] = 'Voter card number is required.';
    if (!$constituency_id)  $errors[] = 'Constituency is required.';
    if (UserModel::findByUsername($username)) $errors[] = 'Username already exists.';
    if (UserModel::findByEmail($email))       $errors[] = 'Email already registered.';

    if (empty($errors)) {
        $uid = UserModel::create(compact('username','password','full_name','email','mobile') + ['role'=>'voter']);
        VoterModel::create($uid, $voter_card_no, $constituency_id);
        AuditModel::log(currentUserId(), 'VOTER_CREATED', "UID:{$uid} {$full_name}");
        flashSet('success', "Voter '{$full_name}' registered successfully.");
        header('Location: ' . BASE_URL . '/admin/voters.php'); exit;
    }
}

if ($action === 'toggle' && ($id = (int) ($_GET['id'] ?? 0))) {
    $user = UserModel::findById($id);
    if ($user) {
        UserModel::update($id, ['is_active' => $user['is_active'] ? 0 : 1]);
        AuditModel::log(currentUserId(), 'VOTER_TOGGLE', "UID:{$id}");
        flashSet('success', 'Voter status updated.');
    }
    header('Location: ' . BASE_URL . '/admin/voters.php'); exit;
}

if ($action === 'delete' && ($id = (int) ($_GET['id'] ?? 0))) {
    UserModel::delete($id);
    AuditModel::log(currentUserId(), 'VOTER_DELETED', "UID:{$id}");
    flashSet('success', 'Voter deleted.');
    header('Location: ' . BASE_URL . '/admin/voters.php'); exit;
}

$voters         = VoterModel::getAll();
$constituencies = ConstituencyModel::getAll();

$pageTitle = 'Voters – ' . APP_NAME;
require_once __DIR__ . '/../includes/header.php';
?>

<div class="container-fluid py-2">
  <div class="d-flex justify-content-between align-items-center mb-4">
    <h3 class="fw-bold mb-0"><i class="bi bi-people text-primary me-2"></i>Voters</h3>
    <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#addVoterModal">
      <i class="bi bi-plus-lg me-1"></i>Register Voter
    </button>
  </div>

  <div class="card border-0 shadow-sm">
    <div class="card-body p-0">
      <div class="p-3 border-bottom">
        <input type="search" id="voterSearch" class="form-control" placeholder="Search voters…">
      </div>
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0" id="voterTable">
          <thead><tr>
            <th>Voter Card</th><th>Name</th><th>Email</th><th>Mobile</th>
            <th>Constituency</th><th>Voted</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
            <?php foreach ($voters as $v): ?>
            <tr>
              <td class="font-monospace small"><?= sanitize($v['voter_card_no']) ?></td>
              <td class="fw-semibold"><?= sanitize($v['full_name']) ?></td>
              <td class="text-muted small"><?= sanitize($v['email']) ?></td>
              <td class="text-muted small"><?= sanitize($v['mobile']) ?></td>
              <td><?= sanitize($v['constituency_name']) ?></td>
              <td>
                <?php if ($v['has_voted']): ?>
                  <span class="badge bg-success"><i class="bi bi-check-lg"></i> Yes</span>
                <?php else: ?>
                  <span class="badge bg-secondary">No</span>
                <?php endif; ?>
              </td>
              <td>
                <?= $v['is_active']
                  ? '<span class="badge bg-success">Active</span>'
                  : '<span class="badge bg-danger">Inactive</span>' ?>
              </td>
              <td>
                <div class="btn-group btn-group-sm">
                  <a href="?action=toggle&id=<?= $v['user_id'] ?>"
                     class="btn btn-outline-warning" title="Toggle Status">
                    <i class="bi bi-toggle-on"></i>
                  </a>
                  <a href="?action=delete&id=<?= $v['user_id'] ?>"
                     class="btn btn-outline-danger"
                     onclick="return confirm('Delete this voter?')">
                    <i class="bi bi-trash"></i>
                  </a>
                </div>
              </td>
            </tr>
            <?php endforeach; ?>
            <?php if (empty($voters)): ?>
              <tr><td colspan="8" class="text-center text-muted py-4">No voters registered yet.</td></tr>
            <?php endif; ?>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- Add Voter Modal -->
<div class="modal fade" id="addVoterModal" tabindex="-1">
  <div class="modal-dialog modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title fw-bold"><i class="bi bi-person-plus me-2"></i>Register New Voter</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <form method="POST" action="?action=add">
        <div class="modal-body">
          <?php foreach ($errors as $e): ?>
            <div class="alert alert-danger py-2"><?= htmlspecialchars($e) ?></div>
          <?php endforeach; ?>
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label fw-semibold">Full Name *</label>
              <input type="text" name="full_name" class="form-control" required
                     value="<?= sanitize($_POST['full_name'] ?? '') ?>">
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Username *</label>
              <input type="text" name="username" class="form-control" required
                     value="<?= sanitize($_POST['username'] ?? '') ?>">
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Email *</label>
              <input type="email" name="email" class="form-control" required
                     value="<?= sanitize($_POST['email'] ?? '') ?>">
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Mobile *</label>
              <input type="tel" name="mobile" class="form-control" required
                     value="<?= sanitize($_POST['mobile'] ?? '') ?>">
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Voter Card No. *</label>
              <input type="text" name="voter_card_no" class="form-control" required
                     value="<?= sanitize($_POST['voter_card_no'] ?? '') ?>">
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Constituency *</label>
              <select name="constituency_id" class="form-select" required>
                <option value="">Select constituency…</option>
                <?php foreach ($constituencies as $c): ?>
                  <option value="<?= $c['constituency_id'] ?>"
                          <?= ((int)($_POST['constituency_id']??0) === (int)$c['constituency_id']) ? 'selected' : '' ?>>
                    <?= sanitize($c['name']) ?> (<?= sanitize($c['election_title']) ?>)
                  </option>
                <?php endforeach; ?>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Password *</label>
              <input type="password" name="password" class="form-control" required minlength="6">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="submit" class="btn btn-primary">
            <i class="bi bi-person-check me-1"></i>Register Voter
          </button>
        </div>
      </form>
    </div>
  </div>
</div>

<script>
document.getElementById('voterSearch').addEventListener('input', function() {
  const q = this.value.toLowerCase();
  document.querySelectorAll('#voterTable tbody tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
});
// Re-open modal on errors
<?php if (!empty($errors)): ?>
document.addEventListener('DOMContentLoaded', () => {
  new bootstrap.Modal(document.getElementById('addVoterModal')).show();
});
<?php endif; ?>
</script>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
