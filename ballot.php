<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/VoterModel.php';
require_once __DIR__ . '/models/ElectionModel.php';
require_once __DIR__ . '/models/CandidateModel.php';
require_once __DIR__ . '/models/VoteModel.php';
require_once __DIR__ . '/models/AuditModel.php';

requireRole('voter');

$userId = currentUserId();
$voter  = VoterModel::findByUserId($userId);

if (!$voter) {
    flashSet('error', 'Your voter profile was not found. Please contact the administrator.');
    header('Location: ' . BASE_URL . '/login.php'); exit;
}

$election   = ElectionModel::getActiveForConstituency((int) $voter['constituency_id']);
$alreadyVoted = false;
$candidates   = [];

if ($election) {
    $alreadyVoted = VoterModel::hasVotedInElection((int) $voter['voter_id'], (int) $election['election_id']);
    if (!$alreadyVoted) {
        $candidates = CandidateModel::getByConstituencyAndElection(
            (int) $voter['constituency_id'],
            (int) $election['election_id']
        );
    }
}

$pageTitle = 'Cast Your Vote – ' . APP_NAME;
require_once __DIR__ . '/includes/header.php';
?>

<div class="container py-2">
  <div class="row justify-content-center">
    <div class="col-lg-8">

      <?php if (!$election): ?>
        <div class="card border-0 shadow-sm text-center py-5">
          <div class="card-body">
            <i class="bi bi-calendar-x text-muted" style="font-size:4rem"></i>
            <h4 class="mt-3">No Active Election</h4>
            <p class="text-muted">There is no active election for your constituency (<strong><?= sanitize($voter['constituency_name']) ?></strong>) at this time.</p>
            <a href="<?= BASE_URL ?>/results.php" class="btn btn-outline-primary">View Past Results</a>
          </div>
        </div>

      <?php elseif ($alreadyVoted): ?>
        <div class="card border-0 shadow-sm text-center py-5">
          <div class="card-body">
            <i class="bi bi-patch-check-fill text-success" style="font-size:4rem"></i>
            <h4 class="mt-3 text-success">You have already voted!</h4>
            <p class="text-muted">Thank you for participating in <strong><?= sanitize($election['title']) ?></strong>.</p>
            <a href="<?= BASE_URL ?>/results.php?id=<?= $election['election_id'] ?>" class="btn btn-primary">View Results</a>
          </div>
        </div>

      <?php elseif (empty($candidates)): ?>
        <div class="alert alert-warning">No candidates found for your constituency. Please contact the administrator.</div>

      <?php else: ?>
        <div class="card border-0 shadow-sm mb-4">
          <div class="card-header bg-primary text-white py-3">
            <h5 class="mb-0"><i class="bi bi-card-checklist me-2"></i><?= sanitize($election['title']) ?></h5>
            <small>Constituency: <?= sanitize($voter['constituency_name']) ?></small>
          </div>
          <div class="card-body">
            <p class="text-muted mb-4">
              <i class="bi bi-info-circle me-1"></i>
              Select <strong>one candidate</strong> below and click <em>Cast My Vote</em>. This action is irreversible.
            </p>

            <form id="cast-vote-form" method="POST" action="<?= BASE_URL ?>/submit_vote.php">
              <input type="hidden" name="election_id" value="<?= (int) $election['election_id'] ?>">
              <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION['csrf_token'] ??= bin2hex(random_bytes(16))) ?>">

              <div class="row g-3 mb-4">
                <?php foreach ($candidates as $c): ?>
                <div class="col-md-6">
                  <div class="candidate-card card h-100 p-3" data-candidate-id="<?= (int) $c['candidate_id'] ?>">
                    <input type="radio" name="candidate_id"
                           value="<?= (int) $c['candidate_id'] ?>"
                           class="d-none" required>
                    <div class="d-flex align-items-center gap-3">
                      <?php if (!empty($c['photo']) && file_exists(UPLOAD_DIR . $c['photo'])): ?>
                        <img src="<?= UPLOAD_URL . htmlspecialchars($c['photo']) ?>"
                             class="candidate-photo" alt="<?= sanitize($c['name']) ?>">
                      <?php else: ?>
                        <div class="candidate-photo-placeholder"><i class="bi bi-person-fill"></i></div>
                      <?php endif; ?>
                      <div>
                        <div class="fw-bold candidate-name"><?= sanitize($c['name']) ?></div>
                        <div class="text-muted small">
                          <i class="bi bi-flag me-1"></i><?= sanitize($c['party'] ?: 'Independent') ?>
                        </div>
                        <?php if (!empty($c['bio'])): ?>
                          <div class="text-muted small mt-1"><?= sanitize($c['bio']) ?></div>
                        <?php endif; ?>
                      </div>
                    </div>
                    <div class="mt-2 text-end">
                      <span class="badge bg-primary-subtle text-primary">
                        <i class="bi bi-check-circle me-1"></i>Select
                      </span>
                    </div>
                  </div>
                </div>
                <?php endforeach; ?>
              </div>

              <div class="d-grid">
                <button type="submit" id="cast-vote-btn" class="btn btn-success btn-lg fw-semibold" disabled>
                  <i class="bi bi-check2-square me-2"></i>Cast My Vote
                </button>
              </div>
            </form>
          </div>
          <div class="card-footer text-muted small">
            Election closes: <?= date('d M Y, h:i A', strtotime($election['end_time'])) ?>
          </div>
        </div>
      <?php endif; ?>

    </div>
  </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
