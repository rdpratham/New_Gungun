import fetch from "node-fetch";
import type { Browser } from "puppeteer";
import { logger, logRequest } from "./utils/logger.js";
import { withRetry } from "./utils/retry.js";
import { defaultRateLimiter, RateLimiter } from "./utils/rate_limiter.js";
import { detectBlocked, looksLikeNeedsJs } from "./utils/html_cleaner.js";

export type ScrapeMethod = "cheerio" | "puppeteer";

export interface FetchResult {
  url: string;
  finalUrl: string;
  html: string;
  status: number;
  method: ScrapeMethod;
  durationMs: number;
  blocked: boolean;
  blockReason?: string;
}

export class ScrapeError extends Error {
  constructor(
    message: string,
    public readonly meta: {
      url: string;
      status?: number;
      blocked?: boolean;
      reason?: string;
    }
  ) {
    super(message);
    this.name = "ScrapeError";
  }
}

/** A rotating pool of realistic desktop user agents. */
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
];

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export interface ScraperOptions {
  /** Force a particular engine. By default the engine is auto-detected. */
  forceMethod?: ScrapeMethod;
  /** Per-request timeout in ms. */
  timeoutMs?: number;
  /** Rate limiter instance to use. */
  rateLimiter?: RateLimiter;
}

/**
 * Core scraping engine. Owns a shared (lazily-launched) Puppeteer browser and
 * provides a single `fetchPage` entry point that auto-selects between fast
 * static fetching (node-fetch) and full JS rendering (Puppeteer).
 */
export class Scraper {
  private browserPromise: Promise<Browser> | null = null;
  private readonly rateLimiter: RateLimiter;

  constructor(private readonly options: ScraperOptions = {}) {
    this.rateLimiter = options.rateLimiter ?? defaultRateLimiter;
  }

  /** Lazily launch a single shared headless browser. */
  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      const puppeteer = (await import("puppeteer")).default;
      this.browserPromise = puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-blink-features=AutomationControlled",
        ],
      });
      logger.info("Launched shared Puppeteer browser");
    }
    return this.browserPromise;
  }

  /** Close the shared browser, if any. */
  async close(): Promise<void> {
    if (this.browserPromise) {
      try {
        const browser = await this.browserPromise;
        await browser.close();
        logger.info("Closed Puppeteer browser");
      } catch (err) {
        logger.warn("Error closing browser", {
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        this.browserPromise = null;
      }
    }
  }

  /**
   * Fetch and return the HTML for a page, choosing the right engine.
   * - Tries fast static fetch first (unless forced to puppeteer).
   * - Falls back to Puppeteer if the page appears to require JS.
   * Handles redirects, gzip (via node-fetch defaults), UA rotation, retries,
   * rate limiting and blocked-page detection.
   */
  async fetchPage(url: string): Promise<FetchResult> {
    const forced = this.options.forceMethod;

    if (forced === "puppeteer") {
      return this.fetchWithPuppeteer(url);
    }

    const staticResult = await this.fetchStatic(url);

    if (forced === "cheerio") {
      return staticResult;
    }

    // Auto-detect: if static result is blocked or looks like it needs JS,
    // escalate to Puppeteer.
    if (staticResult.blocked || looksLikeNeedsJs(staticResult.html)) {
      logger.info("Escalating to Puppeteer (JS-rendered or blocked page)", { url });
      try {
        const dynamic = await this.fetchWithPuppeteer(url);
        return dynamic;
      } catch (err) {
        // If Puppeteer also fails but we have static content, return that.
        if (!staticResult.blocked && staticResult.html.length > 0) {
          logger.warn("Puppeteer failed, falling back to static result", {
            url,
            error: err instanceof Error ? err.message : String(err),
          });
          return staticResult;
        }
        throw err;
      }
    }

    return staticResult;
  }

  /** Fast path: node-fetch + (caller does Cheerio parsing). */
  private async fetchStatic(url: string): Promise<FetchResult> {
    const timeoutMs = this.options.timeoutMs ?? 30_000;
    await this.rateLimiter.acquire(url);

    const start = Date.now();
    const result = await withRetry(
      async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(url, {
            redirect: "follow",
            signal: controller.signal,
            headers: {
              "User-Agent": randomUserAgent(),
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
              "Accept-Encoding": "gzip, deflate, br",
              "Upgrade-Insecure-Requests": "1",
            },
          });
          const html = await res.text();
          return { html, status: res.status, finalUrl: res.url || url };
        } finally {
          clearTimeout(timer);
        }
      },
      {
        label: `fetch ${url}`,
        retries: 3,
        baseDelayMs: 2000,
        shouldRetry: (err) => {
          // Don't retry on abort/timeout endlessly handled by withRetry; retry network errors.
          return !(err instanceof Error && err.name === "AbortError" && false);
        },
      }
    );

    const durationMs = Date.now() - start;
    const { blocked, reason } = detectBlocked(result.html, result.status);

    logRequest({
      url,
      status: result.status,
      durationMs,
      method: "cheerio",
      note: blocked ? `blocked: ${reason}` : undefined,
    });

    return {
      url,
      finalUrl: result.finalUrl,
      html: result.html,
      status: result.status,
      method: "cheerio",
      durationMs,
      blocked,
      blockReason: reason,
    };
  }

  /** Slow path: full headless Chromium render via Puppeteer. */
  private async fetchWithPuppeteer(url: string): Promise<FetchResult> {
    const timeoutMs = this.options.timeoutMs ?? 45_000;
    await this.rateLimiter.acquire(url);

    const start = Date.now();
    const browser = await this.getBrowser();

    const result = await withRetry(
      async () => {
        const page = await browser.newPage();
        try {
          await page.setUserAgent(randomUserAgent());
          await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
          await page.setViewport({ width: 1366, height: 900 });

          const response = await page.goto(url, {
            waitUntil: "networkidle2",
            timeout: timeoutMs,
          });

          // Give late client-side rendering a moment.
          await new Promise((r) => setTimeout(r, 750));

          const html = await page.content();
          const status = response?.status() ?? 200;
          const finalUrl = page.url();
          return { html, status, finalUrl };
        } finally {
          await page.close().catch(() => undefined);
        }
      },
      { label: `puppeteer ${url}`, retries: 2, baseDelayMs: 2000 }
    );

    const durationMs = Date.now() - start;
    const { blocked, reason } = detectBlocked(result.html, result.status);

    logRequest({
      url,
      status: result.status,
      durationMs,
      method: "puppeteer",
      note: blocked ? `blocked: ${reason}` : undefined,
    });

    return {
      url,
      finalUrl: result.finalUrl,
      html: result.html,
      status: result.status,
      method: "puppeteer",
      durationMs,
      blocked,
      blockReason: reason,
    };
  }
}

export const sharedScraper = new Scraper();
