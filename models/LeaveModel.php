<?php
require_once __DIR__ . '/../config/database.php';

class LeaveModel {

    public static function create(array $data): int {
        $db   = Database::getConnection();
        $days = self::countDays($data['start_date'], $data['end_date']);
        $stmt = $db->prepare(
            'INSERT INTO leaves (employee_id, leave_type, start_date, end_date, days_count, reason)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $data['employee_id'],
            $data['leave_type'],
            $data['start_date'],
            $data['end_date'],
            $days,
            $data['reason'],
        ]);
        return (int) $db->lastInsertId();
    }

    public static function getByEmployee(int $employeeId): array {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'SELECT * FROM leaves WHERE employee_id = ? ORDER BY created_at DESC'
        );
        $stmt->execute([$employeeId]);
        return $stmt->fetchAll();
    }

    public static function getAll(?string $status = null): array {
        $db   = Database::getConnection();
        $sql  = 'SELECT l.*, e.full_name, e.employee_code, e.department
                 FROM leaves l
                 JOIN employees e ON e.employee_id = l.employee_id';
        $params = [];
        if ($status) {
            $sql .= ' WHERE l.status = ?';
            $params[] = $status;
        }
        $sql .= ' ORDER BY l.created_at DESC';
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public static function findById(int $id): ?array {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'SELECT l.*, e.full_name, e.employee_code, e.department
             FROM leaves l
             JOIN employees e ON e.employee_id = l.employee_id
             WHERE l.leave_id = ? LIMIT 1'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public static function review(int $leaveId, int $reviewerId,
                                  string $action, string $note = ''): bool {
        if (!in_array($action, ['approved', 'rejected'])) return false;
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'UPDATE leaves
             SET status = ?, reviewed_by = ?, reviewer_note = ?, reviewed_at = datetime("now")
             WHERE leave_id = ? AND status = "pending"'
        );
        $stmt->execute([$action, $reviewerId, $note, $leaveId]);
        return $stmt->rowCount() > 0;
    }

    // Mark attendance as on_leave for approved leave dates
    public static function markAttendance(int $leaveId): void {
        require_once __DIR__ . '/AttendanceModel.php';
        $leave = self::findById($leaveId);
        if (!$leave || $leave['status'] !== 'approved') return;

        $start = new DateTime($leave['start_date']);
        $end   = new DateTime($leave['end_date']);
        $end->modify('+1 day');

        for ($d = clone $start; $d < $end; $d->modify('+1 day')) {
            $dateStr = $d->format('Y-m-d');
            if ($d->format('N') >= 6) continue; // skip weekends
            AttendanceModel::upsert($leave['employee_id'], $dateStr, [
                'status' => 'on_leave',
                'notes'  => ucfirst($leave['leave_type']) . ' leave',
            ]);
        }
    }

    public static function pendingCount(): int {
        $db = Database::getConnection();
        return (int) $db->query(
            "SELECT COUNT(*) FROM leaves WHERE status = 'pending'"
        )->fetchColumn();
    }

    public static function getBalanceSummary(int $employeeId, int $year): array {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            "SELECT leave_type, SUM(days_count) AS days_used
             FROM leaves
             WHERE employee_id = ? AND status = 'approved'
               AND strftime('%Y', start_date) = ?
             GROUP BY leave_type"
        );
        $stmt->execute([$employeeId, (string) $year]);
        $rows = $stmt->fetchAll();

        $allowances = ['sick' => 7, 'casual' => 10, 'earned' => 15, 'unpaid' => 999];
        $result     = [];
        foreach ($allowances as $type => $allowed) {
            $used = 0;
            foreach ($rows as $r) {
                if ($r['leave_type'] === $type) $used = (int)$r['days_used'];
            }
            $result[$type] = [
                'allowed'   => $allowed,
                'used'      => $used,
                'remaining' => max(0, $allowed - $used),
            ];
        }
        return $result;
    }

    private static function countDays(string $start, string $end): int {
        $s = new DateTime($start);
        $e = new DateTime($end);
        $e->modify('+1 day');
        $days = 0;
        for ($d = clone $s; $d < $e; $d->modify('+1 day')) {
            if ($d->format('N') < 6) $days++;  // skip weekends
        }
        return max(1, $days);
    }
}
