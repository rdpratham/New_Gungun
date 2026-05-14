<?php
require_once __DIR__ . '/config.php';

class Database {
    private static ?PDO $instance = null;

    public static function getConnection(): PDO {
        if (self::$instance === null) {
            if (DB_DRIVER === 'sqlite') {
                $dir = dirname(DB_PATH);
                if (!is_dir($dir)) mkdir($dir, 0777, true);
                $pdo = new PDO('sqlite:' . DB_PATH, null, null, [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                ]);
                $pdo->exec('PRAGMA foreign_keys = ON');
                $pdo->exec('PRAGMA journal_mode = WAL');
                self::$instance = $pdo;
                self::initSQLite($pdo);
            } else {
                $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT
                     . ';dbname=' . DB_NAME . ';charset=utf8mb4';
                self::$instance = new PDO($dsn, DB_USER, DB_PASS, [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]);
            }
        }
        return self::$instance;
    }

    private static function initSQLite(PDO $pdo): void {
        $exists = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='employees'")->fetch();
        if ($exists) return;

        $pdo->exec("
        CREATE TABLE employees (
            employee_id   INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_code TEXT    NOT NULL UNIQUE,
            full_name     TEXT    NOT NULL,
            email         TEXT    NOT NULL UNIQUE,
            password_hash TEXT    NOT NULL,
            department    TEXT    NOT NULL,
            designation   TEXT    NOT NULL,
            mobile        TEXT,
            join_date     TEXT    NOT NULL DEFAULT (date('now')),
            role          TEXT    NOT NULL DEFAULT 'employee'
                                  CHECK(role IN ('admin','hr','employee')),
            shift_start   TEXT    NOT NULL DEFAULT '09:00',
            shift_end     TEXT    NOT NULL DEFAULT '18:00',
            is_active     INTEGER NOT NULL DEFAULT 1,
            created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE attendance (
            attendance_id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id   INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
            date          TEXT    NOT NULL DEFAULT (date('now')),
            check_in      TEXT,
            check_out     TEXT,
            status        TEXT    NOT NULL DEFAULT 'present'
                                  CHECK(status IN ('present','absent','late','half_day','on_leave','holiday')),
            work_hours    REAL    NOT NULL DEFAULT 0,
            notes         TEXT,
            created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
            UNIQUE(employee_id, date)
        );

        CREATE TABLE leaves (
            leave_id      INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id   INTEGER NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
            leave_type    TEXT    NOT NULL CHECK(leave_type IN ('sick','casual','earned','unpaid')),
            start_date    TEXT    NOT NULL,
            end_date      TEXT    NOT NULL,
            days_count    INTEGER NOT NULL DEFAULT 1,
            reason        TEXT    NOT NULL,
            status        TEXT    NOT NULL DEFAULT 'pending'
                                  CHECK(status IN ('pending','approved','rejected')),
            reviewed_by   INTEGER REFERENCES employees(employee_id),
            reviewer_note TEXT,
            reviewed_at   TEXT,
            created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE holidays (
            holiday_id    INTEGER PRIMARY KEY AUTOINCREMENT,
            holiday_date  TEXT    NOT NULL UNIQUE,
            name          TEXT    NOT NULL,
            created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        ");

        // Seed admin + demo employees
        $adminHash = password_hash('Admin@123', PASSWORD_BCRYPT, ['cost' => 12]);
        $empHash   = password_hash('Emp@1234',  PASSWORD_BCRYPT, ['cost' => 12]);

        $pdo->exec("
        INSERT INTO employees
            (employee_code, full_name, email, password_hash, department, designation, mobile, role)
        VALUES
            ('EMP001','Admin User',     'admin@shorthill.ai', '{$adminHash}',
             'Management',  'HR Manager',      '9999999999', 'admin'),
            ('EMP002','Rahul Sharma',   'rahul@shorthill.ai', '{$empHash}',
             'Engineering', 'Software Engineer','9876543210', 'employee'),
            ('EMP003','Priya Mehta',    'priya@shorthill.ai', '{$empHash}',
             'Engineering', 'Frontend Developer','9876543211','employee'),
            ('EMP004','Amit Verma',     'amit@shorthill.ai',  '{$empHash}',
             'Design',      'UI/UX Designer',  '9876543212', 'employee'),
            ('EMP005','Sunita Rao',     'sunita@shorthill.ai','{$empHash}',
             'Marketing',   'Marketing Lead',  '9876543213', 'employee');

        INSERT INTO holidays (holiday_date, name) VALUES
            ('2026-01-26','Republic Day'),
            ('2026-08-15','Independence Day'),
            ('2026-10-02','Gandhi Jayanti');
        ");
    }

    private function __construct() {}
    private function __clone()   {}
}
