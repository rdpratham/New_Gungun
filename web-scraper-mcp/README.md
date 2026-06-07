# web-scraper-mcp

An intelligent, enterprise-grade **MCP (Model Context Protocol) server** for AI-powered web scraping.

Give it a URL (or a list of URLs) and a **plain-English description** of what you want — it understands your *intent* (even with casual phrasing or typos), fetches the page (using Puppeteer for JS-heavy sites and Cheerio/fetch for static ones), and uses Claude to extract exactly the data you asked for as clean, structured JSON.

---

## Features

- **Intent-aware extraction** — describe what you want in plain English; Claude figures out the rest.
- **Smart engine selection** — auto-detects JS-rendered pages (Puppeteer) vs. static pages (fast `node-fetch` + Cheerio).
- **Robust fetching** — follows redirects, rotates user agents, handles gzip/encoding, 3 retries with exponential backoff, and configurable per-host rate limiting.
- **Five tools** — single page, many pages (concurrent + deduped), automatic pagination, link filtering, and scrape-to-file (JSON / CSV / Markdown).
- **Resilient** — captcha/403 detection with clear messages, helpful "nothing found" responses, structured logging, and it never crashes the MCP connection.

---

## Tools

| Tool | Inputs | What it does |
| --- | --- | --- |
| `scrape_url` | `url`, `query` | Scrape one page and extract the requested data. |
| `scrape_multiple_urls` | `urls[]`, `query` | Scrape many URLs concurrently (max 5 at a time), merge & deduplicate results. |
| `scrape_paginated` | `start_url`, `query`, `max_pages` (default 10) | Auto-detect and follow pagination, combining results across pages. |
| `extract_links` | `url`, `filter_description` | Return only the links matching your plain-English filter. |
| `scrape_and_save` | `url`, `query`, `format` (`json`\|`csv`\|`markdown`), `filename` | Scrape and save the data to a local file. |

### Standard output shape

Every tool returns a structured JSON object:

```json
{
  "success": true,
  "url": "https://example.com",
  "query": "all product names and prices",
  "data": [
    { "product_name": "Widget A", "price": "$19.99" },
    { "product_name": "Widget B", "price": "$24.50" }
  ],
  "count": 2,
  "scrape_method": "cheerio",
  "duration_ms": 1200
}
```

---

## Install

```bash
git clone <your-repo-url>
cd web-scraper-mcp
npm install
npm run build
```

> `npm install` downloads a Chromium build for Puppeteer. On Linux you may also need system libraries (e.g. `libnss3`, `libatk1.0-0`, `libgbm1`, `libasound2`). On Debian/Ubuntu: `npx puppeteer browsers install chrome` and install the listed deps if Chromium fails to launch.

---

## Set your Anthropic API key

The server uses Claude for intelligent extraction, so it needs an API key.

**macOS / Linux:**

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

**Windows (PowerShell):**

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
```

Or copy `.env.example` to `.env` and fill it in (your process manager / shell must load it; the server reads from the environment).

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | ✅ | — | Anthropic API key for extraction. |
| `EXTRACTION_MODEL` | ❌ | `claude-sonnet-4-20250514` | Claude model used for extraction. |
| `LOG_LEVEL` | ❌ | `info` | `error`\|`warn`\|`info`\|`http`\|`verbose`\|`debug`. |
| `LOG_FILE` | ❌ | — | Also write logs to this file. |
| `SCRAPE_DELAY_MS` | ❌ | `1000` | Min delay between requests to the same host. |
| `SCRAPE_OUTPUT_DIR` | ❌ | `./scraped_output` | Where `scrape_and_save` writes files. |

---

## Example queries (plain English)

The extractor is built to understand intent, not keywords. Real examples you can give:

1. `"get me all the product names and their prices"`
2. `"extract every news headline along with its publish date"`
3. `"scrape the contact info from this page — emails and phone numbers"`
4. `"grab all the job listings that mention a salary"`
5. `"pull out the names and ratings of all the reviews"`
6. `"i want every event with its date and location lol"` *(casual phrasing — still works)*
7. `"get all the resturant names and addreses"` *(typos — still works)*
8. `"list the top stories and how many comments each one has"`
9. `"extract the FAQ questions and answers"`
10. `"give me all the downloadable PDF links and their titles"`

For `extract_links`, the `filter_description` works the same way: `"only product pages"`, `"just the blog post links"`, `"external links to social media"`.

---

## Add to Claude Desktop

Open your Claude Desktop config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add this server under `mcpServers` (use the **absolute path** to the built `dist/index.js`):

```json
{
  "mcpServers": {
    "web-scraper": {
      "command": "node",
      "args": ["/absolute/path/to/web-scraper-mcp/dist/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

Then fully restart Claude Desktop. You should see the `web-scraper` tools available. Try:

> "Use the web scraper to get all the product names and prices from https://example.com"

---

## No-API mode (let your host model do the extraction)

If you're using **Claude Code** (or any MCP host with its own model), you don't
need an Anthropic API key at all. In this mode the scraper only fetches and
cleans pages; the model already driving your session does the extraction.

Two ways to use it:

### A) As a named MCP tool in Claude Code (recommended)

A project-level `.mcp.json` is included at the repo root that registers a
**no-API** server (`web-scraper-fetch`) exposing three tools:

| Tool | Returns | The model then… |
| --- | --- | --- |
| `fetch_page` | Cleaned page text + title | extracts whatever you asked for |
| `fetch_links` | All links (absolute URL + text) | filters them by your intent |
| `fetch_raw` | Cleaned HTML | extracts when structure matters |

Each accepts `url` and an optional `force_puppeteer: true`. After `npm run build`,
just open Claude Code in the repo and ask:

> "Scrape https://news.ycombinator.com and give me the top 10 titles with points and comments"

Claude Code calls `fetch_page`, reads the text, and extracts the answer itself —
**no `ANTHROPIC_API_KEY` required.** If the relative path in `.mcp.json` doesn't
resolve in your setup, change it to the absolute path of
`web-scraper-mcp/dist/server_no_api.js`.

You can also run the no-API server standalone:

```bash
npm run start:noapi
```

### B) As a plain CLI

```bash
node dist/fetch_cli.js <url>            # cleaned page text  → model extracts
node dist/fetch_cli.js <url> --links    # all links          → model filters
node dist/fetch_cli.js <url> --raw      # stripped HTML
node dist/fetch_cli.js <url> --puppeteer  # force JS rendering
```

---

## Development

```bash
npm run dev      # run from source with ts-node
npm run build    # compile TypeScript to dist/
npm run watch    # recompile on change
npm start        # run the compiled server
```

---

## How engine auto-detection works

1. The page is first fetched statically with `node-fetch`.
2. If the response is blocked (403/captcha) or the visible content is thin / shows SPA markers (`#root`, `__next`, `ng-app`, etc.), the scraper escalates to **Puppeteer** and renders the page with a headless browser.
3. Boilerplate (scripts, styles, nav, footer, cookie banners) is stripped before the cleaned text is sent to Claude for extraction.

---

## License

MIT
