<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/EmployeeModel.php';

if (isLoggedIn()) {
    header('Location: ' . (isAdmin() ? '/admin/' : '/dashboard.php'));
    exit;
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email    = trim($_POST['email']    ?? '');
    $password = $_POST['password'] ?? '';

    if (empty($email) || empty($password)) {
        $error = 'Please enter your email and password.';
    } else {
        $emp = EmployeeModel::findByEmail($email);

        if ($emp && $emp['is_active'] && password_verify($password, $emp['password_hash'])) {
            loginEmployee($emp);
            header('Location: ' . (isAdmin() ? '/admin/' : '/dashboard.php'));
            exit;
        } else {
            $error = 'Invalid email or password, or your account is inactive.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login – <?= APP_NAME ?></title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="stylesheet" href="/assets/css/style.css">
</head>
<body class="auth-wrapper">

<div class="auth-card card shadow-lg">
  <div class="card-body p-4 p-md-5">

    <div class="text-center mb-4">
      <div class="auth-logo mb-3">
        <i class="bi bi-clock-history"></i>
      </div>
      <h2 class="fw-bold mb-1"><?= APP_NAME ?></h2>
      <p class="text-muted small">Sign in to continue</p>
    </div>

    <?php if ($error): ?>
      <div class="alert alert-danger py-2 mb-3">
        <i class="bi bi-exclamation-circle me-1"></i><?= h($error) ?>
      </div>
    <?php endif; ?>

    <?php if (isset($_GET['logout'])): ?>
      <div class="alert alert-success py-2 mb-3">
        <i class="bi bi-check-circle me-1"></i>Logged out successfully.
      </div>
    <?php endif; ?>

    <form method="POST" action="" novalidate>
      <div class="mb-3">
        <label class="form-label fw-semibold">Work Email</label>
        <div class="input-group">
          <span class="input-group-text"><i class="bi bi-envelope"></i></span>
          <input type="email" name="email" class="form-control" required
                 value="<?= h($_POST['email'] ?? '') ?>"
                 placeholder="you@shorthill.ai" autocomplete="email">
        </div>
      </div>

      <div class="mb-4">
        <label class="form-label fw-semibold">Password</label>
        <div class="input-group">
          <span class="input-group-text"><i class="bi bi-lock"></i></span>
          <input type="password" name="password" id="pwdField" class="form-control"
                 required placeholder="Password" autocomplete="current-password">
          <button type="button" class="btn btn-outline-secondary toggle-pwd" data-target="pwdField">
            <i class="bi bi-eye"></i>
          </button>
        </div>
      </div>

      <button type="submit" class="btn btn-primary w-100 py-2 fw-semibold">
        <i class="bi bi-box-arrow-in-right me-2"></i>Sign In
      </button>
    </form>

    <hr class="my-4">
    <div class="demo-creds p-3 rounded">
      <p class="fw-semibold small mb-2 text-muted">Demo credentials:</p>
      <div class="d-flex flex-column gap-1 small font-monospace">
        <span><strong>Admin:</strong> admin@shorthill.ai</span>
        <span><strong>Employee:</strong> rahul@shorthill.ai</span>
        <span><strong>Password:</strong> Admin@123 / Emp@1234</span>
      </div>
    </div>

  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script>
document.querySelectorAll('.toggle-pwd').forEach(btn => {
  btn.addEventListener('click', () => {
    const f = document.getElementById(btn.dataset.target);
    const icon = btn.querySelector('i');
    f.type = f.type === 'password' ? 'text' : 'password';
    icon.className = f.type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
  });
});
</script>
</body>
</html>
