<?php
require_once __DIR__ . '/includes/auth.php';
requireRole('voter');

$info = $_SESSION['last_vote_confirmation'] ?? null;
unset($_SESSION['last_vote_confirmation']);

$pageTitle = 'Vote Confirmed – ' . APP_NAME;
require_once __DIR__ . '/includes/header.php';
?>

<div class="container py-4">
  <div class="row justify-content-center">
    <div class="col-md-6 text-center">
      <div class="card border-0 shadow-sm p-4 p-md-5">
        <div class="success-icon mb-3">
          <i class="bi bi-patch-check-fill"></i>
        </div>
        <h2 class="fw-bold text-success mb-2">Vote Cast Successfully!</h2>
        <p class="text-muted mb-4">
          Thank you for participating in the democratic process.<br>
          Your vote has been securely recorded.
        </p>

        <?php if ($info): ?>
        <div class="card bg-success-subtle border-0 mb-4 text-start p-3 rounded-3">
          <div class="mb-1"><span class="text-muted small">Election</span><br>
            <strong><?= sanitize($info['election_title']) ?></strong></div>
          <div class="mb-1"><span class="text-muted small">Constituency</span><br>
            <strong><?= sanitize($info['constituency_name']) ?></strong></div>
          <div><span class="text-muted small">Voted At</span><br>
            <strong><?= sanitize($info['voted_at']) ?></strong></div>
        </div>
        <?php endif; ?>

        <div class="d-flex gap-2 justify-content-center flex-wrap">
          <a href="<?= BASE_URL ?>/results.php" class="btn btn-primary">
            <i class="bi bi-bar-chart me-1"></i>View Results
          </a>
          <a href="<?= BASE_URL ?>/logout.php" class="btn btn-outline-secondary">
            <i class="bi bi-box-arrow-right me-1"></i>Logout
          </a>
        </div>
      </div>
    </div>
  </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
