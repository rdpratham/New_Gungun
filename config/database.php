<?php
require_once __DIR__ . '/config.php';

class Database {
    private static ?PDO $instance = null;

    public static function getConnection(): PDO {
        if (self::$instance === null) {
            $dir = dirname(DB_PATH);
            if (!is_dir($dir)) mkdir($dir, 0777, true);

            $pdo = new PDO('sqlite:' . DB_PATH, null, null, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            $pdo->exec('PRAGMA foreign_keys = ON');
            $pdo->exec('PRAGMA journal_mode = WAL');

            self::$instance = $pdo;
            self::initSchema($pdo);
        }
        return self::$instance;
    }

    private static function initSchema(PDO $pdo): void {
        // Only create tables if they don't exist yet
        $exists = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")->fetch();
        if ($exists) return;

        $pdo->exec("
        CREATE TABLE users (
            user_id   INTEGER PRIMARY KEY AUTOINCREMENT,
            username  TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            email     TEXT NOT NULL UNIQUE,
            mobile    TEXT NOT NULL,
            role      TEXT NOT NULL DEFAULT 'voter' CHECK(role IN ('ec_admin','constituency_admin','voter')),
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE elections (
            election_id  INTEGER PRIMARY KEY AUTOINCREMENT,
            title        TEXT NOT NULL,
            description  TEXT,
            start_time   TEXT NOT NULL,
            end_time     TEXT NOT NULL,
            status       TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','closed')),
            created_by   INTEGER NOT NULL REFERENCES users(user_id),
            created_at   TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE constituencies (
            constituency_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT NOT NULL,
            election_id     INTEGER NOT NULL REFERENCES elections(election_id) ON DELETE CASCADE,
            managed_by      INTEGER REFERENCES users(user_id) ON DELETE SET NULL
        );

        CREATE TABLE voters (
            voter_id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id          INTEGER NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
            voter_card_no    TEXT NOT NULL UNIQUE,
            constituency_id  INTEGER NOT NULL REFERENCES constituencies(constituency_id) ON DELETE CASCADE,
            has_voted        INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE candidates (
            candidate_id    INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT NOT NULL,
            party           TEXT,
            bio             TEXT,
            photo           TEXT,
            constituency_id INTEGER NOT NULL REFERENCES constituencies(constituency_id) ON DELETE CASCADE,
            election_id     INTEGER NOT NULL REFERENCES elections(election_id) ON DELETE CASCADE,
            created_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE votes (
            vote_id      INTEGER PRIMARY KEY AUTOINCREMENT,
            voter_hash   TEXT NOT NULL,
            candidate_id INTEGER NOT NULL REFERENCES candidates(candidate_id) ON DELETE CASCADE,
            election_id  INTEGER NOT NULL REFERENCES elections(election_id) ON DELETE CASCADE,
            voted_at     TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(voter_hash, election_id)
        );

        CREATE TABLE audit_log (
            log_id     INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER,
            action     TEXT NOT NULL,
            details    TEXT,
            ip_address TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE otp_tokens (
            otp_id     INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            otp_hash   TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used       INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        ");

        // Seed data — password is Admin@123
        $hash = password_hash('Admin@123', PASSWORD_BCRYPT, ['cost' => 12]);

        $pdo->exec("
        INSERT INTO users (username,password_hash,full_name,email,mobile,role)
        VALUES ('admin','{$hash}','Election Commission Admin','admin@voting.local','9999999999','ec_admin');

        INSERT INTO elections (title,description,start_time,end_time,status,created_by)
        VALUES ('Student Council Election 2026',
                'Annual student council election 2025-26.',
                datetime('now'), datetime('now','+7 days'), 'active', 1);

        INSERT INTO constituencies (name,election_id) VALUES ('Science Faculty',1);
        INSERT INTO constituencies (name,election_id) VALUES ('Arts Faculty',1);
        INSERT INTO constituencies (name,election_id) VALUES ('Commerce Faculty',1);

        INSERT INTO candidates (name,party,bio,constituency_id,election_id) VALUES
          ('Ravi Sharma',  'Progress Party', 'Final year, passionate about innovation.',1,1),
          ('Priya Mehta',  'Unity Alliance', 'Student welfare advocate, 2 years exp.',1,1),
          ('Amit Verma',   'Independent',    'Tech enthusiast, digital campus.',1,1);

        INSERT INTO candidates (name,party,bio,constituency_id,election_id) VALUES
          ('Sunita Rao',   'Progress Party', 'Cultural committee head.',2,1),
          ('Deepak Joshi', 'Unity Alliance', 'Drama and debate champion.',2,1);

        INSERT INTO candidates (name,party,bio,constituency_id,election_id) VALUES
          ('Kavya Nair',   'Progress Party', 'Finance club president.',3,1),
          ('Rohit Gupta',  'Independent',    'Entrepreneurship cell founder.',3,1);

        INSERT INTO users (username,password_hash,full_name,email,mobile,role)
        VALUES ('voter1','{$hash}','Demo Voter','voter1@voting.local','8888888888','voter');

        INSERT INTO voters (user_id,voter_card_no,constituency_id) VALUES (2,'VOTE2026001',1);
        ");
    }

    private function __construct() {}
    private function __clone() {}
}
