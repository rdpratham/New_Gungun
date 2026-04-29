<?php
require_once __DIR__ . '/../config/database.php';

class ConstituencyModel {
    public static function findById(int $id): ?array {
        $db   = Database::getConnection();
        $stmt = $db->prepare('SELECT * FROM constituencies WHERE constituency_id = ? LIMIT 1');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public static function getByElection(int $electionId): array {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'SELECT * FROM constituencies WHERE election_id = ? ORDER BY name'
        );
        $stmt->execute([$electionId]);
        return $stmt->fetchAll();
    }

    public static function getAll(): array {
        $db   = Database::getConnection();
        $stmt = $db->query(
            'SELECT c.*, e.title AS election_title
             FROM constituencies c
             JOIN elections e ON c.election_id = e.election_id
             ORDER BY e.title, c.name'
        );
        return $stmt->fetchAll();
    }

    public static function create(string $name, int $electionId): int {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'INSERT INTO constituencies (name, election_id) VALUES (?, ?)'
        );
        $stmt->execute([$name, $electionId]);
        return (int) $db->lastInsertId();
    }

    public static function delete(int $id): void {
        $db = Database::getConnection();
        $db->prepare('DELETE FROM constituencies WHERE constituency_id = ?')->execute([$id]);
    }
}
