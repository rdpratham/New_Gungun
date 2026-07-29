/**
 * ZoomInfo API client.
 *
 * Wraps ZoomInfo's official Authentication + Search Contact + Enrich Contact +
 * Enrich Company REST endpoints. Field names for `searchContacts` /
 * `enrichContact` / `enrichCompany` request payloads match the parameter set
 * of ZoomInfo's own officially published Search Contact / Enrich Contact /
 * Enrich Company APIs (firstName, lastName, fullName, companyName, personId,
 * externalURL, requiredFields, etc.).
 *
 * ============================================================================
 * CONFIGURATION POINTS — verify these against the API contract in your
 * ZoomInfo Developer Portal account before going live. ZoomInfo provisions
 * API access per-contract, and exact base URLs / response envelopes can vary
 * by subscription (Enrich API vs Sales API vs Operations API). Everything
 * that might need adjusting is isolated below or in `CONTACT_FIELD_ALIASES`
 * / `COMPANY_FIELD_ALIASES`.
 * ============================================================================
 */

import { logger } from "../utils/logger";

const API_BASE_URL = process.env.ZOOMINFO_API_BASE_URL || "https://api.zoominfo.com";
const AUTHENTICATE_PATH = "/authenticate";
const SEARCH_CONTACT_PATH = "/search/contact";
const ENRICH_CONTACT_PATH = "/enrich/contact";
const ENRICH_COMPANY_PATH = "/enrich/company";

const REQUEST_TIMEOUT_MS = 15_000;

export class ZoomInfoAuthError extends Error {}
export class ZoomInfoRateLimitError extends Error {}
export class ZoomInfoNetworkError extends Error {}
export class ZoomInfoUpstreamError extends Error {}

interface CachedToken {
  jwt: string;
  expiresAtMs: number;
}

let cachedToken: CachedToken | null = null;

function decodeJwtExpiryMs(jwt: string): number | null {
  try {
    const payloadSegment = jwt.split(".")[1];
    if (!payloadSegment) return null;
    const json = Buffer.from(payloadSegment, "base64url").toString("utf8");
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp === "number") {
      return payload.exp * 1000;
    }
  } catch {
    // Fall through to null — caller applies a conservative default TTL.
  }
  return null;
}

function buildAuthBody(): Record<string, string> {
  const username = process.env.ZOOMINFO_USERNAME;
  const password = process.env.ZOOMINFO_PASSWORD;
  const clientId = process.env.ZOOMINFO_CLIENT_ID;
  const privateKey = process.env.ZOOMINFO_PRIVATE_KEY;

  if (username && password) {
    return { username, password };
  }
  if (clientId && privateKey) {
    return { client_id: clientId, private_key: privateKey };
  }
  throw new ZoomInfoAuthError(
    "No ZoomInfo credentials configured. Set ZOOMINFO_USERNAME + ZOOMINFO_PASSWORD, " +
      "or ZOOMINFO_CLIENT_ID + ZOOMINFO_PRIVATE_KEY, in your .env file."
  );
}

async function authenticate(): Promise<string> {
  const body = buildAuthBody();

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${AUTHENTICATE_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new ZoomInfoNetworkError(`Unable to reach ZoomInfo authentication endpoint: ${(err as Error).message}`);
  }

  if (response.status === 401 || response.status === 403) {
    throw new ZoomInfoAuthError("ZoomInfo rejected the configured credentials.");
  }
  if (response.status === 429) {
    throw new ZoomInfoRateLimitError("ZoomInfo authentication rate limit reached.");
  }
  if (!response.ok) {
    throw new ZoomInfoUpstreamError(`ZoomInfo authentication failed with status ${response.status}.`);
  }

  const data = (await response.json()) as { jwt?: string };
  if (!data.jwt) {
    throw new ZoomInfoUpstreamError("ZoomInfo authentication response did not include a token.");
  }
  return data.jwt;
}

/** Returns a valid JWT, re-authenticating only when the cached token is missing/near expiry. */
async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs - now > 60_000) {
    return cachedToken.jwt;
  }

  const jwt = await authenticate();
  const expiryFromClaims = decodeJwtExpiryMs(jwt);
  const DEFAULT_TTL_MS = 50 * 60 * 1000; // conservative fallback if `exp` claim can't be read
  cachedToken = {
    jwt,
    expiresAtMs: expiryFromClaims ?? now + DEFAULT_TTL_MS,
  };
  logger.info("Authenticated with ZoomInfo", { expiresAt: new Date(cachedToken.expiresAtMs).toISOString() });
  return jwt;
}

