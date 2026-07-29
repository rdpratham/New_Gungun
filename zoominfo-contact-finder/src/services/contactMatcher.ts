import { parseLinkedinProfileUrl, isValidLinkedinProfileUrl } from "../utils/linkedin";
import {
  searchContacts,
  enrichContact,
  enrichCompany,
  readAliasedField,
  CONTACT_FIELD_ALIASES,
  COMPANY_FIELD_ALIASES,
  RawZoomInfoContact,
  ZoomInfoAuthError,
  ZoomInfoRateLimitError,
  ZoomInfoNetworkError,
  ZoomInfoUpstreamError,
} from "./zoominfo";
import { logger } from "../utils/logger";
import { Contact, CandidateMatch, FindContactResult } from "../types";

export interface FindContactOptions {
  /** Optional company name hint the user can supply in the UI to disambiguate common names. */
  companyHint?: string;
}

const MULTI_MATCH_GAP_THRESHOLD = 15; // if the #1 candidate isn't at least this far ahead of #2, ask the user to pick

async function toContact(raw: RawZoomInfoContact, linkedinUrl: string): Promise<Contact> {
  const field = (name: string) => readAliasedField(raw, CONTACT_FIELD_ALIASES, name);

  const firstName = (field("firstName") as string) || "";
  const lastName = (field("lastName") as string) || "";
  const fullName = (field("fullName") as string) || [firstName, lastName].filter(Boolean).join(" ");

  const zoominfoUrl = (field("zoominfoUrl") as string) || extractZoominfoUrlFromExternalUrls(field("externalUrls"));

  let companyPhone = "";
  let location = "";
  const companyId = field("companyId") as string | undefined;
  const companyName = (field("companyName") as string) || "";

  if (companyId || companyName) {
    try {
      const company = await enrichCompany({ companyId, companyName });
      if (company) {
        const companyField = (name: string) => readAliasedField(company, COMPANY_FIELD_ALIASES, name);
        companyPhone = (companyField("phone") as string) || "";
        const city = companyField("city") as string | undefined;
        const state = companyField("state") as string | undefined;
        const country = companyField("country") as string | undefined;
        location = [city, state, country].filter(Boolean).join(", ");
      }
    } catch (err) {
      // Company lookup is best-effort enrichment for companyPhone/location — don't fail the whole search over it.
      logger.warn("Company enrichment failed; continuing without companyPhone/location", {
        reason: (err as Error).message,
      });
    }
  }

  return {
    name: fullName,
    title: (field("jobTitle") as string) || "",
    company: companyName,
    email: (field("email") as string) || "",
    phone: (field("phone") as string) || "",
    mobile: (field("mobilePhone") as string) || "",
    companyPhone,
    location,
    linkedinUrl,
    zoominfoUrl,
  };
}

/** `externalUrls` may come back as a string, comma-separated string, or array — pull out anything on the zoominfo.com domain. */
function extractZoominfoUrlFromExternalUrls(value: unknown): string {
  const urls = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const match = urls.map((u) => String(u).trim()).find((u) => u.includes("zoominfo.com"));
  return match || "";
}

/** Naive name/company similarity score (0-100) used to rank ambiguous search results. */
function scoreCandidate(raw: RawZoomInfoContact, nameTokens: string[], companyHint?: string): {
  score: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 0;

  const fullName = ((readAliasedField(raw, CONTACT_FIELD_ALIASES, "fullName") as string) || "").toLowerCase();
  const matchedTokens = nameTokens.filter((token) => fullName.includes(token));
  if (matchedTokens.length > 0) {
    const nameScore = Math.round((matchedTokens.length / Math.max(nameTokens.length, 1)) * 60);
    score += nameScore;
    reasons.push(`Name match (${matchedTokens.join(", ")})`);
  }

  if (companyHint) {
    const companyName = ((readAliasedField(raw, CONTACT_FIELD_ALIASES, "companyName") as string) || "").toLowerCase();
    if (companyName && companyName.includes(companyHint.toLowerCase())) {
      score += 30;
      reasons.push("Company match");
    }
  }

  const email = readAliasedField(raw, CONTACT_FIELD_ALIASES, "email");
  if (email) {
    score += 5;
    reasons.push("Has business email on file");
  }

  return { score: Math.min(score, 100), reasons };
}

