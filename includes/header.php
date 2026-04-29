<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= htmlspecialchars($pageTitle ?? APP_NAME) ?></title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="stylesheet" href="<?= BASE_URL ?>/assets/css/style.css">
</head>
<body>

<nav class="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm">
  <div class="container-fluid">
    <a class="navbar-brand fw-bold" href="<?= BASE_URL ?>/">
      <i class="bi bi-shield-check me-2"></i><?= APP_NAME ?>
    </a>
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMenu">
      <span class="navbar-toggler-icon"></span>
    </button>
    <div class="collapse navbar-collapse" id="navMenu">
      <ul class="navbar-nav me-auto">
        <?php if (isLoggedIn()): ?>
          <?php if (isAdmin()): ?>
            <li class="nav-item">
              <a class="nav-link" href="<?= BASE_URL ?>/admin/"><i class="bi bi-speedometer2 me-1"></i>Dashboard</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="<?= BASE_URL ?>/admin/elections.php"><i class="bi bi-calendar-event me-1"></i>Elections</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="<?= BASE_URL ?>/admin/voters.php"><i class="bi bi-people me-1"></i>Voters</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="<?= BASE_URL ?>/admin/candidates.php"><i class="bi bi-person-badge me-1"></i>Candidates</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="<?= BASE_URL ?>/admin/constituencies.php"><i class="bi bi-geo-alt me-1"></i>Constituencies</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="<?= BASE_URL ?>/admin/audit_log.php"><i class="bi bi-journal-text me-1"></i>Audit Log</a>
            </li>
          <?php else: ?>
            <li class="nav-item">
              <a class="nav-link" href="<?= BASE_URL ?>/ballot.php"><i class="bi bi-card-checklist me-1"></i>Vote</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="<?= BASE_URL ?>/results.php"><i class="bi bi-bar-chart me-1"></i>Results</a>
            </li>
          <?php endif; ?>
        <?php endif; ?>
      </ul>
      <ul class="navbar-nav ms-auto">
        <?php if (isLoggedIn()): ?>
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle" href="#" data-bs-toggle="dropdown">
              <i class="bi bi-person-circle me-1"></i><?= sanitize($_SESSION['full_name'] ?? 'User') ?>
            </a>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><span class="dropdown-item-text text-muted small"><?= sanitize(currentRole()) ?></span></li>
              <li><hr class="dropdown-divider"></li>
              <li><a class="dropdown-item text-danger" href="<?= BASE_URL ?>/logout.php"><i class="bi bi-box-arrow-right me-1"></i>Logout</a></li>
            </ul>
          </li>
        <?php else: ?>
          <li class="nav-item">
            <a class="nav-link" href="<?= BASE_URL ?>/login.php">Login</a>
          </li>
        <?php endif; ?>
      </ul>
    </div>
  </div>
</nav>

<main class="container-fluid py-4">
<?php
$flash = flashGet();
if ($flash):
?>
<div class="alert alert-<?= $flash['type'] === 'error' ? 'danger' : $flash['type'] ?> alert-dismissible fade show mx-3" role="alert">
  <?= htmlspecialchars($flash['msg']) ?>
  <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
</div>
<?php endif; ?>
