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

echo "[session-start] web-scraper-mcp is ready (fetch_page / fetch_links / fetch_raw)."
