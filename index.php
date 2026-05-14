<?php
require_once __DIR__ . '/includes/auth.php';
if (isLoggedIn()) {
    header('Location: ' . (isAdmin() ? '/admin/' : '/dashboard.php'));
} else {
    header('Location: /login.php');
}
exit;
