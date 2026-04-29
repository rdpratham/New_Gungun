-- Online Voting System Database Schema
-- Compatible with MySQL 8.0+

CREATE DATABASE IF NOT EXISTS online_voting CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE online_voting;

-- Users table (admins, constituency admins, voters)
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    mobile VARCHAR(15) NOT NULL,
    role ENUM('ec_admin','constituency_admin','voter') NOT NULL DEFAULT 'voter',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Elections table
CREATE TABLE IF NOT EXISTS elections (
    election_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status ENUM('draft','active','closed') NOT NULL DEFAULT 'draft',
    created_by INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Constituencies table
CREATE TABLE IF NOT EXISTS constituencies (
    constituency_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    election_id INT NOT NULL,
    managed_by INT DEFAULT NULL,
    FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE,
    FOREIGN KEY (managed_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Voters table (voter-specific data)
CREATE TABLE IF NOT EXISTS voters (
    voter_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    voter_card_no VARCHAR(50) NOT NULL UNIQUE,
    constituency_id INT NOT NULL,
    has_voted TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (constituency_id) REFERENCES constituencies(constituency_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Candidates table
CREATE TABLE IF NOT EXISTS candidates (
    candidate_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    party VARCHAR(150) DEFAULT NULL,
    bio TEXT DEFAULT NULL,
    photo VARCHAR(255) DEFAULT NULL,
    constituency_id INT NOT NULL,
    election_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (constituency_id) REFERENCES constituencies(constituency_id) ON DELETE CASCADE,
    FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Votes table (voter_hash for ballot secrecy)
CREATE TABLE IF NOT EXISTS votes (
    vote_id INT AUTO_INCREMENT PRIMARY KEY,
    voter_hash VARCHAR(64) NOT NULL,
    candidate_id INT NOT NULL,
    election_id INT NOT NULL,
    voted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_voter_election (voter_hash, election_id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id) ON DELETE CASCADE,
    FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT DEFAULT NULL,
    ip_address VARCHAR(45) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- OTP table (temporary storage)
CREATE TABLE IF NOT EXISTS otp_tokens (
    otp_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    used TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================
-- SEED DATA: Default admin account
-- Password: Admin@123
-- =============================================
INSERT INTO users (username, password_hash, full_name, email, mobile, role)
VALUES (
    'admin',
    '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'Election Commission Admin',
    'admin@voting.local',
    '9999999999',
    'ec_admin'
);

-- Demo election
INSERT INTO elections (title, description, start_time, end_time, status, created_by)
VALUES (
    'Student Council Election 2026',
    'Annual student council election for the academic year 2025-26.',
    NOW(),
    DATE_ADD(NOW(), INTERVAL 7 DAY),
    'active',
    1
);

-- Demo constituencies
INSERT INTO constituencies (name, election_id) VALUES ('Science Faculty', 1);
INSERT INTO constituencies (name, election_id) VALUES ('Arts Faculty', 1);
INSERT INTO constituencies (name, election_id) VALUES ('Commerce Faculty', 1);

-- Demo candidates for Science Faculty (constituency_id=1)
INSERT INTO candidates (name, party, bio, constituency_id, election_id)
VALUES
  ('Ravi Sharma',   'Progress Party',  'Final year student, passionate about innovation.', 1, 1),
  ('Priya Mehta',   'Unity Alliance',  'Student welfare advocate with 2 years experience.', 1, 1),
  ('Amit Verma',    'Independent',     'Tech enthusiast committed to digital campus.', 1, 1);

-- Demo candidates for Arts Faculty (constituency_id=2)
INSERT INTO candidates (name, party, bio, constituency_id, election_id)
VALUES
  ('Sunita Rao',    'Progress Party',  'Cultural committee head for 2 years.', 2, 1),
  ('Deepak Joshi',  'Unity Alliance',  'Drama and debate champion.', 2, 1);

-- Demo candidates for Commerce Faculty (constituency_id=3)
INSERT INTO candidates (name, party, bio, constituency_id, election_id)
VALUES
  ('Kavya Nair',    'Progress Party',  'Finance club president.', 3, 1),
  ('Rohit Gupta',   'Independent',     'Entrepreneurship cell founder.', 3, 1);

-- Demo voter account (voter for Science Faculty)
-- Password: Voter@123
INSERT INTO users (username, password_hash, full_name, email, mobile, role)
VALUES (
    'voter1',
    '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'Demo Voter',
    'voter1@voting.local',
    '8888888888',
    'voter'
);
INSERT INTO voters (user_id, voter_card_no, constituency_id)
VALUES (2, 'VOTE2026001', 1);
