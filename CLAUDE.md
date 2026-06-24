# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env   # then fill in credentials
```

Credentials go in `.env` — either Option A (Client ID + RSA private key) or Option B (username + password). `server.py` and `client.py` both call `load_dotenv()` at startup.

## Running

```bash
# Start the MCP server (used by Claude Code via .claude/settings.json)
python3 server.py

# Interactive CLI for manual testing
python3 client.py
```

## MCP Integration

`.claude/settings.json` registers `server.py` as an MCP server named `zoominfo` so the 15 ZoomInfo tools are permanently available in every session in this project. No manual config needed — just set the env vars and restart.

## Architecture

Two files share the same logic — **`server.py`** exposes it over MCP (stdio transport), **`client.py`** exposes it as an interactive CLI. Both duplicate: auth, `_company_id_payload`, `_build_company_search_payload`, `_build_contact_search_payload`, and the dispatcher.

**Auth flow (`get_access_token`):** Posts to `/authenticate` with either `{client_id, private_key}` or `{username, password}`. The returned `jwt` is cached in a module-level `_token_cache` dict and reused until 60 seconds before expiry (`expiresIn`, default 3600 s).

**API calls (`zi_post`):** Every tool call goes through `zi_post`, which attaches the Bearer token and POSTs to `https://api.zoominfo.com{path}`.

**Dispatcher (`_dispatch` in server.py / `dispatch` in client.py):** A chain of `if name == "..."` blocks that build a payload and call `zi_post`. All ZoomInfo search payloads use a `matchCriteria` list of `{field, values}` objects, with optional `range: {min, max}` for numeric fields.

**Payload builders:** `_build_company_search_payload` and `_build_contact_search_payload` translate flat snake_case args into the `matchCriteria` format. `_company_id_payload` is a helper that picks the best identifier (ZoomInfo ID > domain > company name) for enrichment/research tools.

**Composite tools** (`account_research`, `contact_research`, `get_gtm_context`) send a single request to ZoomInfo's `/research/*` or `/gtm/*` endpoints — ZoomInfo itself aggregates multiple data sources server-side.

## Key API Endpoints

| Endpoint | Tools |
|---|---|
| `/search/company` | `search_companies`, `lookup` (company path) |
| `/search/contact` | `search_contacts`, `lookup` (contact path) |
| `/enrich/company` | `enrich_company` |
| `/enrich/contact` | `enrich_contact` |
| `/enrich/intent` | `enrich_intent` |
| `/enrich/news` | `enrich_news` |
| `/enrich/scoops` | `enrich_scoops` |
| `/search/similarcompanies` | `find_similar_companies` |
| `/search/similarcontacts` | `find_similar_contacts` |
| `/search/intent` | `search_intent` |
| `/recommend/contacts` | `get_recommended_contacts` |
| `/research/account` | `account_research` |
| `/research/contact` | `contact_research` |
| `/gtm/context` | `get_gtm_context` |
