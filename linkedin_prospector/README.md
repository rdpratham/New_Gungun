# LinkedIn Sales Prospector

A CLI tool that scrapes LinkedIn people search results and uses Claude AI to score each profile for sales outreach relevance.

## Setup

### 1. Install dependencies

```bash
cd linkedin_prospector
pip install -r requirements.txt
playwright install chromium
```

### 2. Save your LinkedIn session (required for full results)

LinkedIn blocks unauthenticated scrapers. You must authenticate once and save the browser session:

```bash
playwright codegen --save-storage=auth_state.json https://www.linkedin.com
```

This opens a browser window. Log in to LinkedIn normally, then **close the browser**. Your session cookies are saved to `auth_state.json`.

> **Keep `auth_state.json` private** — it contains your LinkedIn session tokens.

### 3. Set your Anthropic API key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Or pass it directly with `--api-key`.

---

## Usage

### Basic

```bash
python main.py \
  --keywords "AI procurement" \
  --designation "CPO" \
  --process "digital transformation" \
  --location "France" \
  --company "Airbus"
```

### Interactive mode (no flags needed)

```bash
python main.py
```

The tool will prompt you for each criterion.

### All options

```
--keywords       Target keywords (e.g. "AI automation SaaS")
--designation    Target job title (e.g. "VP of Sales")
--process        Business process (e.g. "procurement", "hiring")
--location       Location filter (e.g. "France", "New York")
--company        Company name filter (e.g. "Airbus")
--pages          Number of LinkedIn pages to scrape (default: 3)
--auth-state     Path to Playwright auth state file (default: auth_state.json)
--min-score      Only show profiles with score ≥ N (0–10)
--no-csv         Skip CSV export
--csv-output     Custom CSV file path
--no-score       Skip Claude scoring (faster, no API key needed)
--html-file      Fallback: parse profiles from a saved HTML file
--api-key        Anthropic API key (overrides env var)
```

### Fallback: paste raw HTML

If LinkedIn blocks the headless browser (CAPTCHA, rate limit, etc.), you can manually save the search results page as HTML from your browser and parse it:

```bash
# In your browser: File → Save Page As → results.html
python main.py --html-file results.html --keywords "AI" --designation "CPO"
```

---

## Output

### Terminal table

A color-coded table sorted by relevance score (highest first):

```
╭──────────────────────────────────────────────────────────────────────╮
│             LinkedIn Prospects (12 found)                            │
├──────────────────┬────────────────────┬──────────┬───────┬─────────╮│
│ Full Name        │ Job Title          │ Company  │ Score │ Notes   ││
├──────────────────┼────────────────────┼──────────┼───────┼─────────┤│
│ Marie Dupont     │ Chief Procurement  │ Airbus   │  9/10 │ ...     ││
│                  │ Officer            │          │       │         ││
╰──────────────────┴────────────────────┴──────────┴───────┴─────────╯
```

### CSV export

Automatically saved as `prospects_YYYY-MM-DD.csv` in the current directory (sorted by score, highest first).

---

## How scoring works

Each scraped profile is sent to Claude (`claude-sonnet-4-20250514`) with:
- The profile details (name, title, company, location)
- Your search criteria (keywords, designation, process, location, company)

Claude returns:
- **Score (0–10)**: Based on decision-making power, budget authority, keyword alignment, and process relevance
- **Notes**: 2–3 sentence explanation for the sales team

The system prompt is cached using Anthropic's prompt caching feature to reduce latency and API costs.

---

## Rate limiting

The scraper adds a **2–4 second random delay** between page loads to avoid triggering LinkedIn's rate limiter. Scraping 3 pages takes approximately 10–15 seconds.

---

## Notes

- LinkedIn's search results and HTML selectors may change over time. If the scraper returns 0 profiles, use the `--html-file` fallback.
- This tool is for legitimate B2B sales prospecting. Use in compliance with LinkedIn's Terms of Service.
- Session tokens in `auth_state.json` expire periodically. Re-run the `playwright codegen` command to refresh them.
