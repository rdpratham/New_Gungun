<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/VoterModel.php';
require_once __DIR__ . '/models/ElectionModel.php';
require_once __DIR__ . '/models/CandidateModel.php';
require_once __DIR__ . '/models/VoteModel.php';
require_once __DIR__ . '/models/AuditModel.php';

requireRole('voter');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ' . BASE_URL . '/ballot.php'); exit;
}

// CSRF check
if (!hash_equals($_SESSION['csrf_token'] ?? '', $_POST['csrf_token'] ?? '')) {
    flashSet('error', 'Invalid request. Please try again.');
    header('Location: ' . BASE_URL . '/ballot.php'); exit;
}

$userId      = currentUserId();
$candidateId = (int) ($_POST['candidate_id'] ?? 0);
$electionId  = (int) ($_POST['election_id']  ?? 0);

$voter = VoterModel::findByUserId($userId);
if (!$voter || !$candidateId || !$electionId) {
    flashSet('error', 'Invalid submission. Please try again.');
    header('Location: ' . BASE_URL . '/ballot.php'); exit;
}

// Verify active election
$election = ElectionModel::getActiveForConstituency((int) $voter['constituency_id']);
if (!$election || (int) $election['election_id'] !== $electionId) {
    flashSet('error', 'No active election found.');
    header('Location: ' . BASE_URL . '/ballot.php'); exit;
}

// Already voted?
if (VoterModel::hasVotedInElection((int) $voter['voter_id'], $electionId)) {
    flashSet('warning', 'You have already cast your vote.');
    header('Location: ' . BASE_URL . '/ballot.php'); exit;
}

// Validate candidate belongs to voter's constituency
$candidate = CandidateModel::findById($candidateId);
if (!$candidate
    || (int) $candidate['constituency_id'] !== (int) $voter['constituency_id']
    || (int) $candidate['election_id']     !== $electionId) {
    flashSet('error', 'Invalid candidate selection.');
    header('Location: ' . BASE_URL . '/ballot.php'); exit;
}

try {
    VoteModel::cast((int) $voter['voter_id'], $candidateId, $electionId);
    AuditModel::log($userId, 'VOTE_CAST', "Election:{$electionId} Constituency:{$voter['constituency_id']}");

    // Store confirmation info in session (no candidate name for secrecy in prod; shown for UX)
    $_SESSION['last_vote_confirmation'] = [
        'election_title'    => $election['title'],
        'constituency_name' => $voter['constituency_name'],
        'voted_at'          => date('d M Y, h:i:s A'),
    ];
    unset($_SESSION['csrf_token']);
    header('Location: ' . BASE_URL . '/confirmation.php'); exit;
} catch (Exception $e) {
    AuditModel::log($userId, 'VOTE_FAILED', $e->getMessage());
    flashSet('error', 'Vote submission failed. You may have already voted, or a technical error occurred.');
    header('Location: ' . BASE_URL . '/ballot.php'); exit;
}
