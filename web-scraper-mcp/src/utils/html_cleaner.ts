import * as cheerio from "cheerio";

/** Tags whose contents are boilerplate / noise for data extraction. */
const STRIP_TAGS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "svg",
  "canvas",
  "nav",
  "footer",
  "header",
  "aside",
  "form",
  "button",
  "template",
];

export interface CleanResult {
  /** Cleaned, human-readable text content. */
  text: string;
  /** Cleaned HTML (boilerplate stripped) — useful when structure matters. */
  html: string;
  /** Page title if present. */
  title: string;
}

/**
 * Strip scripts, styles, navigation, and other boilerplate, then return both a
 * compact text representation and a cleaned HTML body. The output is bounded in
 * size so we never send an unreasonable payload to the LLM.
 */
export function cleanHtml(rawHtml: string, maxChars = 60_000): CleanResult {
  const $ = cheerio.load(rawHtml);

  const title = $("title").first().text().trim();

  for (const tag of STRIP_TAGS) {
    $(tag).remove();
  }

  // Drop common cookie / consent / ad containers by id/class heuristics.
  $(
    '[class*="cookie" i], [id*="cookie" i], [class*="consent" i], [class*="advert" i], [class*="ad-" i], [aria-hidden="true"]'
  ).remove();

  // Remove HTML comments.
  $("*")
    .contents()
    .each((_, node) => {
      if (node.type === "comment") $(node).remove();
    });

  const hasBody = $("body").length > 0;
  const rawText = hasBody ? $("body").text() : $.root().text();
  const rawBodyHtml = hasBody ? $("body").html() : $.root().html();

  // Collapse whitespace in the extracted text.
  const text = rawText
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  let html = rawBodyHtml ?? "";
  html = html.replace(/\s+/g, " ").trim();

  return {
    title,
    text: truncate(text, maxChars),
    html: truncate(html, maxChars),
  };
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[...truncated ${value.length - maxChars} characters...]`;
}

/** Quick check whether a page looks like it requires JS to render content. */
export function looksLikeNeedsJs(rawHtml: string): boolean {
  const { text } = cleanHtml(rawHtml, 200_000);

  // Very little visible text usually means client-side rendering.
  if (text.replace(/\s/g, "").length < 200) return true;

  const lower = rawHtml.toLowerCase();
  const spaMarkers = [
    'id="root"',
    'id="app"',
    'id="__next"',
    "data-reactroot",
    "ng-app",
    "ng-version",
    "window.__nuxt__",
    "window.__initial_state__",
  ];
  const hasSpaMarker = spaMarkers.some((m) => lower.includes(m));

  // SPA marker + thin content => needs JS.
  if (hasSpaMarker && text.length < 1000) return true;

  // <noscript> nudging the user to enable JS.
  if (/enable javascript|requires javascript/i.test(rawHtml)) return true;

  return false;
}

/** Detect captcha / bot-wall pages from text and status. */
export function detectBlocked(
  rawHtml: string,
  status: number
): { blocked: boolean; reason?: string } {
  if (status === 403) return { blocked: true, reason: "HTTP 403 Forbidden" };
  if (status === 429) return { blocked: true, reason: "HTTP 429 Too Many Requests" };

  const lower = rawHtml.toLowerCase();
  const markers: Array<[RegExp, string]> = [
    [/recaptcha|g-recaptcha|hcaptcha/, "CAPTCHA challenge detected"],
    [/cf-browser-verification|checking your browser|cloudflare/, "Cloudflare challenge detected"],
    [/are you a robot|verify you are human|unusual traffic/, "Bot verification page detected"],
    [/access denied|you have been blocked/, "Access denied page detected"],
  ];

  for (const [re, reason] of markers) {
    if (re.test(lower)) return { blocked: true, reason };
  }

  return { blocked: false };
}