function classifyError(err: unknown): FindContactResult {
  if (err instanceof ZoomInfoAuthError) {
    return { success: false, error: { code: "auth_expired", message: "Your ZoomInfo session/credentials are no longer valid. Please re-authenticate." } };
  }
  if (err instanceof ZoomInfoRateLimitError) {
    return { success: false, error: { code: "rate_limited", message: "ZoomInfo API quota or rate limit reached. Please try again later." } };
  }
  if (err instanceof ZoomInfoNetworkError) {
    return { success: false, error: { code: "network_error", message: "Could not reach ZoomInfo. Check your network connection and try again." } };
  }
  if (err instanceof ZoomInfoUpstreamError) {
    return { success: false, error: { code: "upstream_error", message: `ZoomInfo returned an unexpected error: ${(err as Error).message}` } };
  }
  throw err;
}

export async function findContactByLinkedIn(
  linkedinUrl: string,
  options: FindContactOptions = {}
): Promise<FindContactResult> {
  if (!isValidLinkedinProfileUrl(linkedinUrl)) {
    return {
      success: false,
      error: { code: "invalid_linkedin_url", message: "Please enter a valid LinkedIn profile URL, e.g. https://www.linkedin.com/in/jane-doe" },
    };
  }

  const { normalizedUrl, nameTokens } = parseLinkedinProfileUrl(linkedinUrl);

  try {
    // 1. Try a direct enrich-by-LinkedIn-URL match first, in case the account's
    //    ZoomInfo contract supports it.
    const direct = await enrichContact({ externalURL: normalizedUrl });
    if (direct && (readAliasedField(direct, CONTACT_FIELD_ALIASES, "fullName") || readAliasedField(direct, CONTACT_FIELD_ALIASES, "email"))) {
      const contact = await toContact(direct, normalizedUrl);
      return { success: true, contact, confidence: 95, matchReasons: ["Matched directly by LinkedIn URL"] };
    }
  } catch (err) {
    if (err instanceof ZoomInfoAuthError || err instanceof ZoomInfoRateLimitError || err instanceof ZoomInfoNetworkError || err instanceof ZoomInfoUpstreamError) {
      return classifyError(err);
    }
    logger.warn("Direct LinkedIn-URL enrichment failed; falling back to name-based search", { reason: (err as Error).message });
  }

  // 2. Fall back to a compliant matching workflow: derive name hints from the
  //    public vanity slug, then search ZoomInfo's own database.
  if (nameTokens.length === 0) {
    return {
      success: false,
      error: {
        code: "not_found",
        message: "Couldn't derive a searchable name from this LinkedIn URL, and no direct match was found in ZoomInfo.",
      },
    };
  }

  try {
    const firstName = nameTokens[0];
    const lastName = nameTokens.length > 1 ? nameTokens[nameTokens.length - 1] : undefined;

    const results = await searchContacts({
      firstName,
      lastName,
      companyName: options.companyHint,
      pageSize: 10,
    });

    if (results.length === 0) {
      return {
        success: false,
        error: { code: "not_found", message: "No matching contact was found in your ZoomInfo account for this LinkedIn profile." },
      };
    }

    const scored = results
      .map((raw) => ({ raw, ...scoreCandidate(raw, nameTokens, options.companyHint) }))
      .sort((a, b) => b.score - a.score);

    const [top, second] = scored;
    const isConfident = results.length === 1 || top.score - (second?.score ?? 0) >= MULTI_MATCH_GAP_THRESHOLD;

    if (!isConfident) {
      const candidates: CandidateMatch[] = await Promise.all(
        scored.slice(0, 5).map(async (candidate) => ({
          contact: await toContact(candidate.raw, normalizedUrl),
          confidence: candidate.score,
          matchReasons: candidate.reasons,
          zoominfoPersonId: (readAliasedField(candidate.raw, CONTACT_FIELD_ALIASES, "personId") as string) || null,
        }))
      );
      return {
        success: false,
        error: {
          code: "multiple_matches",
          message: "Multiple possible contacts matched this LinkedIn profile. Please pick the correct one.",
          candidates,
        },
      };
    }

    const personId = readAliasedField(top.raw, CONTACT_FIELD_ALIASES, "personId") as string | undefined;
    const enriched = personId ? await enrichContact({ personId }) : top.raw;
    const contact = await toContact(enriched || top.raw, normalizedUrl);

    return { success: true, contact, confidence: top.score, matchReasons: top.reasons };
  } catch (err) {
    return classifyError(err);
  }
}
