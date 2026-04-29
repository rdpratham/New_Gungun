<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/AuditModel.php';

if (isLoggedIn()) {
    AuditModel::log(currentUserId(), 'LOGOUT', '');
}
session_unset();
session_destroy();
header('Location: ' . BASE_URL . '/login.php');
exit;
