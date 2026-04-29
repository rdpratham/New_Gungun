<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/config.php';

class OtpModel {
    public static function generate(int $userId): string {
        $db  = Database::getConnection();
        $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        // Invalidate previous OTPs for this user
        $db->prepare('UPDATE otp_tokens SET used = 1 WHERE user_id = ?')
           ->execute([$userId]);

        $stmt = $db->prepare(
            'INSERT INTO otp_tokens (user_id, otp_hash, expires_at)
             VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))'
        );
        $stmt->execute([
            $userId,
            password_hash($otp, PASSWORD_BCRYPT),
            OTP_EXPIRY,
        ]);
        return $otp;
    }

    public static function verify(int $userId, string $submittedOtp): bool {
        $db   = Database::getConnection();
        $stmt = $db->prepare(
            'SELECT * FROM otp_tokens
             WHERE user_id = ? AND used = 0 AND expires_at > NOW()
             ORDER BY otp_id DESC LIMIT 1'
        );
        $stmt->execute([$userId]);
        $row = $stmt->fetch();

        if (!$row) return false;

        if (password_verify($submittedOtp, $row['otp_hash'])) {
            $db->prepare('UPDATE otp_tokens SET used = 1 WHERE otp_id = ?')
               ->execute([$row['otp_id']]);
            return true;
        }
        return false;
    }
}
