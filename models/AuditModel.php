<?php
require_once __DIR__ . '/../config/database.php';

class AuditModel {
    public static function log(
        ?int $userId,
        string $action,
        string $details = '',
        string $ip = ''
    ): void {
        try {
            $db   = Database::getConnection();
            $stmt = $db->prepare(
                'INSERT INTO audit_log (user_id, action, details, ip_address)
                 VALUES (?, ?, ?, ?)'
            );
            $ip = $ip ?: ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
            $stmt->execute([$userId, $action, $details, $ip]);
        } catch (Exception $e) {
            // Audit failures must not crash the application
            error_log('AuditModel::log failed: ' . $e->getMessage());
        }
    }

    public static function getAll(int $limit = 200): array {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'SELECT al.*, u.username, u.full_name
             FROM audit_log al
             LEFT JOIN users u ON al.user_id = u.user_id
             ORDER BY al.created_at DESC
             LIMIT ?'
        );
        $stmt->execute([$limit]);
        return $stmt->fetchAll();
    }
}
