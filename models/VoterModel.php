<?php
require_once __DIR__ . '/../config/database.php';

class VoterModel {
    public static function findByUserId(int $userId): ?array {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'SELECT v.*, u.full_name, u.email, u.mobile, u.username, u.is_active,
                    c.name AS constituency_name, c.election_id
             FROM voters v
             JOIN users u ON v.user_id = u.user_id
             JOIN constituencies c ON v.constituency_id = c.constituency_id
             WHERE v.user_id = ? LIMIT 1'
        );
        $stmt->execute([$userId]);
        return $stmt->fetch() ?: null;
    }

    public static function findByVoterCard(string $cardNo): ?array {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'SELECT v.*, u.full_name, u.email, u.mobile, u.username, u.password_hash, u.is_active,
                    c.name AS constituency_name, c.election_id
             FROM voters v
             JOIN users u ON v.user_id = u.user_id
             JOIN constituencies c ON v.constituency_id = c.constituency_id
             WHERE v.voter_card_no = ? LIMIT 1'
        );
        $stmt->execute([$cardNo]);
        return $stmt->fetch() ?: null;
    }

    public static function create(int $userId, string $voterCard, int $constituencyId): int {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'INSERT INTO voters (user_id, voter_card_no, constituency_id) VALUES (?, ?, ?)'
        );
        $stmt->execute([$userId, $voterCard, $constituencyId]);
        return (int) $db->lastInsertId();
    }

    public static function markVoted(int $voterId): void {
        $db = Database::getConnection();
        $db->prepare('UPDATE voters SET has_voted = 1 WHERE voter_id = ?')
           ->execute([$voterId]);
    }

    public static function hasVotedInElection(int $voterId, int $electionId): bool {
        $db   = Database::getConnection();
        $hash = self::voterHash($voterId, $electionId);
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM votes WHERE voter_hash = ? AND election_id = ?'
        );
        $stmt->execute([$hash, $electionId]);
        return (int) $stmt->fetchColumn() > 0;
    }

    public static function voterHash(int $voterId, int $electionId): string {
        return hash('sha256', $voterId . ':' . $electionId . ':ovs_salt');
    }

    public static function getAll(): array {
        $db   = Database::getConnection();
        $stmt = $db->query(
            'SELECT v.*, u.full_name, u.email, u.mobile, u.username, u.is_active,
                    c.name AS constituency_name
             FROM voters v
             JOIN users u ON v.user_id = u.user_id
             JOIN constituencies c ON v.constituency_id = c.constituency_id
             ORDER BY v.voter_id DESC'
        );
        return $stmt->fetchAll();
    }

    public static function delete(int $voterId): void {
        $db = Database::getConnection();
        $db->prepare('DELETE FROM voters WHERE voter_id = ?')->execute([$voterId]);
    }
}
