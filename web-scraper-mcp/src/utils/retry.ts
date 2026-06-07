import { logger } from "./logger.js";

export interface RetryOptions {
  retries?: number;
  /** Base delay in ms for exponential backoff. */
  baseDelayMs?: number;
  /** Maximum delay cap in ms. */
  maxDelayMs?: number;
  /** Label used in logs. */
  label?: string;
  /** Decide whether a given error is worth retrying. Defaults to always. */
  shouldRetry?: (error: unknown) => boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run an async function with retries and exponential backoff with jitter.
 * Defaults to 3 retries (i.e. up to 4 attempts) per the project requirements.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    retries = 3,
    baseDelayMs = 500,
    maxDelayMs = 16_000,
    label = "operation",
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === retries || !shouldRetry(error)) {
        break;
      }

      // Exponential backoff: base * 2^attempt, capped, plus jitter.
      const backoff = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      const jitter = Math.random() * (backoff * 0.25);
      const delay = Math.round(backoff + jitter);

      logger.warn(
        `${label} failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms`,
        { error: error instanceof Error ? error.message : String(error) }
      );

      await sleep(delay);
    }
  }

  throw lastError;
}
