<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/CandidateModel.php';
require_once __DIR__ . '/../models/ElectionModel.php';
require_once __DIR__ . '/../models/ConstituencyModel.php';
require_once __DIR__ . '/../models/AuditModel.php';

requireRole('ec_admin', 'constituency_admin');

$action = $_GET['action'] ?? 'list';
$errors = [];

function handlePhotoUpload(): ?string {
    if (empty($_FILES['photo']['tmp_name'])) return null;
    $allowed = ['image/jpeg','image/png','image/gif','image/webp'];
    if (!in_array($_FILES['photo']['type'], $allowed, true)) return null;
    if ($_FILES['photo']['size'] > MAX_FILE_SIZE) return null;
    $ext  = pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION);
    $name = uniqid('cand_', true) . '.' . strtolower($ext);
    if (move_uploaded_file($_FILES['photo']['tmp_name'], UPLOAD_DIR . $name)) return $name;
    return null;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name            = trim($_POST['name']            ?? '');
    $party           = trim($_POST['party']           ?? '');
    $bio             = trim($_POST['bio']             ?? '');
    $constituency_id = (int) ($_POST['constituency_id'] ?? 0);
    $election_id     = (int) ($_POST['election_id']     ?? 0);

    if (!$name)            $errors[] = 'Candidate name is required.';
    if (!$constituency_id) $errors[] = 'Constituency is required.';
    if (!$election_id)     $errors[] = 'Election is required.';

    if (empty($errors)) {
        $photo = handlePhotoUpload();
        $data  = compact('name','party','bio','constituency_id','election_id','photo');
        if ($action === 'add') {
            $newId = CandidateModel::create($data);
            AuditModel::log(currentUserId(), 'CANDIDATE_CREATED', "ID:{$newId} {$name}");
            flashSet('success', "Candidate '{$name}' added successfully.");
        } else {
            $id = (int) ($_GET['id'] ?? 0);
            CandidateModel::update($id, $data);
            AuditModel::log(currentUserId(), 'CANDIDATE_UPDATED', "ID:{$id} {$name}");
            flashSet('success', "Candidate updated.");
        }
        header('Location: ' . BASE_URL . '/admin/candidates.php'); exit;
    }
}

if ($action === 'delete' && ($id = (int) ($_GET['id'] ?? 0))) {
    $c = CandidateModel::findById($id);
    if ($c && !empty($c['photo']) && file_exists(UPLOAD_DIR . $c['photo'])) {
        unlink(UPLOAD_DIR . $c['photo']);
    }
    CandidateModel::delete($id);
    AuditModel::log(currentUserId(), 'CANDIDATE_DELETED', "ID:{$id}");
    flashSet('success', 'Candidate deleted.');
    header('Location: ' . BASE_URL . '/admin/candidates.php'); exit;
}

$elections      = ElectionModel::getAll();
$constituencies = ConstituencyModel::getAll();
$filterElection = (int) ($_GET['election_id'] ?? ($elections[0]['election_id'] ?? 0));
$candidates     = $filterElection ? CandidateModel::getByElection($filterElection) : [];
$editingCandidate = ($action === 'edit') ? CandidateModel::findById((int)($_GET['id']??0)) : null;

$pageTitle = 'Candidates – ' . APP_NAME;
require_once __DIR__ . '/../includes/header.php';
?>

