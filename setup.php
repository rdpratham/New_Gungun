<?php
require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/database.php';

$message = '';
$error   = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $db = Database::getConnection();

        // Check if already set up
        if (DB_DRIVER === 'sqlite') {
            $exists = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")->fetch();
        } else {
            $exists = $db->query("SHOW TABLES LIKE 'users'")->fetch();
        }

        if ($exists) {
            $message = 'Database already set up! <a href="login.php">Click here to login</a>.';
        } else {
            // Run MySQL schema
            if (DB_DRIVER === 'mysql') {
                $sql = file_get_contents(__DIR__ . '/database.sql');
                $sql = preg_replace('/^CREATE DATABASE.*?;\s*/im', '', $sql);
                $sql = preg_replace('/^USE.*?;\s*/im', '', $sql);
                foreach (explode(';', $sql) as $stmt) {
                    $stmt = trim($stmt);
                    if ($stmt) $db->exec($stmt);
                }
            }
            // SQLite is auto-initialized in Database::getConnection()
            $message = '✅ Setup complete! <a href="login.php"><strong>Click here to login</strong></a><br><br>
                        <strong>Admin login:</strong> <code>admin</code> / <code>Admin@123</code><br>
                        <strong>Demo voter:</strong> <code>voter1</code> / <code>Admin@123</code><br><br>
                        <em>Please delete or rename setup.php after this.</em>';
        }
    } catch (Exception $e) {
        $error = 'Error: ' . htmlspecialchars($e->getMessage());
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Setup – <?= APP_NAME ?></title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body class="auth-wrapper">
<div class="auth-card card p-4 p-md-5" style="max-width:520px">
  <div class="text-center mb-4">
    <div class="auth-logo"><i class="bi bi-database-fill-gear"></i></div>
    <h2 class="fw-bold"><?= APP_NAME ?></h2>
    <p class="text-muted">One-Click Database Setup</p>
  </div>

  <?php if ($error): ?>
    <div class="alert alert-danger"><?= $error ?></div>
  <?php endif; ?>

  <?php if ($message): ?>
    <div class="alert alert-success"><?= $message ?></div>
  <?php else: ?>

  <div class="card bg-light border-0 p-3 mb-4">
    <div class="mb-1"><strong>Driver:</strong> <span class="badge bg-primary"><?= DB_DRIVER ?></span></div>
    <?php if (DB_DRIVER === 'mysql'): ?>
    <div class="mb-1"><strong>Host:</strong> <?= htmlspecialchars(DB_HOST) ?></div>
    <div class="mb-1"><strong>Database:</strong> <?= htmlspecialchars(DB_NAME) ?></div>
    <div><strong>User:</strong> <?= htmlspecialchars(DB_USER) ?></div>
    <?php else: ?>
    <div><strong>SQLite file:</strong> database/voting.db</div>
    <?php endif; ?>
  </div>

  <form method="POST">
    <button type="submit" class="btn btn-primary w-100 py-2 fw-semibold">
      <i class="bi bi-play-fill me-2"></i>Run Setup Now
    </button>
  </form>
  <?php endif; ?>
</div>
</body>
</html>
