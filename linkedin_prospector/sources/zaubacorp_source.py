"""
Zaubacorp.com scraper — Indian company registry (MCA data).
Provides CIN lookup, director details, and company financials.
"""

import asyncio
import re
from urllib.parse import quote_plus

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

from utils.cache import Cache
from utils.rate_limiter import throttle
from utils.normalizer import Company, Contact

_cache = Cache(ttl_hours=168)
_BASE = "https://www.zaubacorp.com"


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


async def search_company(company_name: str) -> list[dict]:
    """Search Zaubacorp for Indian companies."""
    cached = _cache.get("zauba_search", company_name)
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
            await throttle("zaubacorp")
            url = f"{_BASE}/company-name-starts-with/{quote_plus(company_name)}/page/1"
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(2)

            html = await page.content()
            soup = BeautifulSoup(html, "html.parser")

            results = []
            for row in soup.select("table tbody tr, .company-row"):
                cells = row.select("td")
                if len(cells) < 2:
                    continue
                name = _clean(cells[0].get_text()) if cells else ""
                cin = _clean(cells[1].get_text()) if len(cells) > 1 else ""
                status = _clean(cells[2].get_text()) if len(cells) > 2 else ""
                link_el = cells[0].select_one("a")
                link = _BASE + link_el["href"] if link_el else ""

                if name and cin:
                    results.append({
                        "name": name,
                        "cin": cin,
                        "status": status,
                        "url": link,
                        "source": "zaubacorp",
                    })

            _cache.set("zauba_search", company_name, results)
            return results
        except Exception as e:
            return [{"error": str(e)}]
        finally:
            await browser.close()


async def get_company_by_cin(cin: str) -> Company:
    """Get full company details by CIN from Zaubacorp."""
    cached = _cache.get("zauba_cin", cin)
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
            await throttle("zaubacorp")
            url = f"{_BASE}/company/{cin}"
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(2)

            html = await page.content()
            soup = BeautifulSoup(html, "html.parser")

            def _row_val(label: str) -> str:
                for tr in soup.select("tr"):
                    tds = tr.select("td")
                    if len(tds) >= 2 and label.lower() in tds[0].get_text().lower():
                        return _clean(tds[1].get_text())
                return ""

            company = Company(
                name=_clean(soup.select_one("h1")
                            .get_text() if soup.select_one("h1") else ""),
                cin=cin,
                status=_row_val("Status"),
                incorporation_date=_row_val("Date of Incorporation"),
                registered_address=_row_val("Registered Address"),
                category=_row_val("Company Category"),
                authorised_capital=_row_val("Authorised Capital"),
                paid_up_capital=_row_val("Paid Up Capital"),
                source="zaubacorp",
            )

            # Directors table
            directors = []
            for row in soup.select("table tr"):
                cells = row.select("td")
                if len(cells) >= 3:
                    name = _clean(cells[0].get_text())
                    din = _clean(cells[1].get_text())
                    desg = _clean(cells[2].get_text())
                    if name and re.match(r"\d{8}", din):
                        directors.append({
                            "name": name,
                            "din": din,
                            "designation": desg or "Director",
                        })
            company.directors = directors

            _cache.set("zauba_cin", cin, company.to_dict())
            return company
        except Exception as e:
            return Company(name="", cin=cin, source="zaubacorp", raw={"error": str(e)})
        finally:
            await browser.close()


async def get_directors_as_contacts(company_name: str) -> list[Contact]:
    """Return directors of an Indian company as Contact objects."""
    companies = await search_company(company_name)
    if not companies or "error" in companies[0]:
        return []

    top = companies[0]
    cin = top.get("cin", "")
    if not cin:
        return []

    company = await get_company_by_cin(cin)
    contacts = []
    for d in company.directors:
        parts = d["name"].split()
        contacts.append(Contact(
            full_name=d["name"],
            first_name=parts[0] if parts else "",
            last_name=" ".join(parts[1:]) if len(parts) > 1 else "",
            designation=d.get("designation", "Director"),
            company=company.name,
            source="zaubacorp",
            confidence=0.9,
        ))
    return contacts
