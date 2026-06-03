"""LinkedIn scraping logic using Playwright."""

import asyncio
import random
import time
from urllib.parse import urlencode, quote_plus
from typing import Optional

from playwright.async_api import async_playwright, Page, BrowserContext


LINKEDIN_SEARCH_BASE = "https://www.linkedin.com/search/results/people/"


def build_search_url(
    keywords: Optional[str] = None,
    designation: Optional[str] = None,
    process: Optional[str] = None,
    location: Optional[str] = None,
    company: Optional[str] = None,
    page: int = 1,
) -> str:
    parts = []
    if keywords:
        parts.append(keywords)
    if designation:
        parts.append(designation)
    if process:
        parts.append(process)

    query = " ".join(parts) if parts else "professional"

    params = {"keywords": query}
    if location:
        params["geoUrn"] = location  # LinkedIn uses geoUrn but keywords fallback works
    if company:
        params["company"] = company
    if page > 1:
        params["page"] = str(page)

    return f"{LINKEDIN_SEARCH_BASE}?{urlencode(params)}"


async def _random_delay(min_s: float = 2.0, max_s: float = 4.0) -> None:
    await asyncio.sleep(random.uniform(min_s, max_s))


async def _scroll_page(page: Page) -> None:
    """Scroll down gradually to trigger lazy-loaded cards."""
    for _ in range(4):
        await page.evaluate("window.scrollBy(0, window.innerHeight * 0.8)")
        await asyncio.sleep(0.6)


async def _extract_profiles(page: Page) -> list[dict]:
    """Extract profile cards from the current search results page."""
    await _scroll_page(page)

    profiles = []

    # LinkedIn people search result cards
    cards = await page.query_selector_all("li.reusable-search__result-container")
    if not cards:
        # Alternate selector used in some LinkedIn layouts
        cards = await page.query_selector_all("div.entity-result")

    for card in cards:
        try:
            name_el = await card.query_selector(
                "span.entity-result__title-text a span[aria-hidden='true']"
            )
            if not name_el:
                name_el = await card.query_selector("span.actor-name")
            name = (await name_el.inner_text()).strip() if name_el else "Unknown"

            title_el = await card.query_selector(
                "div.entity-result__primary-subtitle"
            )
            title = (await title_el.inner_text()).strip() if title_el else ""

            company_el = await card.query_selector(
                "div.entity-result__secondary-subtitle"
            )
            company = (await company_el.inner_text()).strip() if company_el else ""

            location_el = await card.query_selector(
                "div.entity-result__tertiary-subtitle"
            )
            location = (await location_el.inner_text()).strip() if location_el else ""

            link_el = await card.query_selector(
                "span.entity-result__title-text a"
            )
            profile_url = ""
            if link_el:
                href = await link_el.get_attribute("href")
                if href:
                    # Strip query params after profile path
                    profile_url = href.split("?")[0].rstrip("/")

            if name and name != "Unknown" and profile_url:
                profiles.append(
                    {
                        "name": name,
                        "title": title,
                        "company": company,
                        "location": location,
                        "profile_url": profile_url,
                    }
                )
        except Exception:
            continue

    return profiles


async def scrape_linkedin(
    keywords: Optional[str] = None,
    designation: Optional[str] = None,
    process: Optional[str] = None,
    location: Optional[str] = None,
    company: Optional[str] = None,
    max_pages: int = 3,
    auth_state_path: str = "auth_state.json",
) -> list[dict]:
    """
    Scrape LinkedIn people search results.

    Requires a pre-authenticated browser state saved at auth_state_path.
    Run `playwright codegen linkedin.com` to generate and save cookies first.
    """
    all_profiles: list[dict] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)

        # Try to load saved auth state (cookies / local storage)
        try:
            context: BrowserContext = await browser.new_context(
                storage_state=auth_state_path,
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 800},
            )
        except FileNotFoundError:
            print(
                f"[warning] Auth state file '{auth_state_path}' not found. "
                "Proceeding without login — results will be limited.\n"
                "See README for how to save your LinkedIn session."
            )
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 800},
            )

        page = await context.new_page()

        for page_num in range(1, max_pages + 1):
            url = build_search_url(
                keywords=keywords,
                designation=designation,
                process=process,
                location=location,
                company=company,
                page=page_num,
            )
            print(f"  Fetching page {page_num}: {url}")

            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            except Exception as e:
                print(f"  [error] Failed to load page {page_num}: {e}")
                break

            # Detect login wall
            if "authwall" in page.url or "login" in page.url:
                print(
                    "\n[blocked] LinkedIn redirected to login page.\n"
                    "Please save your browser session first.\n"
                    "Run: playwright codegen --save-storage=auth_state.json linkedin.com\n"
                    "Then log in and close the browser.\n"
                )
                await browser.close()
                return []

            profiles = await _extract_profiles(page)
            print(f"  Found {len(profiles)} profiles on page {page_num}.")
            all_profiles.extend(profiles)

            if page_num < max_pages:
                await _random_delay()

        await browser.close()

    # Deduplicate by profile URL
    seen = set()
    unique = []
    for p in all_profiles:
        if p["profile_url"] not in seen:
            seen.add(p["profile_url"])
            unique.append(p)

    return unique


def scrape_from_html(raw_html: str) -> list[dict]:
    """
    Fallback: parse profiles from pasted raw HTML (BeautifulSoup).
    Use when Playwright is blocked and the user manually copies page source.
    """
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(raw_html, "html.parser")
    profiles = []

    for card in soup.select("li.reusable-search__result-container, div.entity-result"):
        try:
            name_el = card.select_one(
                "span.entity-result__title-text a span[aria-hidden='true']"
            )
            name = name_el.get_text(strip=True) if name_el else "Unknown"

            title_el = card.select_one("div.entity-result__primary-subtitle")
            title = title_el.get_text(strip=True) if title_el else ""

            company_el = card.select_one("div.entity-result__secondary-subtitle")
            company = company_el.get_text(strip=True) if company_el else ""

            location_el = card.select_one("div.entity-result__tertiary-subtitle")
            location = location_el.get_text(strip=True) if location_el else ""

            link_el = card.select_one("span.entity-result__title-text a")
            profile_url = ""
            if link_el and link_el.get("href"):
                profile_url = link_el["href"].split("?")[0].rstrip("/")

            if name and name != "Unknown":
                profiles.append(
                    {
                        "name": name,
                        "title": title,
                        "company": company,
                        "location": location,
                        "profile_url": profile_url or "N/A",
                    }
                )
        except Exception:
            continue

    return profiles
