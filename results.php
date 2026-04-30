<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/ElectionModel.php';
require_once __DIR__ . '/models/CandidateModel.php';
require_once __DIR__ . '/models/VoteModel.php';
require_once __DIR__ . '/services/GeminiService.php';

requireLogin();

$elections = ElectionModel::getAll();
$selId     = (int) ($_GET['id'] ?? 0);
if (!$selId && !empty($elections)) {
    $selId = (int) $elections[0]['election_id'];
}
$election   = $selId ? ElectionModel::findById($selId) : null;
$results    = $selId ? CandidateModel::getResults($selId) : [];
$totalVotes = $selId ? VoteModel::countForElection($selId) : 0;

// Group by constituency
$byConstituency = [];
foreach ($results as $r) {
    $byConstituency[$r['constituency_name']][] = $r;
}

// AI analysis (only for closed elections with votes)
$aiSummary      = null;
$aiError        = null;
$aiQuotaExceeded = false;

$geminiKey = getenv('GEMINI_API_KEY');
if ($geminiKey && $election && $election['status'] === 'closed' && $totalVotes > 0) {
    // Build a compact results snapshot for the prompt
    $lines = [];
    foreach ($byConstituency as $cName => $candidates) {
        $total = array_sum(array_column($candidates, 'vote_count'));
        foreach ($candidates as $c) {
            $pct    = $total > 0 ? round($c['vote_count'] / $total * 100, 1) : 0;
            $lines[] = "- {$c['name']} ({$c['party']}), {$cName}: {$c['vote_count']} votes ({$pct}%)";
        }
    }
    $snapshot = implode("\n", $lines);
    $prompt   = "You are an election analyst. Briefly summarise (3-5 sentences) the key highlights, "
              . "winning trends, and notable observations from these election results:\n\n$snapshot";

    try {
        $gemini    = new GeminiService($geminiKey);
        $aiSummary = $gemini->generate($prompt);
    } catch (GeminiQuotaException $e) {
        $aiQuotaExceeded = true;
        $aiError = 'AI analysis is temporarily unavailable — Gemini API quota exceeded. '
                 . 'Please check your usage at https://ai.dev/rate-limit.';
    } catch (GeminiApiException $e) {
        $aiError = 'AI analysis could not be loaded: ' . htmlspecialchars($e->getMessage());
    }
}

$pageTitle = 'Election Results – ' . APP_NAME;
require_once __DIR__ . '/includes/header.php';
?>

