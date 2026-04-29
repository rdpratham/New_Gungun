<?php
require_once __DIR__ . '/../config/database.php';

class ElectionModel {
    public static function findById(int $id): ?array {
        $db   = Database::getConnection();
        $stmt = $db->prepare('SELECT * FROM elections WHERE election_id = ? LIMIT 1');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public static function getActiveForConstituency(int $constituencyId): ?array {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'SELECT e.* FROM elections e
             JOIN constituencies c ON c.election_id = e.election_id
             WHERE c.constituency_id = ?
               AND e.status = "active"
               AND e.start_time <= NOW()
               AND e.end_time   >= NOW()
             LIMIT 1'
        );
        $stmt->execute([$constituencyId]);
        return $stmt->fetch() ?: null;
    }

    public static function getAll(): array {
        $db   = Database::getConnection();
        $stmt = $db->query('SELECT * FROM elections ORDER BY created_at DESC');
        return $stmt->fetchAll();
    }

    public static function create(array $data): int {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'INSERT INTO elections (title, description, start_time, end_time, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $data['title'],
            $data['description'] ?? '',
            $data['start_time'],
            $data['end_time'],
            $data['status'] ?? 'draft',
            $data['created_by'],
        ]);
        return (int) $db->lastInsertId();
    }

    public static function update(int $id, array $data): void {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'UPDATE elections
             SET title=?, description=?, start_time=?, end_time=?, status=?
             WHERE election_id=?'
        );
        $stmt->execute([
            $data['title'],
            $data['description'] ?? '',
            $data['start_time'],
            $data['end_time'],
            $data['status'],
            $id,
        ]);
    }

    public static function updateStatus(int $id, string $status): void {
        $db = Database::getConnection();
        $db->prepare('UPDATE elections SET status=? WHERE election_id=?')
           ->execute([$status, $id]);
    }

    public static function delete(int $id): void {
        $db = Database::getConnection();
        $db->prepare('DELETE FROM elections WHERE election_id=?')->execute([$id]);
    }

    public static function getStats(int $electionId): array {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'SELECT
               (SELECT COUNT(*) FROM voters v
                JOIN constituencies c ON v.constituency_id = c.constituency_id
                WHERE c.election_id = ?) AS total_voters,
               (SELECT COUNT(*) FROM votes WHERE election_id = ?) AS total_votes'
        );
        $stmt->execute([$electionId, $electionId]);
        return $stmt->fetch();
    }
}
