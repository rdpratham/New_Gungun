# ARIA — Account Research & Intelligence Agent

ARIA is an enterprise **B2B sales-intelligence agent** that runs natively inside
this Claude Code window. Type a plain-language request and ARIA finds prospect
companies across job boards, startup platforms, LinkedIn post signals, and
company career pages — then returns a clean, actionable list with hiring
signals, decision-maker contacts, and ready-to-send outreach.

It is not a separate web app or service: it is implemented as Claude Code
configuration (a custom subagent + a slash-command skill), so the only "runtime"
needed is this Claude Code session.

## What's in the box

| File | Purpose |
| --- | --- |
| `.claude/agents/aria.md` | The ARIA subagent — holds the full ARIA system prompt (the single source of truth) and declares the tools it may use. Invokable via the Agent/Task tool with `subagent_type: aria`. |
| `.claude/skills/aria/SKILL.md` | The `/aria` slash command — lets you trigger ARIA directly in chat. It delegates to the subagent. |
| `aria/README.md` | This document. |

## How to run it

Two equivalent ways, both from inside this Claude Code window:

1. **Slash command:**
   ```
   /aria give me list of companies hiring Databricks engineers in Pune
   ```

2. **Natural language:** just describe the prospecting task. Claude routes
   sales-prospecting requests to the ARIA agent automatically, e.g.
   *"find Series B fintechs using Snowflake"* or
   *"who is hiring ML engineers in Bangalore right now"*.

### Example queries

- `give me list of companies hiring Databricks engineers`
- `find healthcare companies expanding data team in Pune`
- `which fintechs posted about cloud migration on LinkedIn`
- `show me Series B startups using Snowflake`
- `companies in Bangalore hiring Spark developers`
- `list companies recently funded that work in healthcare AI`

### Follow-ups (same thread)

ARIA remembers the current result set, so you can refine without repeating
yourself:

- `filter only fintech`
- `sort by newest`
- `show only HOT`
- `outreach for <company>`
- `who to contact at <company>`
- `find more like <company>`

## What it returns

Every run produces the same five-part structure:

1. **Company List** — top 30, sorted ⭐ High Intent → 🔴 Hot → 🟡 Warm → 🔵 Cold.
2. **LinkedIn Post Contacts** — people actively posting about the keyword.
3. **Outreach Kit** — personalized cold email + LinkedIn DM for each Hot company.
4. **Signal Analysis** — patterns, strongest intent, where to look next.
5. **What To Do Next** — priority contacts, companies to watch, deeper search.

## Tools ARIA uses (live, in this environment)

- **WebSearch / WebFetch** — discover and read job posts, LinkedIn posts,
  funding news, and career pages.
- **web-scraper-fetch** MCP (`fetch_page`, `fetch_links`, `fetch_raw`) — scrape
  listing and posting pages to markdown / raw HTML. Auto-built by the
  `SessionStart` hook (`.claude/hooks/session-start.sh`).
- **ZoomInfo** MCP (when connected) — enrich companies and verify
  decision-maker contacts.

## Grounding & compliance

- **No fabrication.** Every company, person, URL, email, and date comes from a
  real tool result. Unverifiable fields are written as `not found`.
- **Recency.** Results older than 90 days are excluded unless you ask for them.
- **Responsible use.** Contact data is for legitimate B2B research only — not
  for spam or unsolicited bulk outreach. ARIA applies data minimization and
  surfaces only contacts relevant to your stated motion.

## Customizing ARIA

Edit `.claude/agents/aria.md` to change behavior — it is the authoritative
prompt. Common tweaks:

- **Default geography/industry** — Section 1.
- **Platforms covered** — Section 2.
- **Signal scoring (Hot/Warm/Cold) and cross-platform flagging** — Section 3.
- **Output layout** — Section 4.
- **Add/restrict tools** — the `tools:` field in the file's frontmatter.

The `/aria` skill needs no changes for behavior tweaks; it always delegates to
the subagent.
