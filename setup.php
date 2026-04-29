<?php
/**
 * Database Setup Wizard
 * Visit this file once to initialize the database.
 * Delete or protect it after first run.
 */
require_once __DIR__ . '/config/config.php';

$step    = (int) ($_GET['step'] ?? 1);
$message = '';
$error   = '';

if ($step === 2 && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $host  = trim($_POST['db_host']  ?? DB_HOST);
    $port  = (int) ($_POST['db_port']  ?? DB_PORT);
    $user  = trim($_POST['db_user']  ?? DB_USER);
    $pass  = $_POST['db_pass']       ?? DB_PASS;
    $name  = trim($_POST['db_name']  ?? DB_NAME);

    try {
        $dsn = "mysql:host={$host};port={$port};charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

        // Create DB if not exists
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("USE `{$name}`");

        // Run SQL file
        $sql = file_get_contents(__DIR__ . '/database.sql');
        // Skip the CREATE DATABASE / USE lines (already handled)
        $sql = preg_replace('/^CREATE DATABASE.*?;\s*/im', '', $sql);
        $sql = preg_replace('/^USE.*?;\s*/im', '', $sql);

        foreach (explode(';', $sql) as $stmt) {
            $stmt = trim($stmt);
            if ($stmt) $pdo->exec($stmt);
        }

        $message = 'Database setup completed successfully! You can now <a href="login.php">login</a>.<br>
                    <strong>Default admin:</strong> username <code>admin</code> / password <code>Admin@123</code><br>
                    <strong>Demo voter:</strong> username <code>voter1</code> / password <code>Admin@123</code><br>
                    <strong>Delete or restrict access to this file after setup!</strong>';
    } catch (Exception $e) {
        $error = 'Database error: ' . htmlspecialchars($e->getMessage());
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Setup – <?= APP_NAME ?></title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body class="auth-wrapper">
<div class="auth-card card p-4 p-md-5" style="max-width:520px">
  <div class="text-center mb-4">
    <div class="auth-logo"><i class="bi bi-database-fill-gear"></i></div>
    <h2 class="fw-bold"><?= APP_NAME ?></h2>
    <p class="text-muted">Database Setup Wizard</p>
  </div>

  <?php if ($error): ?>
    <div class="alert alert-danger"><?= $error ?></div>
  <?php endif; ?>
  <?php if ($message): ?>
    <div class="alert alert-success"><?= $message ?></div>
  <?php else: ?>
  <form method="POST" action="?step=2">
    <div class="mb-3">
      <label class="form-label fw-semibold">Database Host</label>
      <input type="text" name="db_host" class="form-control" value="<?= DB_HOST ?>">
    </div>
    <div class="mb-3">
      <label class="form-label fw-semibold">Database Port</label>
      <input type="number" name="db_port" class="form-control" value="<?= DB_PORT ?>">
    </div>
    <div class="mb-3">
      <label class="form-label fw-semibold">Database User</label>
      <input type="text" name="db_user" class="form-control" value="<?= DB_USER ?>">
    </div>
    <div class="mb-3">
      <label class="form-label fw-semibold">Database Password</label>
      <input type="password" name="db_pass" class="form-control" value="">
    </div>
    <div class="mb-4">
      <label class="form-label fw-semibold">Database Name</label>
      <input type="text" name="db_name" class="form-control" value="<?= DB_NAME ?>">
    </div>
    <div class="alert alert-warning small">
      <i class="bi bi-exclamation-triangle me-1"></i>
      This will create the database and insert demo data. Existing data will be preserved (tables created only if not exists).
    </div>
    <button type="submit" class="btn btn-primary w-100 py-2 fw-semibold">
      <i class="bi bi-play-fill me-2"></i>Run Setup
    </button>
  </form>
  <?php endif; ?>
</div>
<script src="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"></script>
</body>
</html>
