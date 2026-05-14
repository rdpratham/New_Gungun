<?php
require_once __DIR__ . '/../config/database.php';

class EmployeeModel {
    public static function findById(int $id): ?array {
        $db   = Database::getConnection();
        $stmt = $db->prepare('SELECT * FROM employees WHERE employee_id = ? LIMIT 1');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public static function findByEmail(string $email): ?array {
        $db   = Database::getConnection();
        $stmt = $db->prepare('SELECT * FROM employees WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        return $stmt->fetch() ?: null;
    }

    public static function findByCode(string $code): ?array {
        $db   = Database::getConnection();
        $stmt = $db->prepare('SELECT * FROM employees WHERE employee_code = ? LIMIT 1');
        $stmt->execute([$code]);
        return $stmt->fetch() ?: null;
    }

    public static function getAll(bool $activeOnly = false): array {
        $db  = Database::getConnection();
        $sql = 'SELECT * FROM employees' . ($activeOnly ? ' WHERE is_active = 1' : '')
             . ' ORDER BY full_name ASC';
        return $db->query($sql)->fetchAll();
    }

    public static function getByDepartment(string $dept): array {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'SELECT * FROM employees WHERE department = ? AND is_active = 1 ORDER BY full_name'
        );
        $stmt->execute([$dept]);
        return $stmt->fetchAll();
    }

    public static function getDepartments(): array {
        $db = Database::getConnection();
        return $db->query(
            'SELECT DISTINCT department FROM employees WHERE is_active = 1 ORDER BY department'
        )->fetchAll(PDO::FETCH_COLUMN);
    }

    public static function create(array $data): int {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'INSERT INTO employees
                (employee_code, full_name, email, password_hash, department,
                 designation, mobile, join_date, role, shift_start, shift_end)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $data['employee_code'],
            $data['full_name'],
            $data['email'],
            password_hash($data['password'], PASSWORD_BCRYPT, ['cost' => 12]),
            $data['department'],
            $data['designation'],
            $data['mobile']      ?? null,
            $data['join_date']   ?? date('Y-m-d'),
            $data['role']        ?? 'employee',
            $data['shift_start'] ?? DEFAULT_SHIFT_START,
            $data['shift_end']   ?? DEFAULT_SHIFT_END,
        ]);
        return (int) $db->lastInsertId();
    }

    public static function update(int $id, array $data): void {
        $db     = Database::getConnection();
        $fields = [];
        $vals   = [];
        foreach (['full_name','email','department','designation','mobile',
                  'join_date','role','shift_start','shift_end','is_active'] as $f) {
            if (array_key_exists($f, $data)) {
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
        $db->prepare('UPDATE employees SET ' . implode(', ', $fields) . ' WHERE employee_id = ?')
           ->execute($vals);
    }

    public static function delete(int $id): void {
        $db = Database::getConnection();
        $db->prepare('DELETE FROM employees WHERE employee_id = ?')->execute([$id]);
    }

    public static function nextCode(): string {
        $db  = Database::getConnection();
        $row = $db->query(
            "SELECT employee_code FROM employees ORDER BY employee_id DESC LIMIT 1"
        )->fetch();
        if (!$row) return 'EMP001';
        $num = (int) substr($row['employee_code'], 3) + 1;
        return 'EMP' . str_pad($num, 3, '0', STR_PAD_LEFT);
    }

    public static function count(bool $activeOnly = true): int {
        $db  = Database::getConnection();
        $sql = 'SELECT COUNT(*) FROM employees' . ($activeOnly ? ' WHERE is_active = 1' : '');
        return (int) $db->query($sql)->fetchColumn();
    }
}
