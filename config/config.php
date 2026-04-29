<?php
// -------------------------------------------------------
// Application Configuration
// Auto-detects Railway environment or falls back to local
// -------------------------------------------------------
define('APP_NAME',    'Online Voting System');
define('APP_VERSION', '1.0.0');

// BASE_URL — Railway sets RAILWAY_PUBLIC_DOMAIN automatically
if (getenv('RAILWAY_PUBLIC_DOMAIN')) {
    define('BASE_URL', 'https://' . getenv('RAILWAY_PUBLIC_DOMAIN'));
} else {
    define('BASE_URL', 'http://localhost:8080');  // local dev
}

// ── Database Driver ──
// 'mysql'  → for Railway (MySQL plugin) or InfinityFree
// 'sqlite' → for local testing (no server needed)
if (getenv('MYSQL_URL') || getenv('DB_HOST')) {
    define('DB_DRIVER', 'mysql');
} else {
    define('DB_DRIVER', 'sqlite');
}

// MySQL — Railway injects these automatically via MySQL plugin
define('DB_HOST', getenv('MYSQLHOST')     ?: getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('MYSQLDATABASE') ?: getenv('DB_NAME') ?: 'online_voting');
define('DB_USER', getenv('MYSQLUSER')     ?: getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('MYSQLPASSWORD') ?: getenv('DB_PASS') ?: '');
define('DB_PORT', (int)(getenv('MYSQLPORT') ?: getenv('DB_PORT') ?: 3306));

// SQLite path (local only)
define('DB_PATH', __DIR__ . '/../database/voting.db');

// Session
define('SESSION_TIMEOUT', 1800);

// OTP
define('OTP_EXPIRY',      600);
define('OTP_MAX_ATTEMPTS', 5);

// Uploads
define('UPLOAD_DIR', __DIR__ . '/../uploads/candidates/');
define('UPLOAD_URL', BASE_URL . '/uploads/candidates/');
define('MAX_FILE_SIZE', 2 * 1024 * 1024);

// Dev mode — shows OTP on screen instead of sending email
define('DEV_MODE', true);
define('SMTP_HOST', getenv('SMTP_HOST') ?: 'smtp.gmail.com');
define('SMTP_PORT', 587);
define('SMTP_USER', getenv('SMTP_USER') ?: '');
define('SMTP_PASS', getenv('SMTP_PASS') ?: '');
define('FROM_EMAIL', 'noreply@voting.local');
define('FROM_NAME',  APP_NAME);
