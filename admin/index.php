<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/ElectionModel.php';
require_once __DIR__ . '/../models/VoterModel.php';
require_once __DIR__ . '/../models/VoteModel.php';
require_once __DIR__ . '/../models/CandidateModel.php';

requireRole('ec_admin', 'constituency_admin');

$elections = ElectionModel::getAll();
$activeElection = null;
foreach ($elections as $e) {
    if ($e['status'] === 'active') { $activeElection = $e; break; }
}

$stats = ['total_voters' => 0, 'total_votes' => 0, 'turnout' => 0];
if ($activeElection) {
    $raw = ElectionModel::getStats((int) $activeElection['election_id']);
    $stats['total_voters'] = (int) $raw['total_voters'];
    $stats['total_votes']  = (int) $raw['total_votes'];
    $stats['turnout']      = $stats['total_voters'] > 0
        ? round($stats['total_votes'] / $stats['total_voters'] * 100, 1) : 0;
}

$allVoters     = VoterModel::getAll();
$allElections  = $elections;

$pageTitle = 'Admin Dashboard – ' . APP_NAME;
require_once __DIR__ . '/../includes/header.php';
?>

<div class="container-fluid py-2">
  <h3 class="fw-bold mb-4"><i class="bi bi-speedometer2 text-primary me-2"></i>Admin Dashboard</h3>

  <?php if ($activeElection): ?>
  <div class="alert alert-success d-flex align-items-center gap-3 mb-4">
    <i class="bi bi-broadcast fs-4"></i>
    <div>
      <strong><?= sanitize($activeElection['title']) ?></strong> is currently LIVE.<br>
      <small>Closes: <?= date('d M Y, h:i A', strtotime($activeElection['end_time'])) ?></small>
    </div>
    <a href="<?= BASE_URL ?>/results.php?id=<?= $activeElection['election_id'] ?>"
       class="btn btn-sm btn-success ms-auto">Live Results</a>
  </div>
  <?php endif; ?>

  <!-- KPI Cards -->
  <div class="row g-3 mb-4">
    <div class="col-6 col-xl-3">
      <div class="card kpi-card shadow-sm bg-primary text-white p-3">
        <div class="kpi-icon"><i class="bi bi-people-fill"></i></div>
        <div class="fs-1 fw-bold"><?= $stats['total_voters'] ?></div>
        <div class="opacity-75">Registered Voters</div>
      </div>
    </div>
    <div class="col-6 col-xl-3">
      <div class="card kpi-card shadow-sm bg-success text-white p-3">
        <div class="kpi-icon"><i class="bi bi-check2-square"></i></div>
        <div class="fs-1 fw-bold"><?= $stats['total_votes'] ?></div>
        <div class="opacity-75">Votes Cast</div>
      </div>
    </div>
    <div class="col-6 col-xl-3">
      <div class="card kpi-card shadow-sm bg-warning text-dark p-3">
        <div class="kpi-icon"><i class="bi bi-percent"></i></div>
        <div class="fs-1 fw-bold"><?= $stats['turnout'] ?>%</div>
        <div class="opacity-75">Voter Turnout</div>
      </div>
    </div>
    <div class="col-6 col-xl-3">
      <div class="card kpi-card shadow-sm bg-info text-white p-3">
        <div class="kpi-icon"><i class="bi bi-calendar-event-fill"></i></div>
        <div class="fs-1 fw-bold"><?= count($allElections) ?></div>
        <div class="opacity-75">Total Elections</div>
      </div>
    </div>
  </div>

  <!-- Elections Table -->
  <div class="card border-0 shadow-sm mb-4">
    <div class="card-header d-flex justify-content-between align-items-center py-3">
      <h6 class="mb-0 fw-semibold"><i class="bi bi-calendar-event me-2 text-primary"></i>Elections</h6>
      <a href="<?= BASE_URL ?>/admin/elections.php?action=add" class="btn btn-sm btn-primary">
        <i class="bi bi-plus-lg me-1"></i>New Election
      </a>
    </div>
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead><tr>
          <th>Title</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          <?php foreach ($allElections as $e): ?>
          <tr>
            <td class="fw-semibold"><?= sanitize($e['title']) ?></td>
            <td><?= date('d M Y', strtotime($e['start_time'])) ?></td>
            <td><?= date('d M Y', strtotime($e['end_time'])) ?></td>
            <td>
              <?php
              $badges = ['draft'=>'secondary','active'=>'success','closed'=>'dark'];
              $b = $badges[$e['status']] ?? 'secondary';
              ?>
              <span class="badge bg-<?= $b ?>"><?= ucfirst($e['status']) ?></span>
            </td>
            <td>
              <a href="<?= BASE_URL ?>/results.php?id=<?= $e['election_id'] ?>"
                 class="btn btn-sm btn-outline-primary"><i class="bi bi-bar-chart"></i></a>
              <a href="<?= BASE_URL ?>/admin/elections.php?action=edit&id=<?= $e['election_id'] ?>"
                 class="btn btn-sm btn-outline-secondary"><i class="bi bi-pencil"></i></a>
            </td>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Quick links -->
  <div class="row g-3">
    <?php
    $links = [
      ['href'=>BASE_URL.'/admin/voters.php',        'icon'=>'people-fill',       'label'=>'Manage Voters',        'color'=>'primary'],
      ['href'=>BASE_URL.'/admin/candidates.php',    'icon'=>'person-badge-fill', 'label'=>'Manage Candidates',    'color'=>'success'],
      ['href'=>BASE_URL.'/admin/constituencies.php','icon'=>'geo-alt-fill',      'label'=>'Constituencies',       'color'=>'info'],
      ['href'=>BASE_URL.'/admin/audit_log.php',     'icon'=>'journal-text',      'label'=>'Audit Log',            'color'=>'warning'],
    ];
    foreach ($links as $l): ?>
    <div class="col-6 col-md-3">
      <a href="<?= $l['href'] ?>" class="card border-0 shadow-sm text-decoration-none text-dark text-center p-4 kpi-card">
        <i class="bi bi-<?= $l['icon'] ?> text-<?= $l['color'] ?>" style="font-size:2.5rem"></i>
        <div class="mt-2 fw-semibold small"><?= $l['label'] ?></div>
      </a>
    </div>
    <?php endforeach; ?>
  </div>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
