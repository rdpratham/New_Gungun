<?php
require_once __DIR__ . '/includes/auth.php';
if (isLoggedIn()) {
    header('Location: ' . BASE_URL . (isAdmin() ? '/admin/' : '/ballot.php'));
} else {
    header('Location: ' . BASE_URL . '/login.php');
}
exit;
