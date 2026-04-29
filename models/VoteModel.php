<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/VoterModel.php';

class VoteModel {
    /**
     * Record a vote atomically using a DB transaction.
     * Returns true on success, throws on failure.
     */
    public static function cast(int $voterId, int $candidateId, int $electionId): bool {
        $db   = Database::getConnection();
        $hash = VoterModel::voterHash($voterId, $electionId);

        $db->beginTransaction();
        try {
            $stmt = $db->prepare(
                'INSERT INTO votes (voter_hash, candidate_id, election_id)
                 VALUES (?, ?, ?)'
            );
            $stmt->execute([$hash, $candidateId, $electionId]);

            $db->prepare('UPDATE voters SET has_voted = 1 WHERE voter_id = ?')
               ->execute([$voterId]);

            $db->commit();
            return true;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public static function countForElection(int $electionId): int {
        $db   = Database::getConnection();
        $stmt = $db->prepare('SELECT COUNT(*) FROM votes WHERE election_id = ?');
        $stmt->execute([$electionId]);
        return (int) $stmt->fetchColumn();
    }
}
