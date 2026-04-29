<?php
require_once __DIR__ . '/../config/database.php';

class CandidateModel {
    public static function findById(int $id): ?array {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'SELECT c.*, co.name AS constituency_name
             FROM candidates c
             JOIN constituencies co ON c.constituency_id = co.constituency_id
             WHERE c.candidate_id = ? LIMIT 1'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public static function getByConstituencyAndElection(
        int $constituencyId,
        int $electionId
    ): array {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'SELECT * FROM candidates
             WHERE constituency_id = ? AND election_id = ?
             ORDER BY name'
        );
        $stmt->execute([$constituencyId, $electionId]);
        return $stmt->fetchAll();
    }

    public static function getByElection(int $electionId): array {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'SELECT c.*, co.name AS constituency_name
             FROM candidates c
             JOIN constituencies co ON c.constituency_id = co.constituency_id
             WHERE c.election_id = ?
             ORDER BY co.name, c.name'
        );
        $stmt->execute([$electionId]);
        return $stmt->fetchAll();
    }

    public static function getResults(int $electionId): array {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'SELECT c.candidate_id, c.name, c.party, c.photo, c.constituency_id,
                    co.name AS constituency_name,
                    COUNT(v.vote_id) AS vote_count
             FROM candidates c
             LEFT JOIN votes v ON v.candidate_id = c.candidate_id AND v.election_id = c.election_id
             JOIN constituencies co ON c.constituency_id = co.constituency_id
             WHERE c.election_id = ?
             GROUP BY c.candidate_id
             ORDER BY co.name, vote_count DESC'
        );
        $stmt->execute([$electionId]);
        return $stmt->fetchAll();
    }

    public static function create(array $data): int {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'INSERT INTO candidates (name, party, bio, photo, constituency_id, election_id)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $data['name'],
            $data['party']  ?? '',
            $data['bio']    ?? '',
            $data['photo']  ?? null,
            $data['constituency_id'],
            $data['election_id'],
        ]);
        return (int) $db->lastInsertId();
    }

    public static function update(int $id, array $data): void {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'UPDATE candidates SET name=?, party=?, bio=?, constituency_id=?
             WHERE candidate_id=?'
        );
        $stmt->execute([
            $data['name'],
            $data['party']           ?? '',
            $data['bio']             ?? '',
            $data['constituency_id'],
            $id,
        ]);
        if (!empty($data['photo'])) {
            $db->prepare('UPDATE candidates SET photo=? WHERE candidate_id=?')
               ->execute([$data['photo'], $id]);
        }
    }

    public static function delete(int $id): void {
        $db = Database::getConnection();
        $db->prepare('DELETE FROM candidates WHERE candidate_id = ?')->execute([$id]);
    }
}
