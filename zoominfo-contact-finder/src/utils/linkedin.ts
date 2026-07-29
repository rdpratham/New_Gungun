/**
 * LinkedIn URL handling.
 *
 * The LinkedIn URL is treated purely as an *identifier/input* here: we never
 * fetch, log into, or scrape LinkedIn. The only thing we extract is the public
 * vanity slug from the URL itself, which is then used as a best-effort hint
 * (candidate name tokens) for searching ZoomInfo's own database.
 */

export interface ParsedLinkedinUrl {
  normalizedUrl: string;
  vanitySlug: string;
  nameTokens: string[];
}

const LINKEDIN_PROFILE_PATTERN =
  /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/([a-zA-Z0-9\-_%]{2,150})\/?/i;

export function isValidLinkedinProfileUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  return LINKEDIN_PROFILE_PATTERN.test(rawUrl.trim());
}

/**
 * Normalises a LinkedIn profile URL to a canonical https://www.linkedin.com/in/<slug> form
 * and derives naive name tokens from the vanity slug (e.g. "john-smith-3b2a1" -> ["john", "smith"]).
 * Throws if the URL doesn't look like a LinkedIn profile URL.
 */
export function parseLinkedinProfileUrl(rawUrl: string): ParsedLinkedinUrl {
  const trimmed = (rawUrl || "").trim();
  const match = trimmed.match(LINKEDIN_PROFILE_PATTERN);
  if (!match) {
    throw new Error("invalid_linkedin_url");
  }

  const vanitySlug = decodeURIComponent(match[2]).toLowerCase();
  const normalizedUrl = `https://www.linkedin.com/in/${vanitySlug}`;

  const tokens = vanitySlug
    .split(/[-_]+/)
    .filter((token) => token.length > 0)
    // Drop trailing random ID segments LinkedIn appends (e.g. "3b2a1c9", "a1b2c3d4"):
    // short alphanumeric blocks that contain at least one digit.
    .filter((token) => !(token.length <= 12 && /\d/.test(token) && /[a-z]/.test(token) && token.length >= 6));

  const nameTokens = tokens.filter((token) => /^[a-z]+$/.test(token));

  return { normalizedUrl, vanitySlug, nameTokens };
}