<div class="container py-2">
  <div class="row mb-4">
    <div class="col-md-8">
      <h3 class="fw-bold mb-0"><i class="bi bi-bar-chart me-2 text-primary"></i>Election Results</h3>
    </div>
    <div class="col-md-4">
      <form method="GET" class="d-flex gap-2">
        <select name="id" class="form-select form-select-sm" onchange="this.form.submit()">
          <?php foreach ($elections as $e): ?>
            <option value="<?= (int) $e['election_id'] ?>" <?= $selId === (int) $e['election_id'] ? 'selected' : '' ?>>
              <?= sanitize($e['title']) ?> (<?= $e['status'] ?>)
            </option>
          <?php endforeach; ?>
        </select>
      </form>
    </div>
  </div>

  <?php if (!$election): ?>
    <div class="alert alert-info">No elections found.</div>
  <?php else: ?>
    <div class="row g-3 mb-4">
      <div class="col-6 col-md-3">
        <div class="card kpi-card bg-primary text-white shadow-sm p-3">
          <div class="kpi-icon"><i class="bi bi-people-fill"></i></div>
          <div class="fs-2 fw-bold"><?= $totalVotes ?></div>
          <div class="small opacity-75">Total Votes Cast</div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card kpi-card bg-success text-white shadow-sm p-3">
          <div class="kpi-icon"><i class="bi bi-calendar-check"></i></div>
          <div class="fs-5 fw-bold"><?= ucfirst($election['status']) ?></div>
          <div class="small opacity-75">Election Status</div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card kpi-card bg-info text-white shadow-sm p-3">
          <div class="kpi-icon"><i class="bi bi-geo-alt-fill"></i></div>
          <div class="fs-2 fw-bold"><?= count($byConstituency) ?></div>
          <div class="small opacity-75">Constituencies</div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card kpi-card bg-warning text-dark shadow-sm p-3">
          <div class="kpi-icon"><i class="bi bi-person-badge-fill"></i></div>
          <div class="fs-2 fw-bold"><?= count($results) ?></div>
          <div class="small opacity-75">Candidates</div>
        </div>
      </div>
    </div>

    <?php if ($aiSummary || $aiError): ?>
      <div class="card border-0 shadow-sm mb-4">
        <div class="card-header fw-semibold bg-light py-3">
          <i class="bi bi-robot text-primary me-2"></i>AI Analysis
          <span class="badge bg-primary ms-2 small">Powered by Gemini</span>
        </div>
        <div class="card-body">
          <?php if ($aiSummary): ?>
            <p class="mb-0 text-secondary"><?= nl2br(htmlspecialchars($aiSummary)) ?></p>
          <?php elseif ($aiQuotaExceeded): ?>
            <div class="alert alert-warning mb-0 py-2">
              <i class="bi bi-exclamation-triangle me-2"></i>
              <?= htmlspecialchars($aiError) ?>
            </div>
          <?php else: ?>
            <div class="alert alert-danger mb-0 py-2">
              <i class="bi bi-x-circle me-2"></i>
              <?= htmlspecialchars($aiError) ?>
            </div>
          <?php endif; ?>
        </div>
      </div>
    <?php endif; ?>

    <?php foreach ($byConstituency as $cName => $candidates): ?>
      <?php
        $constTotal  = array_sum(array_column($candidates, 'vote_count'));
        $winner      = $candidates[0]; // Already sorted by vote_count DESC
      ?>
      <div class="card border-0 shadow-sm mb-4">
        <div class="card-header fw-semibold bg-light py-3">
          <i class="bi bi-geo-alt text-primary me-2"></i><?= sanitize($cName) ?>
          <span class="float-end text-muted small"><?= $constTotal ?> votes</span>
        </div>
        <div class="card-body">
          <?php if ($election['status'] === 'closed' && $constTotal > 0): ?>
            <div class="d-flex align-items-center gap-3 mb-4 p-3 bg-warning-subtle rounded-3">
              <div class="candidate-photo-placeholder flex-shrink-0">
                <i class="bi bi-trophy-fill text-warning"></i>
              </div>
              <div>
                <span class="winner-badge mb-1"><i class="bi bi-trophy me-1"></i>Winner</span>
                <div class="fs-5 fw-bold"><?= sanitize($winner['name']) ?></div>
                <div class="text-muted small"><?= sanitize($winner['party'] ?: 'Independent') ?></div>
              </div>
              <div class="ms-auto text-end">
                <div class="fs-4 fw-bold text-success"><?= $winner['vote_count'] ?></div>
                <div class="text-muted small">votes</div>
              </div>
            </div>
          <?php endif; ?>

          <div class="table-responsive">
            <table class="table align-middle">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Candidate</th>
                  <th>Party</th>
                  <th class="text-end">Votes</th>
                  <th style="min-width:180px">Share</th>
                </tr>
              </thead>
              <tbody>
                <?php foreach ($candidates as $i => $c): ?>
                  <?php $pct = $constTotal > 0 ? round($c['vote_count'] / $constTotal * 100, 1) : 0; ?>
                  <tr>
                    <td><?= $i + 1 ?></td>
                    <td>
                      <strong><?= sanitize($c['name']) ?></strong>
                      <?php if ($i === 0 && $election['status'] === 'closed' && $constTotal > 0): ?>
                        <span class="winner-badge ms-2"><i class="bi bi-trophy"></i></span>
                      <?php endif; ?>
                    </td>
                    <td class="text-muted"><?= sanitize($c['party'] ?: 'Independent') ?></td>
                    <td class="text-end fw-bold"><?= $c['vote_count'] ?></td>
                    <td>
                      <div class="d-flex align-items-center gap-2">
                        <div class="result-bar-wrap flex-grow-1">
                          <div class="result-bar" data-width="<?= $pct ?>" style="width:<?= $pct ?>%">
                            <?= $pct ?>%
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    <?php endforeach; ?>

    <?php if (empty($byConstituency)): ?>
      <div class="alert alert-info">No candidates or votes found for this election.</div>
    <?php endif; ?>
  <?php endif; ?>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
