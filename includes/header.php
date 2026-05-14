<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= h($pageTitle ?? APP_NAME) ?> – <?= APP_NAME ?></title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="stylesheet" href="/assets/css/style.css">
</head>
<body>

<nav class="navbar navbar-expand-lg navbar-dark shadow-sm" style="background:#1a1f36;">
  <div class="container-fluid px-4">
    <a class="navbar-brand fw-bold d-flex align-items-center gap-2" href="/">
      <span class="brand-badge"><i class="bi bi-clock-history"></i></span>
      <span><?= APP_NAME ?></span>
    </a>
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMenu">
      <span class="navbar-toggler-icon"></span>
    </button>
    <div class="collapse navbar-collapse" id="navMenu">
      <ul class="navbar-nav me-auto">
        <?php if (isLoggedIn()): ?>
          <?php if (isAdmin()): ?>
            <li class="nav-item">
              <a class="nav-link <?= strpos($_SERVER['PHP_SELF'],'admin/index') !== false ? 'active' : '' ?>"
                 href="/admin/"><i class="bi bi-speedometer2 me-1"></i>Dashboard</a>
            </li>
            <li class="nav-item">
              <a class="nav-link <?= strpos($_SERVER['PHP_SELF'],'admin/employees') !== false ? 'active' : '' ?>"
                 href="/admin/employees.php"><i class="bi bi-people me-1"></i>Employees</a>
            </li>
            <li class="nav-item">
              <a class="nav-link <?= strpos($_SERVER['PHP_SELF'],'admin/attendance') !== false ? 'active' : '' ?>"
                 href="/admin/attendance.php"><i class="bi bi-calendar-check me-1"></i>Attendance</a>
            </li>
            <li class="nav-item">
              <a class="nav-link <?= strpos($_SERVER['PHP_SELF'],'admin/leaves') !== false ? 'active' : '' ?>"
                 href="/admin/leaves.php">
                <i class="bi bi-calendar-x me-1"></i>Leaves
                <?php
                  require_once __DIR__ . '/../models/LeaveModel.php';
                  $pc = LeaveModel::pendingCount();
                  if ($pc > 0): ?>
                  <span class="badge bg-danger ms-1"><?= $pc ?></span>
                <?php endif; ?>
              </a>
            </li>
            <li class="nav-item">
              <a class="nav-link <?= strpos($_SERVER['PHP_SELF'],'admin/reports') !== false ? 'active' : '' ?>"
                 href="/admin/reports.php"><i class="bi bi-bar-chart-line me-1"></i>Reports</a>
            </li>
          <?php else: ?>
            <li class="nav-item">
              <a class="nav-link <?= strpos($_SERVER['PHP_SELF'],'dashboard') !== false ? 'active' : '' ?>"
                 href="/dashboard.php"><i class="bi bi-house me-1"></i>Dashboard</a>
            </li>
            <li class="nav-item">
              <a class="nav-link <?= strpos($_SERVER['PHP_SELF'],'my_attendance') !== false ? 'active' : '' ?>"
                 href="/my_attendance.php"><i class="bi bi-calendar-check me-1"></i>My Attendance</a>
            </li>
            <li class="nav-item">
              <a class="nav-link <?= strpos($_SERVER['PHP_SELF'],'leave_request') !== false ? 'active' : '' ?>"
                 href="/leave_request.php"><i class="bi bi-calendar-minus me-1"></i>Leave Request</a>
            </li>
          <?php endif; ?>
        <?php endif; ?>
      </ul>
      <ul class="navbar-nav ms-auto align-items-center">
        <?php if (isLoggedIn()):
          $emp = currentEmployee(); ?>
          <li class="nav-item me-2">
            <span class="text-secondary small"><i class="bi bi-clock me-1"></i><span id="live-time"></span></span>
          </li>
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle d-flex align-items-center gap-2" href="#" data-bs-toggle="dropdown">
              <span class="avatar-sm"><?= strtoupper(substr($emp['full_name'], 0, 1)) ?></span>
              <span><?= h($emp['full_name']) ?></span>
            </a>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><span class="dropdown-item-text fw-semibold"><?= h($emp['full_name']) ?></span></li>
              <li><span class="dropdown-item-text text-muted small"><?= h($emp['employee_code']) ?> · <?= h($emp['designation']) ?></span></li>
              <li><hr class="dropdown-divider"></li>
              <li><a class="dropdown-item text-danger" href="/logout.php">
                <i class="bi bi-box-arrow-right me-1"></i>Logout
              </a></li>
            </ul>
          </li>
        <?php else: ?>
          <li class="nav-item">
            <a class="nav-link" href="/login.php"><i class="bi bi-box-arrow-in-right me-1"></i>Login</a>
          </li>
        <?php endif; ?>
      </ul>
    </div>
  </div>
</nav>

<main class="container-fluid py-4 px-4">
<?php
$flash = flashGet();
if ($flash):
?>
<div class="alert alert-<?= $flash['type'] === 'error' ? 'danger' : h($flash['type']) ?> alert-dismissible fade show" role="alert">
  <?= h($flash['msg']) ?>
  <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
</div>
<?php endif; ?>
