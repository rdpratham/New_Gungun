import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./utils/logger.js";
import { cleanHtml } from "./utils/html_cleaner.js";

/**
 * The model used for intelligent extraction. Defaults to the value requested in
 * the project spec but can be overridden via the EXTRACTION_MODEL env var.
 */
const EXTRACTION_MODEL = process.env.EXTRACTION_MODEL || "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are a data extraction expert. Given webpage content and a user query, extract EXACTLY what the user is asking for.

Rules:
- Understand the user's INTENT even if their query is phrased casually, informally, or contains typos.
- Extract only the data the user actually wants — nothing more, nothing less.
- Return ONLY a clean JSON array of the extracted data. No prose, no markdown fences, no explanation.
- Use sensible, consistent, snake_case field names inferred from the query and the data (e.g. product_name, price, headline, date, email, phone).
- Each array element should be an object representing one extracted item.
- Preserve useful values verbatim (prices, dates, names) — do not paraphrase or summarize.
- If the page genuinely contains none of the requested data, return an empty array: [].
- Never invent data that is not present on the page.`;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY environment variable is not set. Set it to use AI-powered extraction."
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export interface ExtractionResult {
  data: unknown[];
  /** Present when no structured data could be extracted — explains what was found. */
  message?: string;
}

/**
 * Send cleaned page content + the user query to Claude and parse a JSON array
 * of extracted records out of the response.
 */
export async function extractData(
  rawHtml: string,
  query: string,
  context?: { url?: string; pageTitle?: string }
): Promise<ExtractionResult> {
  const cleaned = cleanHtml(rawHtml);
  const anthropic = getClient();

  const userContent = [
    context?.url ? `URL: ${context.url}` : "",
    cleaned.title ? `Page title: ${cleaned.title}` : "",
    "",
    `User query: ${query}`,
    "",
    "Webpage content:",
    "---",
    cleaned.text,
    "---",
    "",
    "Extract exactly what the user asked for and return it as a JSON array.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  logger.debug("Sending content to Claude for extraction", {
    model: EXTRACTION_MODEL,
    query,
    content_chars: cleaned.text.length,
  });

  // Stream and collect the final message — extraction output can be large.
  const stream = anthropic.messages.stream({
    model: EXTRACTION_MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const message = await stream.finalMessage();

  let text = "";
  for (const block of message.content) {
    if (block.type === "text") text += block.text;
  }

  const parsed = parseJsonArray(text);

  if (parsed === null) {
    logger.warn("Could not parse a JSON array from Claude's response");
    return {
      data: [],
      message:
        "The extractor could not produce structured data for this query. " +
        "The page may not contain the requested information, or the query may need to be more specific.",
    };
  }

  if (parsed.length === 0) {
    return {
      data: [],
      message: `No matching data found on the page for query: "${query}". ` +
        (cleaned.title ? `The page is titled "${cleaned.title}".` : ""),
    };
  }

  return { data: parsed };
}

/**
 * Robustly parse a JSON array out of an LLM response. Handles markdown code
 * fences and leading/trailing prose by locating the outermost array.
 */
export function parseJsonArray(text: string): unknown[] | null {
  const trimmed = text.trim();

  // Try direct parse first.
  const direct = tryParse(trimmed);
  if (Array.isArray(direct)) return direct;
  if (direct && typeof direct === "object") return [direct];

  // Strip markdown code fences if present.
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    const fenced = tryParse(fenceMatch[1].trim());
    if (Array.isArray(fenced)) return fenced;
    if (fenced && typeof fenced === "object") return [fenced];
  }

  // Fall back to locating the outermost [ ... ] block.
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = tryParse(trimmed.slice(start, end + 1));
    if (Array.isArray(candidate)) return candidate;
  }

  return null;
}

function tryParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
