import * as cheerio from "cheerio";
import { sharedScraper } from "../scraper.js";
import { extractData } from "../extractor.js";
import { deduplicate } from "./scrape_multiple.js";
import { logger } from "../utils/logger.js";

export interface PaginatedResult {
  success: boolean;
  start_url: string;
  query: string;
  data: unknown[];
  count: number;
  scrape_method: string;
  pages_scraped: number;
  pages_visited: string[];
  duration_ms: number;
  message?: string;
  error?: string;
}

/**
 * Scrape a page, follow detected pagination (Next links / numbered pages) up to
 * `maxPages`, and combine the deduplicated results.
 */
export async function scrapePaginated(
  startUrl: string,
  query: string,
  maxPages = 10
): Promise<PaginatedResult> {
  const start = Date.now();
  const visited: string[] = [];
  const visitedSet = new Set<string>();
  const methods = new Set<string>();
  const combined: unknown[] = [];

  let currentUrl: string | null = startUrl;
  let lastError: string | undefined;

  try {
    while (currentUrl && visited.length < maxPages && !visitedSet.has(currentUrl)) {
      visitedSet.add(currentUrl);
      visited.push(currentUrl);

      const fetched = await sharedScraper.fetchPage(currentUrl);
      methods.add(fetched.method);

      if (fetched.blocked) {
        lastError = `Page ${currentUrl} appears to be blocked (${fetched.blockReason}). Stopping pagination.`;
        logger.warn(lastError);
        break;
      }

      const { data } = await extractData(fetched.html, query, { url: fetched.finalUrl });
      combined.push(...data);

      const next = detectNextPage(fetched.html, fetched.finalUrl);
      if (!next || visitedSet.has(next)) {
        currentUrl = null;
      } else {
        currentUrl = next;
      }
    }

    const deduped = deduplicate(combined);

    return {
      success: true,
      start_url: startUrl,
      query,
      data: deduped,
      count: deduped.length,
      scrape_method: Array.from(methods).join("+") || "unknown",
      pages_scraped: visited.length,
      pages_visited: visited,
      duration_ms: Date.now() - start,
      ...(lastError ? { message: lastError } : {}),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("scrapePaginated failed", { startUrl, error: errorMessage });
    const deduped = deduplicate(combined);
    return {
      success: deduped.length > 0,
      start_url: startUrl,
      query,
      data: deduped,
      count: deduped.length,
      scrape_method: Array.from(methods).join("+") || "unknown",
      pages_scraped: visited.length,
      pages_visited: visited,
      duration_ms: Date.now() - start,
      error: errorMessage,
    };
  }
}

/**
 * Heuristically detect the URL of the "next" page from common pagination
 * patterns: <link rel="next">, rel="next" anchors, aria-labels, and anchor text
 * like "Next", "›", "»", "→".
 */
export function detectNextPage(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);

  // 1. <link rel="next"> in <head> or rel="next" on an anchor.
  const relNext = $('link[rel="next"], a[rel="next"]').first().attr("href");
  if (relNext) return resolve(relNext, baseUrl);

  // 2. aria-label hinting next.
  const ariaNext = $('a[aria-label*="next" i]').first().attr("href");
  if (ariaNext) return resolve(ariaNext, baseUrl);

  // 3. Class names hinting next.
  const classNext = $('a[class*="next" i]').first().attr("href");
  if (classNext) return resolve(classNext, baseUrl);

  // 4. Anchor text matching common "next" markers.
  let textNext: string | null = null;
  $("a[href]").each((_, el) => {
    if (textNext) return;
    const text = $(el).text().replace(/\s+/g, " ").trim().toLowerCase();
    if (
      text === "next" ||
      text === "next page" ||
      text === "›" ||
      text === "»" ||
      text === "→" ||
      text === "next ›" ||
      text === "next »" ||
      /^next\b/.test(text)
    ) {
      const href = $(el).attr("href");
      if (href) textNext = resolve(href, baseUrl);
    }
  });

  return textNext;
}

function resolve(href: string, baseUrl: string): string | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("javascript:")) return null;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}
