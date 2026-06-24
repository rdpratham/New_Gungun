#!/bin/bash
set -euo pipefail

# SessionStart hook: prepares the web-scraper-mcp tool so it's ready to use the
# moment a Claude Code session starts — no local install required.
#
# It installs dependencies and builds the TypeScript so that:
#   - the no-API MCP server (.mcp.json -> web-scraper-mcp/dist/server_no_api.js) loads
#   - the fetch CLI (web-scraper-mcp/dist/fetch_cli.js) is runnable
#
# Runs only in Claude Code on the web (remote). Remove the guard below if you
# also want it to run in local sessions.

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
SCRAPER_DIR="$PROJECT_DIR/web-scraper-mcp"

if [ ! -f "$SCRAPER_DIR/package.json" ]; then
  echo "web-scraper-mcp not found at $SCRAPER_DIR — skipping." >&2
  exit 0
fi

cd "$SCRAPER_DIR"

echo "[session-start] Installing web-scraper-mcp dependencies..."
npm install --no-audit --no-fund

echo "[session-start] Building web-scraper-mcp..."
npm run build

# Make TLS-inspecting-proxy environments work out of the box for CLI runs too.
# (The MCP server already gets this via .mcp.json env.)
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export SCRAPE_INSECURE_TLS=true' >> "$CLAUDE_ENV_FILE"
fi

echo "[session-start] web-scraper-mcp is ready (fetch_page / fetch_links / fetch_raw)."

# Build browser-agent MCP server
BROWSER_AGENT_DIR="$PROJECT_DIR/browser-agent"
if [ -f "$BROWSER_AGENT_DIR/package.json" ]; then
  echo "[session-start] Installing browser-agent dependencies..."
  cd "$BROWSER_AGENT_DIR"
  npm install --no-audit --no-fund

  echo "[session-start] Building browser-agent..."
  npm run build

  echo "[session-start] Installing Playwright Chromium..."
  PLAYWRIGHT_BROWSERS_PATH=/tmp/pw npx playwright install chromium

  echo "[session-start] browser-agent is ready (browser_navigate / browser_click / browser_type / ...)."
fi
