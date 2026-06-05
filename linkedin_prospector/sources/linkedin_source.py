"""
LinkedIn scraper — people search and profile extraction.
Requires saved auth_state.json for authenticated access.
"""

import asyncio
import random
import re
from typing import Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright, Browser, BrowserContext

from utils.cache import Cache
from utils.rate_limiter import throttle
from utils.normalizer import Contact

_cache = Cache(ttl_hours=24)


def _build_search_url(
    keywords: str = "",
    designation: str = "",
    process: str = "",
    location: str = "",
    company: str = "",
) -> str:
    parts = []
    if keywords:
        parts.append(keywords)
    if designation:
        parts.append(designation)
    if process:
        parts.append(process)
    if company:
        parts.append(company)
    q = quote_plus(" ".join(parts))
    url = f"https://www.linkedin.com/search/results/people/?keywords={q}"
    if location:
        url += f"&geoUrn={quote_plus(location)}"
    return url


def _parse_profile_cards(html: str) -> list[Contact]:
    soup = BeautifulSoup(html, "html.parser")
    contacts = []

    selectors = [
        "li.reusable-search__result-container",
        "li[class*='search-result']",
        "div[data-view-name='search-entity-result-universal-template']",
    ]
    cards = []
    for sel in selectors:
        cards = soup.select(sel)
        if cards:
            break

    for card in cards:
        name_el = card.select_one(
            "span[aria-hidden='true'], .entity-result__title-text a span"
        )
        title_el = card.select_one(
            ".entity-result__primary-subtitle, .subline-level-1"
        )
        location_el = card.select_one(
            ".entity-result__secondary-subtitle, .subline-level-2"
        )
        link_el = card.select_one("a[href*='/in/']")

        name = name_el.get_text(strip=True) if name_el else ""
        title = title_el.get_text(strip=True) if title_el else ""
        location = location_el.get_text(strip=True) if location_el else ""
        url = ""
        if link_el:
            href = link_el["href"]
            m = re.search(r"linkedin\.com/in/([\w%-]+)", href)
            if m:
                url = f"https://www.linkedin.com/in/{m.group(1)}/"

        # Split title into designation + company (format: "Title at Company")
        designation, company = "", ""
        if " at " in title:
            parts = title.split(" at ", 1)
            designation, company = parts[0].strip(), parts[1].strip()
        else:
            designation = title

        if name:
            parts_name = name.split()
            contacts.append(Contact(
                full_name=name,
                first_name=parts_name[0] if parts_name else "",
                last_name=" ".join(parts_name[1:]) if len(parts_name) > 1 else "",
                designation=designation,
                company=company,
                location=location,
                linkedin_url=url,
                source="linkedin",
                confidence=0.95 if url else 0.6,
            ))

    return contacts


async def scrape_people_search(
    keywords: str = "",
    designation: str = "",
    process: str = "",
    location: str = "",
    company: str = "",
    max_pages: int = 3,
    auth_state_path: str = "auth_state.json",
) -> list[Contact]:
    cache_key = f"{keywords}|{designation}|{process}|{location}|{company}|{max_pages}"
    cached = _cache.get("linkedin_search", cache_key)
    if cached is not None:
        return [Contact(**c) for c in cached]

    import os
    contacts = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx_kwargs: dict = {
            "user_agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        }
        if os.path.exists(auth_state_path):
            ctx_kwargs["storage_state"] = auth_state_path

        ctx = await browser.new_context(**ctx_kwargs)
        page = await ctx.new_page()

        try:
            base_url = _build_search_url(keywords, designation, process, location, company)
            seen_urls: set[str] = set()

            for page_num in range(1, max_pages + 1):
                url = base_url + (f"&start={10 * (page_num - 1)}" if page_num > 1 else "")
                await throttle("linkedin")
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await asyncio.sleep(random.uniform(2, 4))

                html = await page.content()
                if "authwall" in html.lower() or "sign in" in html.lower():
                    break

                page_contacts = _parse_profile_cards(html)
                for c in page_contacts:
                    if c.linkedin_url and c.linkedin_url not in seen_urls:
                        seen_urls.add(c.linkedin_url)
                        contacts.append(c)
                    elif not c.linkedin_url and c.full_name not in [x.full_name for x in contacts]:
                        contacts.append(c)

                if not page_contacts:
                    break

        finally:
            await browser.close()

    _cache.set("linkedin_search", cache_key, [c.to_dict() for c in contacts])
    return contacts


async def get_profile_url_via_google(
    name: str,
    company: str = "",
    title: str = "",
) -> str:
    """Use Google to find a LinkedIn profile URL without hitting LinkedIn directly."""
    from sources.google_source import find_linkedin_url
    return await find_linkedin_url(name, company, title)
