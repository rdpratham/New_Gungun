<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/config.php';

class AttendanceModel {

    // ── Check-in ─────────────────────────────────────────────────────────────
    public static function checkIn(int $employeeId, string $shiftStart): array {
        $db   = Database::getConnection();
        $now  = date('Y-m-d H:i:s');
        $date = date('Y-m-d');

        // Check if already checked in today
        $existing = self::getTodayRecord($employeeId);
        if ($existing) {
            return ['success' => false, 'message' => 'Already checked in today.'];
        }

        // Determine status: Late if past shift_start + grace
        $shiftStartTs  = strtotime($date . ' ' . $shiftStart);
        $graceTs       = $shiftStartTs + (LATE_GRACE_MINUTES * 60);
        $status        = (time() > $graceTs) ? 'late' : 'present';

        $stmt = $db->prepare(
            'INSERT INTO attendance (employee_id, date, check_in, status)
             VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$employeeId, $date, $now, $status]);

        return [
            'success'  => true,
            'status'   => $status,
            'check_in' => $now,
            'message'  => $status === 'late'
                ? 'Checked in (marked Late).'
                : 'Checked in successfully.',
        ];
    }

    // ── Check-out ────────────────────────────────────────────────────────────
    public static function checkOut(int $employeeId): array {
        $db     = Database::getConnection();
        $record = self::getTodayRecord($employeeId);

        if (!$record) {
            return ['success' => false, 'message' => 'No check-in found for today.'];
        }
        if ($record['check_out']) {
            return ['success' => false, 'message' => 'Already checked out today.'];
        }

        $now       = date('Y-m-d H:i:s');
        $checkIn   = new DateTime($record['check_in']);
        $checkOut  = new DateTime($now);
        $diffHours = ($checkOut->getTimestamp() - $checkIn->getTimestamp()) / 3600;
        $diffHours = round($diffHours, 2);

        // Upgrade status based on hours worked
        $status = $record['status'];
        if ($diffHours < HALF_DAY_HOURS && $status !== 'late') {
            $status = 'half_day';
        }

        $stmt = $db->prepare(
            'UPDATE attendance
             SET check_out = ?, work_hours = ?, status = ?
             WHERE attendance_id = ?'
        );
        $stmt->execute([$now, $diffHours, $status, $record['attendance_id']]);

        return [
            'success'    => true,
            'check_out'  => $now,
            'work_hours' => $diffHours,
            'status'     => $status,
            'message'    => "Checked out. Worked {$diffHours}h.",
        ];
    }

    // ── Today's record for an employee ────────────────────────────────────────
    public static function getTodayRecord(int $employeeId): ?array {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'SELECT * FROM attendance WHERE employee_id = ? AND date = ? LIMIT 1'
        );
        $stmt->execute([$employeeId, date('Y-m-d')]);
        return $stmt->fetch() ?: null;
    }

    // ── Employee's own history ────────────────────────────────────────────────
    public static function getByEmployee(int $employeeId, ?string $from = null,
                                         ?string $to = null): array {
        $db  = Database::getConnection();
        $sql = 'SELECT * FROM attendance WHERE employee_id = ?';
        $params = [$employeeId];
        if ($from) { $sql .= ' AND date >= ?'; $params[] = $from; }
        if ($to)   { $sql .= ' AND date <= ?'; $params[] = $to;   }
        $sql .= ' ORDER BY date DESC';
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    // ── All attendance (admin) ────────────────────────────────────────────────
    public static function getAll(?string $date = null, ?string $dept = null,
                                  ?string $from = null, ?string $to = null): array {
        $db   = Database::getConnection();
        $sql  = 'SELECT a.*, e.full_name, e.employee_code, e.department, e.designation
                 FROM attendance a
                 JOIN employees e ON e.employee_id = a.employee_id
                 WHERE 1=1';
        $params = [];
        if ($date) { $sql .= ' AND a.date = ?';        $params[] = $date; }
        if ($from) { $sql .= ' AND a.date >= ?';       $params[] = $from; }
        if ($to)   { $sql .= ' AND a.date <= ?';       $params[] = $to;   }
        if ($dept) { $sql .= ' AND e.department = ?';  $params[] = $dept; }
        $sql .= ' ORDER BY a.date DESC, e.full_name ASC';
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    // ── Today overview (admin dashboard) ─────────────────────────────────────
    public static function getTodaySummary(): array {
        $db   = Database::getConnection();
        $date = date('Y-m-d');
        $row  = $db->prepare(
            "SELECT
                COUNT(*)                                         AS total,
                SUM(CASE WHEN status='present'  THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN status='late'     THEN 1 ELSE 0 END) AS late,
                SUM(CASE WHEN status='half_day' THEN 1 ELSE 0 END) AS half_day,
                SUM(CASE WHEN status='on_leave' THEN 1 ELSE 0 END) AS on_leave,
                SUM(CASE WHEN check_out IS NULL
                          AND check_in IS NOT NULL THEN 1 ELSE 0 END) AS still_in
             FROM attendance WHERE date = ?"
        );
        $row->execute([$date]);
        return $row->fetch();
    }

    // ── Monthly summary per employee ─────────────────────────────────────────
    public static function getMonthlyStats(int $employeeId, string $yearMonth): array {
        $db   = Database::getConnection();
        $from = $yearMonth . '-01';
        $to   = date('Y-m-t', strtotime($from));
        $stmt = $db->prepare(
            "SELECT
                COUNT(*)                                              AS total_days,
                SUM(CASE WHEN status='present'  THEN 1 ELSE 0 END)  AS present,
                SUM(CASE WHEN status='late'     THEN 1 ELSE 0 END)  AS late,
                SUM(CASE WHEN status='half_day' THEN 1 ELSE 0 END)  AS half_day,
                SUM(CASE WHEN status='on_leave' THEN 1 ELSE 0 END)  AS on_leave,
                SUM(CASE WHEN status='absent'   THEN 1 ELSE 0 END)  AS absent,
                ROUND(SUM(work_hours), 2)                            AS total_hours,
                ROUND(AVG(work_hours), 2)                            AS avg_hours
             FROM attendance
             WHERE employee_id = ? AND date BETWEEN ? AND ?"
        );
        $stmt->execute([$employeeId, $from, $to]);
        return $stmt->fetch();
    }

    // ── Admin: monthly report across all employees ────────────────────────────
    public static function getMonthlyReport(string $yearMonth, ?string $dept = null): array {
        $db   = Database::getConnection();
        $from = $yearMonth . '-01';
        $to   = date('Y-m-t', strtotime($from));
        $sql  = "SELECT
                     e.employee_code, e.full_name, e.department,
                     COUNT(a.attendance_id)                               AS days_recorded,
                     SUM(CASE WHEN a.status='present'  THEN 1 ELSE 0 END) AS present,
                     SUM(CASE WHEN a.status='late'     THEN 1 ELSE 0 END) AS late,
                     SUM(CASE WHEN a.status='half_day' THEN 1 ELSE 0 END) AS half_day,
                     SUM(CASE WHEN a.status='on_leave' THEN 1 ELSE 0 END) AS on_leave,
                     SUM(CASE WHEN a.status='absent'   THEN 1 ELSE 0 END) AS absent,
                     ROUND(SUM(a.work_hours), 2)                          AS total_hours
                 FROM employees e
                 LEFT JOIN attendance a
                        ON a.employee_id = e.employee_id
                        AND a.date BETWEEN ? AND ?
                 WHERE e.is_active = 1";
        $params = [$from, $to];
        if ($dept) { $sql .= ' AND e.department = ?'; $params[] = $dept; }
        $sql .= ' GROUP BY e.employee_id ORDER BY e.department, e.full_name';
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    // ── Admin: manually update a record ──────────────────────────────────────
    public static function upsert(int $employeeId, string $date, array $data): void {
        $db       = Database::getConnection();
        $existing = $db->prepare(
            'SELECT attendance_id FROM attendance WHERE employee_id = ? AND date = ?'
        );
        $existing->execute([$employeeId, $date]);
        $row = $existing->fetch();

        if ($row) {
            $sets   = [];
            $vals   = [];
            foreach (['check_in','check_out','status','work_hours','notes'] as $f) {
                if (array_key_exists($f, $data)) {
                    $sets[] = "$f = ?";
                    $vals[] = $data[$f];
                }
            }
            if (empty($sets)) return;
            $vals[] = $row['attendance_id'];
            $db->prepare('UPDATE attendance SET ' . implode(', ', $sets) . ' WHERE attendance_id = ?')
               ->execute($vals);
        } else {
            $db->prepare(
                'INSERT INTO attendance (employee_id, date, check_in, check_out, status, work_hours, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $employeeId, $date,
                $data['check_in']   ?? null,
                $data['check_out']  ?? null,
                $data['status']     ?? 'present',
                $data['work_hours'] ?? 0,
                $data['notes']      ?? null,
            ]);
        }
    }
}
