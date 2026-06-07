import { logger } from "./logger.js";

/**
 * A simple per-host rate limiter that enforces a minimum delay between
 * consecutive requests to the same origin. This is polite-scraping behaviour
 * and helps avoid tripping anti-bot defences.
 */
export class RateLimiter {
  private readonly delayMs: number;
  private readonly lastRequestByHost = new Map<string, number>();
  private readonly queueByHost = new Map<string, Promise<void>>();

  constructor(delayMs?: number) {
    const fromEnv = process.env.SCRAPE_DELAY_MS
      ? Number(process.env.SCRAPE_DELAY_MS)
      : undefined;
    this.delayMs = delayMs ?? fromEnv ?? 1000; // default 1s between requests
  }

  private hostOf(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return "unknown-host";
    }
  }

  /**
   * Await this before making a request to ensure the configured delay has
   * elapsed since the previous request to the same host. Requests to the same
   * host are serialised so the delay is honoured even under concurrency.
   */
  async acquire(url: string): Promise<void> {
    const host = this.hostOf(url);
    const previous = this.queueByHost.get(host) ?? Promise.resolve();

    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.queueByHost.set(host, previous.then(() => current));

    await previous;

    const last = this.lastRequestByHost.get(host) ?? 0;
    const elapsed = Date.now() - last;
    const wait = this.delayMs - elapsed;

    if (wait > 0) {
      logger.debug(`Rate limiting ${host}: waiting ${wait}ms`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }

    this.lastRequestByHost.set(host, Date.now());
    // Release the lock for the next queued request after we've stamped the time.
    release();
  }
}

export const defaultRateLimiter = new RateLimiter();
