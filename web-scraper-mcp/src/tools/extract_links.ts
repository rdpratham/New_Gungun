import * as cheerio from "cheerio";
import Anthropic from "@anthropic-ai/sdk";
import { sharedScraper } from "../scraper.js";
import { parseJsonArray } from "../extractor.js";
import { logger } from "../utils/logger.js";

const FILTER_MODEL = process.env.EXTRACTION_MODEL || "claude-sonnet-4-20250514";

export interface LinkItem {
  url: string;
  text: string;
}

export interface ExtractLinksResult {
  success: boolean;
  url: string;
  filter_description: string;
  data: LinkItem[];
  count: number;
  scrape_method: string;
  duration_ms: number;
  message?: string;
  error?: string;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY environment variable is not set.");
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * Pull every anchor from the page, resolve to absolute URLs, then use Claude to
 * keep only the links whose intent matches the filter description.
 */
export async function extractLinks(
  url: string,
  filterDescription: string
): Promise<ExtractLinksResult> {
  const start = Date.now();

  try {
    const fetched = await sharedScraper.fetchPage(url);

    if (fetched.blocked) {
      return {
        success: false,
        url,
        filter_description: filterDescription,
        data: [],
        count: 0,
        scrape_method: fetched.method,
        duration_ms: Date.now() - start,
        error: `The page appears to be blocked (${fetched.blockReason}).`,
      };
    }

    const allLinks = collectLinks(fetched.html, fetched.finalUrl);

    if (allLinks.length === 0) {
      return {
        success: true,
        url: fetched.finalUrl,
        filter_description: filterDescription,
        data: [],
        count: 0,
        scrape_method: fetched.method,
        duration_ms: Date.now() - start,
        message: "No links were found on the page.",
      };
    }

    const filtered = await filterByIntent(allLinks, filterDescription);

    return {
      success: true,
      url: fetched.finalUrl,
      filter_description: filterDescription,
      data: filtered,
      count: filtered.length,
      scrape_method: fetched.method,
      duration_ms: Date.now() - start,
      ...(filtered.length === 0
        ? { message: `No links matched the filter: "${filterDescription}".` }
        : {}),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("extractLinks failed", { url, error: errorMessage });
    return {
      success: false,
      url,
      filter_description: filterDescription,
      data: [],
      count: 0,
      scrape_method: "unknown",
      duration_ms: Date.now() - start,
      error: errorMessage,
    };
  }
}

/** Extract de-duplicated, absolute-URL anchors from HTML. */
export function collectLinks(html: string, baseUrl: string): LinkItem[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const links: LinkItem[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const text = $(el).text().replace(/\s+/g, " ").trim();

    const abs = toAbsolute(href, baseUrl);
    if (!abs) return;
    if (seen.has(abs)) return;

    seen.add(abs);
    links.push({ url: abs, text });
  });

  return links;
}

function toAbsolute(href: string, baseUrl: string): string | null {
  const trimmed = href.trim();
  if (
    !trimmed ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:")
  ) {
    return null;
  }
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Ask Claude which of the provided links match the filter intent. Returns the
 * subset of links the model selects.
 */
async function filterByIntent(
  links: LinkItem[],
  filterDescription: string
): Promise<LinkItem[]> {
  const anthropic = getClient();

  // Index the links so the model can refer to them compactly.
  const indexed = links.map((l, i) => ({ i, url: l.url, text: l.text }));

  const system =
    "You are a link-filtering expert. Given a list of links (each with an index, " +
    "URL and link text) and a plain-English filter describing which links the user " +
    "wants, return ONLY a JSON array of the integer indices of the links that match " +
    "the user's intent. Understand intent even if phrased casually. Return [] if none match. " +
    "Output nothing but the JSON array of integers.";

  const userContent =
    `Filter: ${filterDescription}\n\n` +
    `Links:\n${JSON.stringify(indexed, null, 0)}`;

  logger.debug("Filtering links via Claude", {
    model: FILTER_MODEL,
    total: links.length,
    filter: filterDescription,
  });

  const stream = anthropic.messages.stream({
    model: FILTER_MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userContent }],
  });

  const message = await stream.finalMessage();
  let text = "";
  for (const block of message.content) {
    if (block.type === "text") text += block.text;
  }

  const indices = parseJsonArray(text);
  if (!indices) return [];

  const result: LinkItem[] = [];
  for (const idx of indices) {
    if (typeof idx === "number" && links[idx]) {
      result.push(links[idx]);
    }
  }
  return result;
}
