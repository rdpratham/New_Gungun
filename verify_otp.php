<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/OtpModel.php';
require_once __DIR__ . '/models/UserModel.php';
require_once __DIR__ . '/models/AuditModel.php';

if (isLoggedIn()) { header('Location: ' . BASE_URL . '/ballot.php'); exit; }
if (empty($_SESSION['pending_user_id'])) { header('Location: ' . BASE_URL . '/login.php'); exit; }

$error      = '';
$userId     = (int) $_SESSION['pending_user_id'];
$devOtp     = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['resend'])) {
        $otp = OtpModel::generate($userId);
        if (DEV_MODE) {
            $devOtp = $otp;
        }
        AuditModel::log($userId, 'OTP_RESENT', '');
        $info = 'A new OTP has been sent.';
    } else {
        $submitted = preg_replace('/\D/', '', $_POST['otp'] ?? '');

        if (strlen($submitted) !== 6) {
            $error = 'Please enter the 6-digit OTP.';
        } elseif (($_SESSION['otp_attempts'] ?? 0) >= OTP_MAX_ATTEMPTS) {
            session_unset(); session_destroy();
            header('Location: ' . BASE_URL . '/login.php?timeout=1'); exit;
        } else {
            if (OtpModel::verify($userId, $submitted)) {
                session_regenerate_id(true);
                $user = UserModel::findById($userId);
                $_SESSION['user_id']     = $user['user_id'];
                $_SESSION['username']    = $user['username'];
                $_SESSION['full_name']   = $user['full_name'];
                $_SESSION['role']        = $user['role'];
                $_SESSION['last_active'] = time();
                unset($_SESSION['pending_user_id'], $_SESSION['pending_username'],
                      $_SESSION['pending_name'], $_SESSION['otp_attempts']);
                AuditModel::log($userId, 'LOGIN_SUCCESS', 'Voter authenticated via OTP');
                header('Location: ' . BASE_URL . '/ballot.php'); exit;
            } else {
                $_SESSION['otp_attempts'] = ($_SESSION['otp_attempts'] ?? 0) + 1;
                $remaining = OTP_MAX_ATTEMPTS - $_SESSION['otp_attempts'];
                $error = "Invalid or expired OTP. {$remaining} attempt(s) remaining.";
                AuditModel::log($userId, 'OTP_FAILED', 'Attempt ' . $_SESSION['otp_attempts']);
            }
        }
    }
}
$pageTitle = 'Verify OTP – ' . APP_NAME;
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= $pageTitle ?></title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="stylesheet" href="<?= BASE_URL ?>/assets/css/style.css">
</head>
<body class="auth-wrapper">
<div class="auth-card card p-4 p-md-5">
  <div class="text-center mb-4">
    <div class="auth-logo mb-2"><i class="bi bi-phone"></i></div>
    <h2 class="fw-bold mb-1">OTP Verification</h2>
    <p class="text-muted small">
      Hello, <strong><?= sanitize($_SESSION['pending_name'] ?? '') ?></strong>!<br>
      Enter the 6-digit OTP sent to your registered contact.
    </p>
  </div>

  <?php if (!empty($error)): ?>
    <div class="alert alert-danger py-2"><i class="bi bi-exclamation-circle me-1"></i><?= htmlspecialchars($error) ?></div>
  <?php endif; ?>
  <?php if (!empty($info)): ?>
    <div class="alert alert-success py-2"><i class="bi bi-check-circle me-1"></i><?= htmlspecialchars($info) ?></div>
  <?php endif; ?>
  <?php if (!empty($devOtp)): ?>
    <div class="alert alert-info py-2">
      <strong><i class="bi bi-bug me-1"></i>DEV OTP:</strong>
      <span class="fs-3 fw-bold ms-2 font-monospace"><?= htmlspecialchars($devOtp) ?></span>
    </div>
  <?php endif; ?>

  <form method="POST" action="">
    <div class="mb-3">
      <label class="form-label fw-semibold">One-Time Password</label>
      <input type="text" name="otp" class="form-control otp-input"
             inputmode="numeric" pattern="\d{6}" maxlength="6"
             placeholder="000000" autocomplete="one-time-code" required>
    </div>

    <div class="otp-timer-wrap d-flex align-items-center justify-content-between mb-4 text-muted small">
      <span><i class="bi bi-clock me-1"></i>Expires in <strong id="otp-timer">10:00</strong></span>
    </div>

    <button type="submit" class="btn btn-primary w-100 py-2 fw-semibold mb-2">
      <i class="bi bi-check2-circle me-2"></i>Verify OTP
    </button>
    <button type="submit" name="resend" value="1" id="resend-btn"
            class="btn btn-outline-secondary w-100" disabled>
      <i class="bi bi-arrow-repeat me-1"></i>Resend OTP
    </button>
  </form>

  <div class="text-center mt-3">
    <a href="<?= BASE_URL ?>/login.php" class="text-muted small">
      <i class="bi bi-arrow-left me-1"></i>Back to Login
    </a>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script>
  function startOtpTimer(s, id) {
    const el = document.getElementById(id);
    if (!el) return;
    let r = s;
    const t = () => {
      const m = String(Math.floor(r/60)).padStart(2,'0');
      const sec = String(r%60).padStart(2,'0');
      el.textContent = `${m}:${sec}`;
      if (r <= 0) {
        el.closest('.otp-timer-wrap').classList.add('text-danger');
        document.getElementById('resend-btn').removeAttribute('disabled');
        return;
      }
      r--; setTimeout(t, 1000);
    };
    t();
  }
  startOtpTimer(<?= OTP_EXPIRY ?>, 'otp-timer');
</script>
</body>
</html>
