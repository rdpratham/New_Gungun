"""
Crunchbase public scraper — startup/company data and key people.
Uses public pages only (no API key required).
"""

import asyncio
import re
from urllib.parse import quote_plus

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

from utils.cache import Cache
from utils.rate_limiter import throttle
from utils.normalizer import Company, Contact

_cache = Cache(ttl_hours=72)
_BASE = "https://www.crunchbase.com"


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


async def search_company(company_name: str) -> list[dict]:
    """Search Crunchbase for companies."""
    cached = _cache.get("crunchbase_search", company_name)
    if cached is not None:
        return cached

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        )
        page = await ctx.new_page()
        try:
            await throttle("crunchbase")
            url = f"{_BASE}/search/organizations/field/organizations/facet_ids/company?q={quote_plus(company_name)}"
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(3)

            html = await page.content()
            soup = BeautifulSoup(html, "html.parser")

            results = []
            for item in soup.select("a[href*='/organization/']")[:10]:
                href = item.get("href", "")
                name = _clean(item.get_text())
                if href and name:
                    results.append({
                        "name": name,
                        "url": _BASE + href if href.startswith("/") else href,
                        "source": "crunchbase",
                    })

            _cache.set("crunchbase_search", company_name, results)
            return results
        except Exception as e:
            return [{"error": str(e)}]
        finally:
            await browser.close()


async def get_company_people(company_slug: str) -> list[Contact]:
    """Get key people from a Crunchbase company page."""
    cached = _cache.get("crunchbase_people", company_slug)
    if cached is not None:
        return [Contact(**c) for c in cached]

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        )
        page = await ctx.new_page()
        try:
            await throttle("crunchbase")
            url = f"{_BASE}/organization/{company_slug}/people"
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(3)

            html = await page.content()
            soup = BeautifulSoup(html, "html.parser")

            contacts = []
            for card in soup.select("[class*='person-card'], [class*='team-member']"):
                name_el = card.select_one("[class*='name'], h4, h3")
                title_el = card.select_one("[class*='title'], [class*='role']")
                link_el = card.select_one("a[href*='/person/']")

                name = _clean(name_el.get_text()) if name_el else ""
                title = _clean(title_el.get_text()) if title_el else ""
                profile_url = ""
                if link_el:
                    href = link_el.get("href", "")
                    profile_url = _BASE + href if href.startswith("/") else href

                if name:
                    parts = name.split()
                    contacts.append(Contact(
                        full_name=name,
                        first_name=parts[0] if parts else "",
                        last_name=" ".join(parts[1:]) if len(parts) > 1 else "",
                        designation=title,
                        source="crunchbase",
                        confidence=0.8,
                        raw={"crunchbase_url": profile_url},
                    ))

            _cache.set("crunchbase_people", company_slug, [c.to_dict() for c in contacts])
            return contacts
        except Exception as e:
            return []
        finally:
            await browser.close()
