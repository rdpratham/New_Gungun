import { sharedScraper } from "../scraper.js";
import { extractData } from "../extractor.js";
import { logger } from "../utils/logger.js";

export interface ScrapeResult {
  success: boolean;
  url: string;
  query: string;
  data: unknown[];
  count: number;
  scrape_method: string;
  duration_ms: number;
  message?: string;
  error?: string;
}

/**
 * Scrape a single URL and extract data matching the plain-English query.
 */
export async function scrapeUrl(url: string, query: string): Promise<ScrapeResult> {
  const start = Date.now();

  try {
    const fetched = await sharedScraper.fetchPage(url);

    if (fetched.blocked) {
      return {
        success: false,
        url,
        query,
        data: [],
        count: 0,
        scrape_method: fetched.method,
        duration_ms: Date.now() - start,
        error:
          `The page could not be scraped because it appears to be blocked (${fetched.blockReason}). ` +
          `This site may use anti-bot protection or require authentication.`,
      };
    }

    const { data, message } = await extractData(fetched.html, query, {
      url: fetched.finalUrl,
    });

    return {
      success: true,
      url: fetched.finalUrl,
      query,
      data,
      count: data.length,
      scrape_method: fetched.method,
      duration_ms: Date.now() - start,
      ...(message ? { message } : {}),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("scrapeUrl failed", { url, error: errorMessage });
    return {
      success: false,
      url,
      query,
      data: [],
      count: 0,
      scrape_method: "unknown",
      duration_ms: Date.now() - start,
      error: errorMessage,
    };
  }
}
