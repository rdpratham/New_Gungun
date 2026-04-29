<?php
require_once __DIR__ . '/../config/database.php';

class UserModel {
    public static function findById(int $id): ?array {
        $db   = Database::getConnection();
        $stmt = $db->prepare('SELECT * FROM users WHERE user_id = ? LIMIT 1');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public static function findByUsername(string $username): ?array {
        $db   = Database::getConnection();
        $stmt = $db->prepare('SELECT * FROM users WHERE username = ? LIMIT 1');
        $stmt->execute([$username]);
        return $stmt->fetch() ?: null;
    }

    public static function findByEmail(string $email): ?array {
        $db   = Database::getConnection();
        $stmt = $db->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        return $stmt->fetch() ?: null;
    }

    public static function create(array $data): int {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'INSERT INTO users (username, password_hash, full_name, email, mobile, role)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $data['username'],
            password_hash($data['password'], PASSWORD_BCRYPT, ['cost' => 12]),
            $data['full_name'],
            $data['email'],
            $data['mobile'],
            $data['role'] ?? 'voter',
        ]);
        return (int) $db->lastInsertId();
    }

    public static function update(int $id, array $data): void {
        $db     = Database::getConnection();
        $fields = [];
        $vals   = [];
        foreach (['full_name','email','mobile','role','is_active'] as $f) {
            if (isset($data[$f])) {
                $fields[] = "$f = ?";
                $vals[]   = $data[$f];
            }
        }
        if (!empty($data['password'])) {
            $fields[] = 'password_hash = ?';
            $vals[]   = password_hash($data['password'], PASSWORD_BCRYPT, ['cost' => 12]);
        }
        if (empty($fields)) return;
        $vals[] = $id;
        $db->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE user_id = ?')
           ->execute($vals);
    }

    public static function getAll(string $role = ''): array {
        $db = Database::getConnection();
        if ($role) {
            $stmt = $db->prepare('SELECT * FROM users WHERE role = ? ORDER BY created_at DESC');
            $stmt->execute([$role]);
        } else {
            $stmt = $db->query('SELECT * FROM users ORDER BY created_at DESC');
        }
        return $stmt->fetchAll();
    }

    public static function delete(int $id): void {
        $db = Database::getConnection();
        $db->prepare('DELETE FROM users WHERE user_id = ?')->execute([$id]);
    }
}
