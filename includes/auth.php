<?php
require_once __DIR__ . '/../config/config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_name(SESSION_NAME);
    session_set_cookie_params([
        'lifetime' => SESSION_LIFETIME,
        'path'     => '/',
        'secure'   => isset($_SERVER['HTTPS']),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function isLoggedIn(): bool {
    return !empty($_SESSION['employee_id']);
}

function currentEmployee(): ?array {
    return $_SESSION['employee'] ?? null;
}

function currentRole(): string {
    return $_SESSION['employee']['role'] ?? '';
}

function isAdmin(): bool {
    return in_array(currentRole(), ['admin', 'hr']);
}

function requireLogin(string $redirect = '/login.php'): void {
    if (!isLoggedIn()) {
        header('Location: ' . $redirect);
        exit;
    }
}

function requireAdmin(string $redirect = '/login.php'): void {
    requireLogin($redirect);
    if (!isAdmin()) {
        header('Location: /dashboard.php');
        exit;
    }
}

function loginEmployee(array $employee): void {
    session_regenerate_id(true);
    $_SESSION['employee_id'] = $employee['employee_id'];
    $_SESSION['employee']    = $employee;
    $_SESSION['login_time']  = time();
}

function logoutEmployee(): void {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
                  $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

function flashSet(string $type, string $msg): void {
    $_SESSION['flash'] = ['type' => $type, 'msg' => $msg];
}

function flashGet(): ?array {
    $f = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    return $f;
}

function h(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
