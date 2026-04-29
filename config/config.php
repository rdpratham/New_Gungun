<?php
// -------------------------------------------------------
// Application Configuration
// -------------------------------------------------------
define('APP_NAME',    'Online Voting System');
define('APP_VERSION', '1.0.0');

// ── Change this to your actual domain after deploying ──
define('BASE_URL', 'http://yourdomain.infinityfreeapp.com');

// ── Database ──
// Set DB_DRIVER to 'sqlite' for local testing
// Set DB_DRIVER to 'mysql'  for InfinityFree / any live host
define('DB_DRIVER', 'mysql');   // 'mysql' or 'sqlite'

// MySQL credentials (fill these from InfinityFree cPanel)
define('DB_HOST', 'sql200.infinityfree.com');  // from InfinityFree cPanel
define('DB_NAME', 'if0_xxxxxxxx_voting');       // from InfinityFree cPanel
define('DB_USER', 'if0_xxxxxxxx');              // from InfinityFree cPanel
define('DB_PASS', 'your_db_password');          // from InfinityFree cPanel
define('DB_PORT', 3306);

// SQLite path (used only when DB_DRIVER = 'sqlite')
define('DB_PATH', __DIR__ . '/../database/voting.db');

// Session
define('SESSION_TIMEOUT', 1800);  // 30 minutes

// OTP
define('OTP_EXPIRY',    600);     // 10 minutes
define('OTP_MAX_ATTEMPTS', 5);

// Uploads
define('UPLOAD_DIR', __DIR__ . '/../uploads/candidates/');
define('UPLOAD_URL', BASE_URL . '/uploads/candidates/');
define('MAX_FILE_SIZE', 2 * 1024 * 1024); // 2 MB

// Email — set DEV_MODE=true to show OTP on screen (for testing)
define('DEV_MODE', true);
define('SMTP_HOST', 'smtp.gmail.com');
define('SMTP_PORT', 587);
define('SMTP_USER', 'your-email@gmail.com');
define('SMTP_PASS', 'your-app-password');
define('FROM_EMAIL', 'noreply@voting.local');
define('FROM_NAME',  APP_NAME);
