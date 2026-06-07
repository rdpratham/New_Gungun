import pLimit from "p-limit";
import { scrapeUrl } from "./scrape_url.js";
import { logger } from "../utils/logger.js";

const MAX_CONCURRENCY = 5;

export interface MultiScrapeResult {
  success: boolean;
  urls: string[];
  query: string;
  data: unknown[];
  count: number;
  scrape_method: string;
  duration_ms: number;
  per_url: Array<{
    url: string;
    success: boolean;
    count: number;
    error?: string;
  }>;
}

/**
 * Scrape many URLs concurrently (max 5 at a time), then merge and deduplicate
 * the combined results.
 */
export async function scrapeMultipleUrls(
  urls: string[],
  query: string
): Promise<MultiScrapeResult> {
  const start = Date.now();
  const limit = pLimit(MAX_CONCURRENCY);

  logger.info(`Scraping ${urls.length} URLs (concurrency ${MAX_CONCURRENCY})`, { query });

  const results = await Promise.all(
    urls.map((url) => limit(() => scrapeUrl(url, query)))
  );

  const methods = new Set<string>();
  const combined: unknown[] = [];
  const perUrl: MultiScrapeResult["per_url"] = [];

  for (const r of results) {
    methods.add(r.scrape_method);
    combined.push(...r.data);
    perUrl.push({
      url: r.url,
      success: r.success,
      count: r.count,
      ...(r.error ? { error: r.error } : {}),
    });
  }

  const deduped = deduplicate(combined);

  return {
    success: results.some((r) => r.success),
    urls,
    query,
    data: deduped,
    count: deduped.length,
    scrape_method: Array.from(methods).join("+") || "unknown",
    duration_ms: Date.now() - start,
    per_url: perUrl,
  };
}

/**
 * Deduplicate a list of extracted records by a normalized JSON signature.
 * Object keys are sorted and string values lowercased/trimmed so that records
 * that differ only cosmetically collapse into one.
 */
export function deduplicate(items: unknown[]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];

  for (const item of items) {
    const sig = signature(item);
    if (!seen.has(sig)) {
      seen.add(sig);
      out.push(item);
    }
  }

  return out;
}

function signature(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function normalize(value: unknown): unknown {
  if (typeof value === "string") return value.trim().toLowerCase();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = normalize(obj[key]);
    }
    return result;
  }
  return value;
}
