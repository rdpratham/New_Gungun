<?php
/**
 * GeminiService — wraps the Gemini REST API with 429 quota-error handling.
 *
 * On a 429 response it retries up to MAX_RETRIES times using exponential
 * backoff (1 s → 2 s → 4 s). After all retries are exhausted it throws a
 * GeminiQuotaException so callers can show a graceful fallback message instead
 * of a raw API error.
 *
 * Usage:
 *   $svc = new GeminiService(getenv('GEMINI_API_KEY'));
 *   $text = $svc->generate('Summarise these results: …');
 */

class GeminiQuotaException extends RuntimeException {}
class GeminiApiException  extends RuntimeException {}

class GeminiService {

    private const API_URL     = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    private const MAX_RETRIES = 3;

    public function __construct(private readonly string $apiKey) {}

    /**
     * Send a prompt to Gemini and return the generated text.
     *
     * @throws GeminiQuotaException when the quota is exhausted after all retries
     * @throws GeminiApiException   on any other non-recoverable API error
     */
    public function generate(string $prompt): string {
        $payload = json_encode([
            'contents' => [
                ['parts' => [['text' => $prompt]]]
            ]
        ]);

        $attempt   = 0;
        $waitSecs  = 1;

        while ($attempt < self::MAX_RETRIES) {
            [$status, $body] = $this->post($payload);

            if ($status === 200) {
                return $this->extractText($body);
            }

            if ($status === 429) {
                $attempt++;
                if ($attempt >= self::MAX_RETRIES) {
                    throw new GeminiQuotaException(
                        'Gemini API quota exceeded. Please check your plan at https://ai.dev/rate-limit.',
                        429
                    );
                }
                sleep($waitSecs);
                $waitSecs *= 2;
                continue;
            }

            // Non-retryable error
            $err = json_decode($body, true)['error']['message'] ?? "HTTP $status";
            throw new GeminiApiException("Gemini API error: $err", $status);
        }

        // Should be unreachable
        throw new GeminiQuotaException('Gemini API quota exceeded after retries.', 429);
    }

    // ── private helpers ──────────────────────────────────────────────────────

    /** @return array{int, string} [httpStatusCode, responseBody] */
    private function post(string $payload): array {
        $url = self::API_URL . '?key=' . urlencode($this->apiKey);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT        => 30,
        ]);

        $body   = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return [$status, $body ?: ''];
    }

    private function extractText(string $body): string {
        $data = json_decode($body, true);
        return $data['candidates'][0]['content']['parts'][0]['text']
            ?? throw new GeminiApiException('Unexpected Gemini response format.');
    }
}
