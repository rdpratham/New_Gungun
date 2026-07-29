import { Router, Request, Response } from "express";
import { findContactByLinkedIn } from "../services/contactMatcher";
import { appendHistoryEntry } from "../services/historyStore";
import { logger } from "../utils/logger";

export const searchRoutes = Router();

const ERROR_STATUS: Record<string, number> = {
  invalid_linkedin_url: 400,
  not_found: 404,
  multiple_matches: 409,
  auth_expired: 401,
  rate_limited: 429,
  network_error: 502,
  upstream_error: 502,
};

searchRoutes.post("/search", async (req: Request, res: Response) => {
  const { linkedinUrl, companyHint } = req.body ?? {};

  if (typeof linkedinUrl !== "string" || linkedinUrl.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: "invalid_linkedin_url", message: "A LinkedIn profile URL is required." },
    });
  }
  // Basic input sanitisation: cap length, strip control characters. The URL shape
  // itself is validated/parsed inside findContactByLinkedIn.
  const sanitizedUrl = linkedinUrl.trim().slice(0, 500).replace(/[\x00-\x1F\x7F]/g, "");
  const sanitizedCompanyHint =
    typeof companyHint === "string" ? companyHint.trim().slice(0, 200).replace(/[\x00-\x1F\x7F]/g, "") : undefined;

  try {
    const result = await findContactByLinkedIn(sanitizedUrl, { companyHint: sanitizedCompanyHint });

    if (result.success) {
      await appendHistoryEntry(sanitizedUrl, result.contact, result.confidence);
      return res.status(200).json(result);
    }

    const status = ERROR_STATUS[result.error.code] ?? 500;
    return res.status(status).json(result);
  } catch (err) {
    logger.error("Unexpected error handling /api/search", { reason: (err as Error).message });
    return res.status(500).json({
      success: false,
      error: { code: "upstream_error", message: "An unexpected error occurred while searching ZoomInfo." },
    });
  }
});
