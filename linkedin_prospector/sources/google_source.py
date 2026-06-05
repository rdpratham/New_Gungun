"""
Google Search scraper for professional profile discovery.
Finds LinkedIn, company profiles, and contact info via Google.
"""

import asyncio
import re
from typing import Optional
from urllib.parse import quote_plus

from playwright.async_api import async_playwright, Page

from utils.cache import Cache
from utils.rate_limiter import throttle
from utils.normalizer import Contact

_cache = Cache(ttl_hours=48)
_GOOGLE_BASE = "https://www.google.com/search?q="
_LI_PATTERN = re.compile(r"linkedin\.com/in/([\w\-]+)", re.I)


async def _fetch_google_html(page: Page, query: str) -> str:
    url = _GOOGLE_BASE + quote_plus(query)
    await throttle("google")
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(1.5)
    return await page.content()


def _extract_linkedin_urls(html: str) -> list[str]:
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    found = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        m = _LI_PATTERN.search(href)
        if m:
            slug = m.group(1)
            found.add(f"https://www.linkedin.com/in/{slug}/")
    for text in soup.get_text():
        pass
    # Also check visible text links
    for tag in soup.find_all(string=_LI_PATTERN):
        m = _LI_PATTERN.search(str(tag))
        if m:
            found.add(f"https://www.linkedin.com/in/{m.group(1)}/")
    return list(found)


def _extract_emails(html: str) -> list[str]:
    return list(set(re.findall(r"[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}", html)))


async def find_linkedin_url(
    name: str,
    company: str = "",
    title: str = "",
    location: str = "",
    *,
    playwright_page: Optional[Page] = None,
) -> str:
    """Return best matching LinkedIn profile URL for a person or '' if not found."""
    cache_key = f"{name}|{company}|{title}"
    cached = _cache.get("google_linkedin", cache_key)
    if cached is not None:
        return cached

    queries = [
        f'site:linkedin.com/in "{name}" "{company}"',
        f'site:linkedin.com/in "{name}" {company}' if company else "",
        f'"{name}" {company} {title} linkedin.com/in' if title else "",
        f'"{name}" {company} linkedin site:linkedin.com',
    ]
    queries = [q for q in queries if q]

    async def _run(page: Page) -> str:
        for q in queries:
            html = await _fetch_google_html(page, q)
            urls = _extract_linkedin_urls(html)
            if urls:
                # Prefer first result
                result = urls[0]
                _cache.set("google_linkedin", cache_key, result)
                return result
        _cache.set("google_linkedin", cache_key, "")
        return ""

    if playwright_page:
        return await _run(playwright_page)

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
            return await _run(page)
        finally:
            await browser.close()


async def google_search_contacts(
    query: str,
    max_results: int = 10,
) -> list[dict]:
    """
    Free-form Google search returning structured contact snippets.
    Good for discovering people when you don't know the exact company.
    """
    cached = _cache.get("google_search", query)
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
            await throttle("google")
            url = _GOOGLE_BASE + quote_plus(query)
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(1.5)

            from bs4 import BeautifulSoup
            html = await page.content()
            soup = BeautifulSoup(html, "html.parser")

            results = []
            for div in soup.select("div.g")[:max_results]:
                title_el = div.select_one("h3")
                link_el = div.select_one("a[href]")
                snippet_el = div.select_one("div[data-sncf], div.VwiC3b, span.st")
                if not title_el:
                    continue
                title = title_el.get_text(strip=True)
                link = link_el["href"] if link_el else ""
                snippet = snippet_el.get_text(strip=True) if snippet_el else ""
                linkedin_url = ""
                m = _LI_PATTERN.search(link)
                if m:
                    linkedin_url = f"https://www.linkedin.com/in/{m.group(1)}/"
                results.append({
                    "title": title,
                    "url": link,
                    "snippet": snippet,
                    "linkedin_url": linkedin_url,
                })

            _cache.set("google_search", query, results)
            return results
        finally:
            await browser.close()
