---
name: aria
description: >-
  ARIA — Account Research & Intelligence Agent for B2B sales. Invoke when the
  user wants to find prospect companies, hiring signals, or decision-maker
  contacts from a plain-language request (e.g. "/aria companies hiring
  Databricks engineers in Pune", "/aria Series B fintechs using Snowflake",
  "/aria who is hiring ML engineers in Bangalore right now"), or to generate
  outreach for prospects. Also use for sales-prospecting follow-ups like "filter
  only fintech", "show only HOT", or "outreach for <company>".
---

# ARIA — Account Research & Intelligence Agent

This skill runs the ARIA B2B sales-intelligence workflow inside this Claude
Code window. The full operating spec (query parsing, platform coverage,
enrichment, and the required 5-part output) lives in the `aria` subagent at
`.claude/agents/aria.md` — that file is the single source of truth.

## How to run it

The user's query is in the arguments (everything after `/aria`). Treat it as
the prospecting request.

1. If the arguments are EMPTY or contain no role/technology/topic to search
   for (e.g. just "find me companies"), ask exactly ONE question:
   **"What role, technology, or topic should I search for?"** Then stop and
   wait. Do not ask anything else.

2. Otherwise, delegate the work to the ARIA subagent so it runs with the full
   ARIA system prompt and the correct tools (web search, web scraping,
   ZoomInfo). Use the Agent tool:

   - `subagent_type`: `aria`
   - `description`: a 3-5 word summary (e.g. "Prospect Databricks hiring")
   - `prompt`: the user's full request, verbatim, plus any conversation
     context relevant to this prospecting thread (e.g. prior result set the
     user is now filtering or asking outreach for).

3. Relay the subagent's final structured report back to the user as-is. It is
   already formatted in the required 5-part structure — do not summarize away
   the table, contacts, or outreach kit.

## Notes

- For follow-ups in the same thread ("filter only fintech", "sort by newest",
  "outreach for <company>", "find more like <company>"), pass the follow-up
  plus the relevant earlier results to the subagent so it builds on context
  rather than starting over.
- Grounding is mandatory: ARIA reports only companies, people, URLs, emails,
  and dates that come from real tool results, and writes "not found" for
  anything it cannot verify. Never let it fabricate contact data.
- Contact data is for legitimate B2B research only — no spam or unsolicited
  bulk outreach.