async function callZoomInfo<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const jwt = await getAccessToken();

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new ZoomInfoNetworkError(`Network error calling ZoomInfo ${path}: ${(err as Error).message}`);
  }

  if (response.status === 401 || response.status === 403) {
    // Token may have been revoked/expired server-side mid-session; drop the cache.
    cachedToken = null;
    throw new ZoomInfoAuthError("ZoomInfo session expired or access was denied.");
  }
  if (response.status === 429) {
    throw new ZoomInfoRateLimitError("ZoomInfo API quota/rate limit reached.");
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ZoomInfoUpstreamError(`ZoomInfo ${path} returned status ${response.status}. ${text}`.trim());
  }

  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Search Contact
// ---------------------------------------------------------------------------

export interface SearchContactCriteria {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  companyName?: string;
  jobTitle?: string;
  emailAddress?: string;
  externalURL?: string;
  page?: number;
  pageSize?: number;
}

export interface RawZoomInfoContact {
  [key: string]: unknown;
}

/** CONFIGURATION POINT: adjust if your contract's response envelope differs. */
function extractRecords(raw: unknown): RawZoomInfoContact[] {
  if (Array.isArray(raw)) return raw as RawZoomInfoContact[];
  const obj = raw as Record<string, unknown>;
  const candidates = [obj?.data, (obj?.data as Record<string, unknown>)?.result, obj?.results, obj?.contacts];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as RawZoomInfoContact[];
  }
  return [];
}

export async function searchContacts(criteria: SearchContactCriteria): Promise<RawZoomInfoContact[]> {
  const payload: Record<string, unknown> = {
    firstName: criteria.firstName,
    lastName: criteria.lastName,
    fullName: criteria.fullName,
    companyName: criteria.companyName,
    jobTitle: criteria.jobTitle,
    emailAddress: criteria.emailAddress,
    externalURL: criteria.externalURL,
    page: criteria.page ?? 1,
    rpp: criteria.pageSize ?? 10,
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

  const raw = await callZoomInfo<unknown>(SEARCH_CONTACT_PATH, payload);
  return extractRecords(raw);
}

// ---------------------------------------------------------------------------
// Enrich Contact / Enrich Company
// ---------------------------------------------------------------------------

export interface EnrichContactInput {
  personId?: string;
  email?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  externalURL?: string;
}

const CONTACT_REQUIRED_FIELDS = [
  "companyName",
  "contactAccuracyScore",
  "email",
  "externalUrls",
  "jobTitle",
  "managementLevel",
  "mobilePhone",
  "phone",
  "zoominfoCompanyId",
];

export async function enrichContact(input: EnrichContactInput): Promise<RawZoomInfoContact | null> {
  const payload = {
    matchPersonInput: [input],
    outputFields: CONTACT_REQUIRED_FIELDS,
  };
  const raw = await callZoomInfo<unknown>(ENRICH_CONTACT_PATH, payload);
  const records = extractRecords(raw);
  return records[0] ?? null;
}

export interface EnrichCompanyInput {
  companyId?: string;
  companyName?: string;
}

const COMPANY_REQUIRED_FIELDS = ["name", "phone", "city", "state", "country"];

export async function enrichCompany(input: EnrichCompanyInput): Promise<RawZoomInfoContact | null> {
  const payload = {
    matchCompanyInput: [input],
    outputFields: COMPANY_REQUIRED_FIELDS,
  };
  const raw = await callZoomInfo<unknown>(ENRICH_COMPANY_PATH, payload);
  const records = extractRecords(raw);
  return records[0] ?? null;
}

/**
 * CONFIGURATION POINT: field-name aliases used to read values out of whatever
 * shape the raw ZoomInfo JSON response actually has. Add/re-order aliases
 * here once you can see a real response sample from your account — no other
 * file needs to change.
 */
export const CONTACT_FIELD_ALIASES: Record<string, string[]> = {
  firstName: ["firstName", "first_name"],
  lastName: ["lastName", "last_name"],
  fullName: ["fullName", "name"],
  jobTitle: ["jobTitle", "title", "job_title"],
  companyName: ["companyName", "company.name", "company_name"],
  companyId: ["companyId", "zoominfoCompanyId", "company.id"],
  email: ["email", "emailAddress", "workEmail"],
  phone: ["phone", "directPhone", "phoneNumber"],
  mobilePhone: ["mobilePhone", "mobile", "mobile_phone"],
  externalUrls: ["externalUrls", "externalURL", "socialMediaUrls"],
  personId: ["id", "personId", "person_id"],
  zoominfoUrl: ["zoominfoUrl", "zoomInfoContactUrl", "personProfileUrl"],
};

export const COMPANY_FIELD_ALIASES: Record<string, string[]> = {
  name: ["name", "companyName"],
  phone: ["phone", "companyPhone"],
  city: ["city"],
  state: ["state"],
  country: ["country"],
};

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[segment];
    return undefined;
  }, obj);
}

export function readAliasedField(
  raw: RawZoomInfoContact,
  aliasMap: Record<string, string[]>,
  field: string
): unknown {
  const aliases = aliasMap[field] || [];
  for (const alias of aliases) {
    const value = getByPath(raw, alias);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}
