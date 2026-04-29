<?php
// -------------------------------------------------------
// Application Configuration
// -------------------------------------------------------
define('APP_NAME',    'Online Voting System');
define('APP_VERSION', '1.0.0');
define('BASE_URL',    'http://localhost/New_Gungun');

// Database
define('DB_HOST', 'localhost');
define('DB_NAME', 'online_voting');
define('DB_USER', 'root');
define('DB_PASS', '');          // Change to your MySQL root password
define('DB_PORT', 3306);

// Session
define('SESSION_TIMEOUT', 1800);  // 30 minutes

// OTP
define('OTP_EXPIRY',    600);     // 10 minutes
define('OTP_MAX_ATTEMPTS', 5);

// Uploads
define('UPLOAD_DIR', __DIR__ . '/../uploads/candidates/');
define('UPLOAD_URL', BASE_URL . '/uploads/candidates/');
define('MAX_FILE_SIZE', 2 * 1024 * 1024); // 2 MB

// Email (PHPMailer) — set DEV_MODE=true to skip real email and show OTP on screen
define('DEV_MODE', true);
define('SMTP_HOST', 'smtp.gmail.com');
define('SMTP_PORT', 587);
define('SMTP_USER', 'your-email@gmail.com');
define('SMTP_PASS', 'your-app-password');
define('FROM_EMAIL', 'noreply@voting.local');
define('FROM_NAME',  APP_NAME);
