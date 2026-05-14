<?php
// ── App ──────────────────────────────────────────────────────────────────────
define('APP_NAME',    'Shorthills AI Attendance');
define('APP_VERSION', '1.0.0');

// ── Timezone ─────────────────────────────────────────────────────────────────
define('APP_TIMEZONE', 'Asia/Kolkata');
date_default_timezone_set(APP_TIMEZONE);

// ── Session ──────────────────────────────────────────────────────────────────
define('SESSION_LIFETIME', 28800);   // 8 hours
define('SESSION_NAME',     'shai_attend');

// ── Attendance rules ─────────────────────────────────────────────────────────
define('DEFAULT_SHIFT_START',   '09:00');
define('DEFAULT_SHIFT_END',     '18:00');
define('LATE_GRACE_MINUTES',    15);    // minutes after shift_start before "Late"
define('HALF_DAY_HOURS',        4.0);  // work_hours below this → Half-Day
define('FULL_DAY_HOURS',        8.0);

// ── Database ─────────────────────────────────────────────────────────────────
// Auto-detects Railway MySQL or falls back to local SQLite
if (getenv('MYSQL_URL') || getenv('MYSQLHOST')) {
    define('DB_DRIVER', 'mysql');
    define('DB_HOST',   getenv('MYSQLHOST')     ?: 'localhost');
    define('DB_PORT',   (int)(getenv('MYSQLPORT') ?: 3306));
    define('DB_NAME',   getenv('MYSQLDATABASE') ?: 'attendance');
    define('DB_USER',   getenv('MYSQLUSER')     ?: 'root');
    define('DB_PASS',   getenv('MYSQLPASSWORD') ?: '');
    define('DB_PATH',   '');
} else {
    define('DB_DRIVER', 'sqlite');
    define('DB_PATH',   __DIR__ . '/../database/attendance.db');
    define('DB_HOST',   '');
    define('DB_PORT',   3306);
    define('DB_NAME',   '');
    define('DB_USER',   '');
    define('DB_PASS',   '');
}
