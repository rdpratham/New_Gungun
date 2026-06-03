#!/usr/bin/env python3
"""
MCP server exposing the LinkedIn prospector as callable Claude tools.

Tools:
  - search_linkedin_prospects  : scrape + score LinkedIn profiles
  - parse_html_prospects        : score profiles from pasted/saved HTML
"""

import asyncio
import json
import os
import sys

# Ensure sibling modules are importable when invoked from any cwd
sys.path.insert(0, os.path.dirname(__file__))

from mcp.server.fastmcp import FastMCP
from scorer import score_profiles
from exporter import export_csv

mcp = FastMCP("linkedin-prospector")


@mcp.tool()
async def search_linkedin_prospects(
    keywords: str = "",
    designation: str = "",
    process: str = "",
    location: str = "",
    company: str = "",
    pages: int = 3,
    min_score: int = 0,
    export_csv_file: bool = True,
    auth_state_path: str = "auth_state.json",
    anthropic_api_key: str = "",
) -> str:
    """
    Scrape LinkedIn people search and score each profile with Claude AI.

    Pass at least one of: keywords, designation, process, location, company.
    Returns a JSON list of scored prospects sorted by relevance score (highest first).

    Args:
        keywords: Target domain keywords, e.g. "AI automation SaaS"
        designation: Target job title, e.g. "VP of Sales" or "CPO"
        process: Business process, e.g. "procurement" or "digital transformation"
        location: Location filter, e.g. "France" or "New York"
        company: Company name filter, e.g. "Airbus" or "Salesforce"
        pages: Number of LinkedIn result pages to scrape (1-5, default 3)
        min_score: Only return profiles with score >= this value (0-10)
        export_csv_file: If true, also save results to prospects_YYYY-MM-DD.csv
        auth_state_path: Path to saved Playwright auth state (login cookies)
        anthropic_api_key: Anthropic API key (falls back to ANTHROPIC_API_KEY env var)
    """
    from scraper import scrape_linkedin

    if not any([keywords, designation, process, location, company]):
        return json.dumps({"error": "Provide at least one search criterion."})

    profiles = await scrape_linkedin(
        keywords=keywords or None,
        designation=designation or None,
        process=process or None,
        location=location or None,
        company=company or None,
        max_pages=max(1, min(pages, 5)),
        auth_state_path=auth_state_path,
    )

    if not profiles:
        return json.dumps({
            "error": "No profiles scraped. Check auth_state.json or use parse_html_prospects.",
            "profiles": [],
        })

    api_key = anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return json.dumps({
            "error": "No Anthropic API key. Pass anthropic_api_key or set ANTHROPIC_API_KEY.",
            "raw_profiles": profiles,
        })

    scored = score_profiles(
        profiles=profiles,
        keywords=keywords or None,
        designation=designation or None,
        process=process or None,
        location=location or None,
        company=company or None,
        api_key=api_key,
    )

    if min_score > 0:
        scored = [p for p in scored if p.get("score", 0) >= min_score]

    scored.sort(key=lambda p: p.get("score", 0), reverse=True)

    if export_csv_file:
        csv_path = export_csv(scored)
        for p in scored:
            p["_csv_exported_to"] = csv_path

    return json.dumps(scored, ensure_ascii=False, indent=2)


@mcp.tool()
async def parse_html_prospects(
    html: str,
    keywords: str = "",
    designation: str = "",
    process: str = "",
    location: str = "",
    company: str = "",
    min_score: int = 0,
    export_csv_file: bool = True,
    anthropic_api_key: str = "",
) -> str:
    """
    Parse LinkedIn profiles from raw HTML (fallback when scraping is blocked).

    Paste the raw HTML of a LinkedIn people search results page. This tool
    extracts profiles and scores them with Claude AI.

    Args:
        html: Raw HTML content of a LinkedIn search results page
        keywords: Target domain keywords used for scoring
        designation: Target job title used for scoring
        process: Business process used for scoring
        location: Location used for scoring
        company: Company name used for scoring
        min_score: Only return profiles with score >= this value (0-10)
        export_csv_file: If true, also save results to prospects_YYYY-MM-DD.csv
        anthropic_api_key: Anthropic API key (falls back to ANTHROPIC_API_KEY env var)
    """
    from scraper import scrape_from_html

    profiles = scrape_from_html(html)
    if not profiles:
        return json.dumps({"error": "No profiles found in the provided HTML.", "profiles": []})

    api_key = anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return json.dumps({
            "error": "No Anthropic API key. Pass anthropic_api_key or set ANTHROPIC_API_KEY.",
            "raw_profiles": profiles,
        })

    scored = score_profiles(
        profiles=profiles,
        keywords=keywords or None,
        designation=designation or None,
        process=process or None,
        location=location or None,
        company=company or None,
        api_key=api_key,
    )

    if min_score > 0:
        scored = [p for p in scored if p.get("score", 0) >= min_score]

    scored.sort(key=lambda p: p.get("score", 0), reverse=True)

    if export_csv_file:
        csv_path = export_csv(scored)
        for p in scored:
            p["_csv_exported_to"] = csv_path

    return json.dumps(scored, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    mcp.run()
