# Online Voting System (OVS)

**Developed by:** Gungun Gupta (Enrolment No: 2302309063)  
**Under supervision of:** Mr. Atul Rathor, Assistant Professor, SOEIT  
**Institution:** Sanskriti University, Mathura, U.P.  
**Academic Year:** 2025-26

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | PHP 8.1+ |
| Database | MySQL 8.0+ |
| Server | Apache (WAMP/LAMP/XAMPP) |
| Frontend | HTML5, CSS3, Bootstrap 5.3, JavaScript |
| Security | bcrypt, SHA-256, CSRF tokens, session management |

---

## Quick Start (WAMP / XAMPP)

### 1. Copy files
Place the `New_Gungun` folder inside your web root:
- **WAMP:** `C:\wamp64\www\New_Gungun\`
- **XAMPP:** `C:\xampp\htdocs\New_Gungun\`

### 2. Configure database
Edit `config/config.php`:
```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'online_voting');
define('DB_USER', 'root');
define('DB_PASS', '');          // Your MySQL root password
```

### 3. Run the setup wizard
Open your browser and visit:
```
http://localhost/New_Gungun/setup.php
```
Click **Run Setup** — this creates the database, tables, and seeds demo data.

### 4. Login
```
http://localhost/New_Gungun/login.php
```

---

## Default Accounts

| Role | Username | Password |
|------|----------|----------|
| Election Commission Admin | `admin` | `Admin@123` |
| Demo Voter (Science Faculty) | `voter1` | `Admin@123` |

> **OTP in Dev Mode:** Since `DEV_MODE = true` in config, the OTP is displayed on-screen instead of being sent via email. You can copy it directly.

---

## Features

### Voter
- Secure login with two-factor authentication (password + OTP)
- View active election ballot for their constituency
- Cast exactly one vote (enforced at DB level with transactions)
- View election results after polls close
- Vote confirmation page

### Election Commission Admin
- Dashboard with live KPIs (voters, votes cast, turnout %)
- Create and manage elections (draft → active → closed)
- Manage constituencies per election
- Register and manage voter accounts
- Register candidates with photo upload
- Full audit log of all system events

---

## Directory Structure

```
New_Gungun/
├── config/
│   ├── config.php          ← App & DB configuration
│   └── database.php        ← PDO singleton
├── models/
│   ├── UserModel.php
│   ├── VoterModel.php
│   ├── ElectionModel.php
│   ├── ConstituencyModel.php
│   ├── CandidateModel.php
│   ├── VoteModel.php
│   ├── OtpModel.php
│   └── AuditModel.php
├── includes/
│   ├── auth.php            ← Session & auth helpers
│   ├── header.php          ← Shared navbar/head
│   └── footer.php          ← Shared footer
├── admin/
│   ├── index.php           ← Admin dashboard
│   ├── elections.php       ← Election CRUD
│   ├── constituencies.php  ← Constituency CRUD
│   ├── voters.php          ← Voter management
│   ├── candidates.php      ← Candidate management
│   └── audit_log.php       ← Audit trail viewer
├── assets/
│   ├── css/style.css
│   └── js/main.js
├── uploads/candidates/     ← Candidate photos
├── index.php               ← Entry point (redirect)
├── login.php               ← Login page
├── verify_otp.php          ← OTP verification
├── ballot.php              ← Voting ballot
├── submit_vote.php         ← Vote processing
├── confirmation.php        ← Vote confirmation
├── results.php             ← Election results
├── logout.php
├── setup.php               ← One-time DB setup wizard
├── database.sql            ← Full DB schema + seed data
└── .htaccess               ← Security rules
```

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `users` | All accounts (admin, voter) |
| `elections` | Election events |
| `constituencies` | Constituencies per election |
| `voters` | Voter-specific data & constituency assignment |
| `candidates` | Candidates per election + constituency |
| `votes` | Vote records (voter_hash for ballot secrecy) |
| `otp_tokens` | OTP storage with expiry |
| `audit_log` | Immutable event log |

---

## Security Features

- **bcrypt** password hashing (cost factor 12)
- **SHA-256 voter hash** in votes table (ballot secrecy)
- **CSRF tokens** on all vote submission forms
- **Two-factor auth** (password + time-limited OTP)
- **Database transactions** for atomic vote recording (prevents race conditions)
- **Session regeneration** after login
- **Session timeout** (30 minutes of inactivity)
- **Prepared statements** everywhere (SQL injection prevention)
- **Role-based access control** (ec_admin / constituency_admin / voter)
- **Audit log** for all system events

---

## Production Notes

1. Set `DEV_MODE = false` in `config/config.php` and configure PHPMailer for real OTP delivery
2. Enable HTTPS and uncomment HSTS in `.htaccess`
3. Delete or password-protect `setup.php` after first run
4. Set appropriate file permissions on `uploads/` directory
5. Configure a strong MySQL password in `config/config.php`
