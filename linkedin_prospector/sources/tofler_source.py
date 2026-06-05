"""
Tofler.in scraper — Indian company registry data.
Extracts company info, directors, financials.
"""

import asyncio
import re
from urllib.parse import quote_plus

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

from utils.cache import Cache
from utils.rate_limiter import throttle
from utils.normalizer import Company, Contact

_cache = Cache(ttl_hours=168)  # Company data stale after 1 week
_BASE = "https://www.tofler.in"


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


async def search_company(company_name: str) -> list[dict]:
    """Search Tofler for companies matching the name."""
    cached = _cache.get("tofler_search", company_name)
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
            await throttle("tofler")
            url = f"{_BASE}/search?query={quote_plus(company_name)}"
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(2)

            html = await page.content()
            soup = BeautifulSoup(html, "html.parser")

            results = []
            # Tofler search result cards
            for card in soup.select(".company-card, .search-result-item, .company-list-item"):
                name_el = card.select_one(".company-name, h3, h4, .name")
                cin_el = card.select_one(".cin, .company-cin, [data-cin]")
                status_el = card.select_one(".status, .company-status")
                link_el = card.select_one("a[href]")

                name = _clean(name_el.get_text()) if name_el else ""
                cin = _clean(cin_el.get_text()) if cin_el else ""
                status = _clean(status_el.get_text()) if status_el else ""
                link = _BASE + link_el["href"] if link_el else ""

                if name:
                    results.append({
                        "name": name,
                        "cin": cin,
                        "status": status,
                        "url": link,
                        "source": "tofler",
                    })

            _cache.set("tofler_search", company_name, results)
            return results
        except Exception as e:
            return [{"error": str(e)}]
        finally:
            await browser.close()


async def get_company_details(company_url: str) -> Company:
    """Scrape full company details from a Tofler company page."""
    cached = _cache.get("tofler_details", company_url)
    if cached is not None:
        return Company(**cached)

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
            await throttle("tofler")
            await page.goto(company_url, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(2)

            html = await page.content()
            soup = BeautifulSoup(html, "html.parser")

            def _field(label: str) -> str:
                el = soup.find(string=re.compile(label, re.I))
                if el and el.parent:
                    sib = el.parent.find_next_sibling()
                    if sib:
                        return _clean(sib.get_text())
                return ""

            company = Company(
                name=_clean(soup.select_one("h1, .company-name")
                            .get_text() if soup.select_one("h1, .company-name") else ""),
                cin=_field("CIN"),
                status=_field("Status"),
                incorporation_date=_field("Date of Incorporation"),
                registered_address=_field("Registered Address"),
                category=_field("Company Category"),
                sub_category=_field("Company Sub.Category"),
                authorised_capital=_field("Authorised Capital"),
                paid_up_capital=_field("Paid Up Capital"),
                source="tofler",
            )

            # Extract directors
            directors = []
            for row in soup.select(".director-row, table.directors-table tr, .director-card"):
                name_el = row.select_one(".director-name, td:first-child, .name")
                din_el = row.select_one(".din, .director-din, td:nth-child(2)")
                desg_el = row.select_one(".designation, td:nth-child(3)")
                if name_el:
                    directors.append({
                        "name": _clean(name_el.get_text()),
                        "din": _clean(din_el.get_text()) if din_el else "",
                        "designation": _clean(desg_el.get_text()) if desg_el else "Director",
                    })
            company.directors = directors

            _cache.set("tofler_details", company_url, company.to_dict())
            return company
        except Exception as e:
            return Company(name="", source="tofler", raw={"error": str(e)})
        finally:
            await browser.close()


async def get_directors_as_contacts(company_name: str) -> list[Contact]:
    """Return directors of a company as Contact objects."""
    companies = await search_company(company_name)
    if not companies or "error" in companies[0]:
        return []

    top = companies[0]
    if not top.get("url"):
        return []

    company = await get_company_details(top["url"])
    contacts = []
    for d in company.directors:
        parts = d["name"].split()
        contacts.append(Contact(
            full_name=d["name"],
            first_name=parts[0] if parts else "",
            last_name=" ".join(parts[1:]) if len(parts) > 1 else "",
            designation=d.get("designation", "Director"),
            company=company.name,
            source="tofler",
            confidence=0.85,
        ))
    return contacts
