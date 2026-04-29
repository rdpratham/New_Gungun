<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/UserModel.php';
require_once __DIR__ . '/models/VoterModel.php';
require_once __DIR__ . '/models/OtpModel.php';
require_once __DIR__ . '/models/AuditModel.php';

// Redirect if already logged in
if (isLoggedIn()) {
    header('Location: ' . BASE_URL . (isAdmin() ? '/admin/' : '/ballot.php'));
    exit;
}

$error   = '';
$devOtp  = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    if (empty($username) || empty($password)) {
        $error = 'Please enter both username and password.';
    } else {
        $user = UserModel::findByUsername($username);

        if ($user && $user['is_active'] && password_verify($password, $user['password_hash'])) {
            $role = $user['role'];

            // Admins skip OTP
            if ($role === 'ec_admin' || $role === 'constituency_admin') {
                session_regenerate_id(true);
                $_SESSION['user_id']    = $user['user_id'];
                $_SESSION['username']   = $user['username'];
                $_SESSION['full_name']  = $user['full_name'];
                $_SESSION['role']       = $role;
                $_SESSION['last_active'] = time();
                AuditModel::log($user['user_id'], 'ADMIN_LOGIN', 'Role: ' . $role);
                header('Location: ' . BASE_URL . '/admin/');
                exit;
            }

            // Voter → OTP
            $otp = OtpModel::generate((int) $user['user_id']);
            $_SESSION['pending_user_id']  = $user['user_id'];
            $_SESSION['pending_username'] = $user['username'];
            $_SESSION['pending_name']     = $user['full_name'];
            $_SESSION['otp_attempts']     = 0;
            AuditModel::log($user['user_id'], 'LOGIN_OTP_SENT', 'Voter login attempt');

            if (DEV_MODE) {
                $devOtp = $otp;  // Show on screen in dev mode
            }
            // TODO: send email/SMS via PHPMailer in production

            if (empty($devOtp)) {
                header('Location: ' . BASE_URL . '/verify_otp.php');
                exit;
            }
        } else {
            $error = 'Invalid credentials or account is inactive.';
            AuditModel::log(null, 'LOGIN_FAILED', 'Username: ' . htmlspecialchars($username));
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
  <link rel="stylesheet" href="<?= BASE_URL ?>/assets/css/style.css">
</head>
<body class="auth-wrapper">
<div class="auth-card card p-4 p-md-5">
  <div class="text-center mb-4">
    <div class="auth-logo mb-2"><i class="bi bi-shield-lock-fill"></i></div>
    <h2 class="fw-bold mb-0"><?= APP_NAME ?></h2>
    <p class="text-muted small mt-1">Sanskriti University, Mathura</p>
  </div>

  <?php if ($error): ?>
    <div class="alert alert-danger py-2"><i class="bi bi-exclamation-circle me-1"></i><?= htmlspecialchars($error) ?></div>
  <?php endif; ?>
  <?php if (isset($_GET['timeout'])): ?>
    <div class="alert alert-warning py-2"><i class="bi bi-clock me-1"></i>Your session expired. Please login again.</div>
  <?php endif; ?>
  <?php if (isset($_GET['denied'])): ?>
    <div class="alert alert-danger py-2"><i class="bi bi-ban me-1"></i>Access denied. Insufficient permissions.</div>
  <?php endif; ?>

  <?php if ($devOtp): ?>
    <div class="alert alert-info py-2">
      <strong><i class="bi bi-info-circle me-1"></i>DEV MODE OTP:</strong>
      <span class="fs-4 fw-bold ms-2 font-monospace"><?= htmlspecialchars($devOtp) ?></span>
      <a href="<?= BASE_URL ?>/verify_otp.php" class="btn btn-sm btn-outline-primary ms-3">Continue →</a>
    </div>
  <?php endif; ?>

  <form method="POST" action="">
    <div class="mb-3">
      <label class="form-label fw-semibold">Username / Voter ID</label>
      <div class="input-group">
        <span class="input-group-text"><i class="bi bi-person"></i></span>
        <input type="text" name="username" class="form-control" required
               value="<?= htmlspecialchars($_POST['username'] ?? '') ?>"
               placeholder="Enter username" autocomplete="username">
      </div>
    </div>
    <div class="mb-4">
      <label class="form-label fw-semibold">Password</label>
      <div class="input-group">
        <span class="input-group-text"><i class="bi bi-lock"></i></span>
        <input type="password" name="password" id="passwordField" class="form-control"
               required placeholder="Enter password" autocomplete="current-password">
        <button type="button" class="btn btn-outline-secondary"
                onclick="let f=document.getElementById('passwordField');f.type=f.type==='password'?'text':'password'">
          <i class="bi bi-eye"></i>
        </button>
      </div>
    </div>
    <button type="submit" class="btn btn-primary w-100 py-2 fw-semibold">
      <i class="bi bi-box-arrow-in-right me-2"></i>Login
    </button>
  </form>

  <hr class="my-4">
  <div class="text-center text-muted small">
    <i class="bi bi-shield-check text-success me-1"></i>Secured with HTTPS &amp; two-factor authentication
  </div>
  <div class="text-center mt-2">
    <small class="text-muted">Demo: admin / voter1 &mdash; Password: <code>Admin@123</code></small>
  </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
