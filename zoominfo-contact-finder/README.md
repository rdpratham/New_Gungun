# ZoomInfo Contact Finder

A local tool that looks up business contact information from your **authorised
ZoomInfo account** using a LinkedIn profile URL as the input identifier.

It does not scrape LinkedIn and does not bypass ZoomInfo's authentication,
CAPTCHA, MFA, or rate limits. All ZoomInfo authentication happens server-side;
no credentials are ever sent to the browser.

## How matching works

1. The LinkedIn URL is validated/normalised and its public vanity slug is used
   only as an identifier — never fetched or scraped.
2. The app first asks ZoomInfo to match a contact directly by that LinkedIn
   URL (Enrich Contact with `externalURL`).
3. If that's inconclusive, it falls back to a compliant workflow: derive
   candidate name tokens from the slug, search ZoomInfo's contact database,
   and rank results by name/company similarity.
4. If one candidate clearly outranks the rest, its details are returned. If
   several are close in score, you're shown a ranked candidate list with
   confidence scores to choose from — the tool never guesses silently.

## What you need to provide

You need an active ZoomInfo subscription with API access provisioned by
ZoomInfo (Enrich API / Search API). From your ZoomInfo Developer Portal
account, get **one** of:

- `ZOOMINFO_USERNAME` + `ZOOMINFO_PASSWORD`, or
- `ZOOMINFO_CLIENT_ID` + `ZOOMINFO_PRIVATE_KEY` (PKI)

Copy `.env.example` to `.env` and fill these in. **Never commit `.env`.**

> **Important:** ZoomInfo provisions API contracts per customer, and exact
> base URLs / response field names can vary by subscription tier. This
> project uses ZoomInfo's documented endpoint paths and the parameter names
> confirmed against ZoomInfo's own Search Contact / Enrich Contact / Enrich
> Company parameter set. Before relying on results in production, verify the
> configuration points called out in `src/services/zoominfo.ts`
> (`API_BASE_URL`, `AUTHENTICATE_PATH`, `SEARCH_CONTACT_PATH`,
> `ENRICH_CONTACT_PATH`, `ENRICH_COMPANY_PATH`, `CONTACT_FIELD_ALIASES`,
> `COMPANY_FIELD_ALIASES`) against your account's actual API contract/sample
> responses, and adjust only that file if anything differs — no other file
> needs to change.

## Setup

```bash
cd zoominfo-contact-finder
npm install
cp .env.example .env   # then fill in your ZoomInfo credentials
npm run build
npm start
```

Or for local development with auto-reload:

```bash
npm run dev
```

Then open http://localhost:4000

## Project structure

```
src/
  api/            Express route handlers
  services/
    zoominfo.ts       ZoomInfo API client (auth, search, enrich)
    contactMatcher.ts LinkedIn -> ZoomInfo matching/ranking workflow
    historyStore.ts   Local JSON search history + CSV export
  utils/
    linkedin.ts       LinkedIn URL validation/normalisation
    logger.ts         Secret-redacting logger
  types/            Shared TypeScript types
  public/           Static frontend (HTML/CSS/vanilla JS)
```

## Backend function

```ts
import { findContactByLinkedIn } from "./src/services/contactMatcher";

const result = await findContactByLinkedIn("https://www.linkedin.com/in/jane-doe");
```

Returns:

```json
{
  "success": true,
  "contact": {
    "name": "", "title": "", "company": "",
    "email": "", "phone": "", "mobile": "",
    "companyPhone": "", "location": "",
    "linkedinUrl": "", "zoominfoUrl": ""
  },
  "confidence": 95,
  "matchReasons": ["Matched directly by LinkedIn URL"]
}
```

On failure, `success` is `false` and `error.code` is one of:
`invalid_linkedin_url`, `not_found`, `multiple_matches` (includes ranked
`candidates`), `auth_expired`, `rate_limited`, `network_error`,
`upstream_error`.

## Security notes

- Credentials/tokens are read only from environment variables server-side,
  never logged, and never sent to the frontend.
- `.env` is git-ignored. `.env.example` contains placeholders only.
- Search history stores only the retrieved contact summary — never
  credentials or tokens.
- Input (LinkedIn URL, optional company hint) is length-capped and stripped
  of control characters before use.

## Compliance

Use only for legitimate, authorised B2B research through your own ZoomInfo
subscription. Follow your organisation's data governance policy and
applicable privacy law (GDPR, CCPA, CAN-SPAM, etc.) when contacting anyone
found through this tool. Do not use it for mass data extraction or
unsolicited bulk outreach — that violates ZoomInfo's Terms of Service.