<div class="container-fluid py-2">
  <div class="d-flex justify-content-between align-items-center mb-4">
    <h3 class="fw-bold mb-0"><i class="bi bi-person-badge text-primary me-2"></i>Candidates</h3>
    <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#addCandidateModal">
      <i class="bi bi-plus-lg me-1"></i>Add Candidate
    </button>
  </div>

  <!-- Filter by election -->
  <form method="GET" class="d-flex gap-2 mb-4" style="max-width:350px">
    <select name="election_id" class="form-select" onchange="this.form.submit()">
      <?php foreach ($elections as $e): ?>
        <option value="<?= $e['election_id'] ?>" <?= $filterElection === (int)$e['election_id'] ? 'selected':'' ?>>
          <?= sanitize($e['title']) ?>
        </option>
      <?php endforeach; ?>
    </select>
  </form>

  <div class="row g-3">
    <?php foreach ($candidates as $c): ?>
    <div class="col-md-4 col-xl-3">
      <div class="card border-0 shadow-sm h-100">
        <div class="card-body text-center pt-4">
          <?php if (!empty($c['photo']) && file_exists(UPLOAD_DIR . $c['photo'])): ?>
            <img src="<?= UPLOAD_URL . htmlspecialchars($c['photo']) ?>"
                 class="candidate-photo mb-3" alt="<?= sanitize($c['name']) ?>">
          <?php else: ?>
            <div class="candidate-photo-placeholder mx-auto mb-3">
              <i class="bi bi-person-fill"></i>
            </div>
          <?php endif; ?>
          <h6 class="fw-bold mb-1"><?= sanitize($c['name']) ?></h6>
          <div class="text-muted small mb-1"><i class="bi bi-flag me-1"></i><?= sanitize($c['party'] ?: 'Independent') ?></div>
          <div class="badge bg-info-subtle text-info mb-3"><?= sanitize($c['constituency_name']) ?></div>
          <?php if (!empty($c['bio'])): ?>
            <p class="text-muted small"><?= sanitize($c['bio']) ?></p>
          <?php endif; ?>
        </div>
        <div class="card-footer border-0 d-flex gap-2 pb-3 justify-content-center">
          <a href="?action=delete&id=<?= $c['candidate_id'] ?>&election_id=<?= $filterElection ?>"
             class="btn btn-sm btn-outline-danger"
             onclick="return confirm('Delete this candidate?')">
            <i class="bi bi-trash me-1"></i>Delete
          </a>
        </div>
      </div>
    </div>
    <?php endforeach; ?>
    <?php if (empty($candidates)): ?>
      <div class="col-12">
        <div class="text-center text-muted py-5">
          <i class="bi bi-person-x" style="font-size:3rem"></i>
          <p class="mt-2">No candidates found. Add the first one!</p>
        </div>
      </div>
    <?php endif; ?>
  </div>
</div>

<!-- Add Candidate Modal -->
<div class="modal fade" id="addCandidateModal" tabindex="-1">
  <div class="modal-dialog modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title fw-bold">
          <i class="bi bi-person-plus me-2"></i>
          <?= $action === 'edit' ? 'Edit' : 'Add' ?> Candidate
        </h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <form method="POST" action="?action=<?= $action ?><?= $editingCandidate ? '&id='.$editingCandidate['candidate_id'] : '' ?>&election_id=<?= $filterElection ?>"
            enctype="multipart/form-data">
        <div class="modal-body">
          <?php foreach ($errors as $e): ?>
            <div class="alert alert-danger py-2"><?= htmlspecialchars($e) ?></div>
          <?php endforeach; ?>
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label fw-semibold">Full Name *</label>
              <input type="text" name="name" class="form-control" required
                     value="<?= sanitize($_POST['name'] ?? $editingCandidate['name'] ?? '') ?>">
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Party / Alliance</label>
              <input type="text" name="party" class="form-control"
                     value="<?= sanitize($_POST['party'] ?? $editingCandidate['party'] ?? '') ?>">
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Election *</label>
              <select name="election_id" class="form-select" required id="electionSelect">
                <option value="">Select election…</option>
                <?php foreach ($elections as $e): ?>
                  <option value="<?= $e['election_id'] ?>"
                          <?= ((int)($_POST['election_id']??$filterElection) === (int)$e['election_id']) ? 'selected' : '' ?>>
                    <?= sanitize($e['title']) ?>
                  </option>
                <?php endforeach; ?>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Constituency *</label>
              <select name="constituency_id" class="form-select" required>
                <option value="">Select constituency…</option>
                <?php foreach ($constituencies as $c): ?>
                  <option value="<?= $c['constituency_id'] ?>"
                          <?= ((int)($_POST['constituency_id']??$editingCandidate['constituency_id']??0) === (int)$c['constituency_id']) ? 'selected' : '' ?>>
                    <?= sanitize($c['name']) ?> (<?= sanitize($c['election_title']) ?>)
                  </option>
                <?php endforeach; ?>
              </select>
            </div>
            <div class="col-12">
              <label class="form-label fw-semibold">Bio / Description</label>
              <textarea name="bio" class="form-control" rows="2"><?= sanitize($_POST['bio'] ?? $editingCandidate['bio'] ?? '') ?></textarea>
            </div>
            <div class="col-12">
              <label class="form-label fw-semibold">Photo (optional)</label>
              <input type="file" name="photo" class="form-control" accept="image/*">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="submit" class="btn btn-primary">
            <i class="bi bi-save me-1"></i><?= $action === 'edit' ? 'Update' : 'Add' ?> Candidate
          </button>
        </div>
      </form>
    </div>
  </div>
</div>

<script>
<?php if (!empty($errors)): ?>
document.addEventListener('DOMContentLoaded', () => {
  new bootstrap.Modal(document.getElementById('addCandidateModal')).show();
});
<?php endif; ?>
</script>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
