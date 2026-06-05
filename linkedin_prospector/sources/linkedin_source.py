"""
LinkedIn scraper — people search and full profile data extraction.
Requires saved auth_state.json for authenticated access.

Supports:
- People search with US/global location geo URNs
- Full profile page scraping (experience, education, about, skills)
- Smart pagination with deduplication
- Result caching to avoid re-scraping
"""

import asyncio
import random
import re
import os
from urllib.parse import quote_plus, urlencode

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

from utils.cache import Cache
from utils.rate_limiter import throttle
from utils.normalizer import Contact

_cache = Cache(ttl_hours=24)

# LinkedIn geo URN codes for US locations
US_GEO_URNS: dict[str, str] = {
    # Country
    "united states": "103644278",
    "us": "103644278",
    "usa": "103644278",
    # Metro areas
    "new york": "102571732",
    "new york city": "102571732",
    "nyc": "102571732",
    "new york metropolitan area": "90000070",
    "los angeles": "102450268",
    "la": "102450268",
    "chicago": "103112676",
    "san francisco": "102277331",
    "sf": "102277331",
    "bay area": "90000084",
    "san francisco bay area": "90000084",
    "boston": "101002335",
    "seattle": "102288874",
    "washington dc": "103335767",
    "dc": "103335767",
    "dallas": "103815695",
    "houston": "103743442",
    "atlanta": "103479673",
    "miami": "102093800",
    "denver": "104900413",
    "austin": "107566566",
    "phoenix": "105054658",
    "philadelphia": "104937023",
    "detroit": "103740475",
    "minneapolis": "105096122",
    "charlotte": "104517918",
    "san diego": "102094966",
    "portland": "104819860",
    "nashville": "104495564",
    "raleigh": "105055800",
    "salt lake city": "105717009",
    "pittsburgh": "101165031",
    # States
    "california": "102095887",
    "texas": "102748797",
    "florida": "101318387",
    "new york state": "105080838",
    "illinois": "103300953",
    "pennsylvania": "105004698",
    "ohio": "107537996",
    "georgia": "106814180",
    "north carolina": "103323778",
    "michigan": "102750485",
    "new jersey": "102437638",
    "virginia": "104900652",
    "washington state": "103414035",
    "massachusetts": "101174742",
}


def _resolve_geo_urn(location: str) -> str:
    """Convert a location string to a LinkedIn geo URN, or return raw if already numeric."""
    if not location:
        return ""
    if location.strip().isdigit():
        return location.strip()
    return US_GEO_URNS.get(location.lower().strip(), "")


def _build_search_url(
    keywords: str = "",
    designation: str = "",
    process: str = "",
    company: str = "",
    geo_urn: str = "",
    network: str = "",        # "F" = 1st, "S" = 2nd, "O" = 3rd+
    current_company_urns: list[str] | None = None,
) -> str:
    parts = []
    if keywords:
        parts.append(keywords)
    if designation:
        parts.append(designation)
    if process:
        parts.append(process)
    if company and not current_company_urns:
        parts.append(company)

    params: dict = {}
    if parts:
        params["keywords"] = " ".join(parts)
    if geo_urn:
        params["geoUrn"] = f'["{geo_urn}"]'
    if network:
        params["network"] = f'["{network}"]'
    if current_company_urns:
        params["currentCompany"] = f'["{current_company_urns[0]}"]'

    base = "https://www.linkedin.com/search/results/people/?"
    return base + "&".join(f"{k}={quote_plus(str(v))}" for k, v in params.items())


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def _parse_profile_cards(html: str) -> list[Contact]:
    soup = BeautifulSoup(html, "html.parser")
    contacts = []

    # Try multiple card selectors (LinkedIn changes DOM frequently)
    card_selectors = [
        "li.reusable-search__result-container",
        "li[class*='search-result']",
        "div[data-view-name='search-entity-result-universal-template']",
        "li[class*='artdeco-list__item']",
    ]
    cards = []
    for sel in card_selectors:
        cards = soup.select(sel)
        if cards:
            break

    for card in cards:
        # Name
        name_el = card.select_one(
            "span[aria-hidden='true'], "
            ".entity-result__title-text a span[aria-hidden], "
            "a[data-field='result-lockup__name'] span"
        )
        # Primary subtitle (title + company)
        subtitle_el = card.select_one(
            ".entity-result__primary-subtitle, "
            ".subline-level-1, "
            "div[data-field='result-lockup__position-company']"
        )
        # Secondary subtitle (location)
        location_el = card.select_one(
            ".entity-result__secondary-subtitle, "
            ".subline-level-2, "
            "div[data-field='result-lockup__position-company'] + div"
        )
        # Insight (connections, mutual)
        insight_el = card.select_one(
            ".entity-result__insights, "
            ".search-result__social-proof"
        )
        # Profile link
        link_el = card.select_one("a[href*='/in/']")
        # Summary snippet
        snippet_el = card.select_one(
            ".entity-result__summary, "
            ".search-result__snippets"
        )

        name = _clean(name_el.get_text()) if name_el else ""
        if not name or name.lower() in ("linkedin member", ""):
            continue

        subtitle = _clean(subtitle_el.get_text()) if subtitle_el else ""
        location = _clean(location_el.get_text()) if location_el else ""
        insight = _clean(insight_el.get_text()) if insight_el else ""
        snippet = _clean(snippet_el.get_text()) if snippet_el else ""

        linkedin_url = ""
        if link_el:
            href = link_el.get("href", "")
            m = re.search(r"linkedin\.com/in/([\w%-]+)", href)
            if m:
                slug = m.group(1).split("?")[0].rstrip("/")
                linkedin_url = f"https://www.linkedin.com/in/{slug}/"

        # Parse "Title at Company" or "Title · Company"
        designation, company_name = "", ""
        for sep in (" at ", " · ", " | "):
            if sep in subtitle:
                parts = subtitle.split(sep, 1)
                designation, company_name = parts[0].strip(), parts[1].strip()
                break
        if not designation:
            designation = subtitle

        name_parts = name.split()
        contacts.append(Contact(
            full_name=name,
            first_name=name_parts[0] if name_parts else "",
            last_name=" ".join(name_parts[1:]) if len(name_parts) > 1 else "",
            designation=designation,
            company=company_name,
            location=location,
            linkedin_url=linkedin_url,
            source="linkedin",
            confidence=0.95 if linkedin_url else 0.6,
            raw={"insight": insight, "snippet": snippet},
        ))

    return contacts


def _parse_full_profile(html: str, profile_url: str = "") -> dict:
    """Extract all visible data from a LinkedIn profile page."""
    soup = BeautifulSoup(html, "html.parser")

    def _text(sel: str) -> str:
        el = soup.select_one(sel)
        return _clean(el.get_text()) if el else ""

    def _texts(sel: str) -> list[str]:
        return [_clean(el.get_text()) for el in soup.select(sel) if el.get_text(strip=True)]

    # Name and headline
    name = _text("h1") or _text(".text-heading-xlarge")
    headline = _text(".text-body-medium.break-words") or _text(".pv-text-details__left-panel .text-body-medium")
    location = _text(".text-body-small.inline.t-black--light.break-words") or _text(".pv-text-details__left-panel .t-black--light")
    connections = _text(".pv-header__connections-text") or _text("span[class*='connections']")
    about = _text("#about ~ div .pv-shared-text-with-see-more span, #about + div span")
    if not about:
        about_section = soup.find("div", {"id": "about"})
        if about_section:
            nxt = about_section.find_next("div", class_=re.compile("display-flex"))
            about = _clean(nxt.get_text()) if nxt else ""

    # Experience
    experiences = []
    exp_section = soup.find("div", {"id": "experience"})
    if exp_section:
        for item in exp_section.select("li.artdeco-list__item, li[class*='pvs-list__item']")[:10]:
            title_el = item.select_one("span[aria-hidden='true']")
            company_el = item.select_one("span.t-14.t-normal span[aria-hidden='true']")
            date_el = item.select_one("span.t-14.t-normal.t-black--light span[aria-hidden='true']")
            loc_el = item.select_all("span.t-14.t-normal.t-black--light span[aria-hidden='true']") if hasattr(item, 'select_all') else []
            title = _clean(title_el.get_text()) if title_el else ""
            company = _clean(company_el.get_text()) if company_el else ""
            dates = _clean(date_el.get_text()) if date_el else ""
            if title:
                experiences.append({"title": title, "company": company, "dates": dates})

    # Education
    educations = []
    edu_section = soup.find("div", {"id": "education"})
    if edu_section:
        for item in edu_section.select("li.artdeco-list__item, li[class*='pvs-list__item']")[:5]:
            spans = item.select("span[aria-hidden='true']")
            if spans:
                educations.append({
                    "school": _clean(spans[0].get_text()) if spans else "",
                    "degree": _clean(spans[1].get_text()) if len(spans) > 1 else "",
                    "years": _clean(spans[2].get_text()) if len(spans) > 2 else "",
                })

    # Skills
    skills = []
    skills_section = soup.find("div", {"id": "skills"})
    if skills_section:
        skills = [_clean(s.get_text()) for s in skills_section.select("span[aria-hidden='true']")[:15] if s.get_text(strip=True)]

    # Contact info (only visible if connected)
    email = ""
    phone = ""
    website = ""
    email_matches = re.findall(r"[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}", html)
    if email_matches:
        email = email_matches[0]

    return {
        "name": name,
        "headline": headline,
        "location": location,
        "connections": connections,
        "about": about,
        "linkedin_url": profile_url,
        "experience": experiences,
        "education": educations,
        "skills": skills,
        "email": email,
        "phone": phone,
        "website": website,
        "source": "linkedin",
    }


async def _make_browser_context(pw, auth_state_path: str):
    browser = await pw.chromium.launch(headless=True, args=[
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
    ])
    ctx_kwargs = {
        "user_agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "viewport": {"width": 1366, "height": 768},
        "locale": "en-US",
    }
    if os.path.exists(auth_state_path):
        ctx_kwargs["storage_state"] = auth_state_path
    ctx = await browser.new_context(**ctx_kwargs)
    # Mask automation fingerprint
    await ctx.add_init_script(
        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    )
    return browser, ctx


async def scrape_people_search(
    keywords: str = "",
    designation: str = "",
    process: str = "",
    location: str = "",
    company: str = "",
    us_only: bool = False,
    max_pages: int = 3,
    auth_state_path: str = "auth_state.json",
) -> list[Contact]:
    """Search LinkedIn people. Set us_only=True to restrict to United States."""
    # Resolve geo URN
    geo_urn = ""
    if us_only and not location:
        geo_urn = US_GEO_URNS["united states"]
    elif location:
        geo_urn = _resolve_geo_urn(location) or ""

    cache_key = f"{keywords}|{designation}|{process}|{location}|{company}|{us_only}|{max_pages}"
    cached = _cache.get("linkedin_search", cache_key)
    if cached is not None:
        return [Contact(**c) for c in cached]

    contacts: list[Contact] = []

    async with async_playwright() as pw:
        browser, ctx = await _make_browser_context(pw, auth_state_path)
        page = await ctx.new_page()
        try:
            base_url = _build_search_url(
                keywords=keywords,
                designation=designation,
                process=process,
                company=company,
                geo_urn=geo_urn,
            )
            seen_urls: set[str] = set()

            for page_num in range(1, max_pages + 1):
                url = base_url + (f"&start={10 * (page_num - 1)}" if page_num > 1 else "")
                await throttle("linkedin")
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                except Exception:
                    break
                await asyncio.sleep(random.uniform(2.5, 4.5))

                # Scroll to trigger lazy loading
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
                await asyncio.sleep(1)
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await asyncio.sleep(1)

                html = await page.content()
                if any(x in html.lower() for x in ("authwall", "sign in to linkedin", "join now")):
                    break

                page_contacts = _parse_profile_cards(html)
                for c in page_contacts:
                    if c.linkedin_url and c.linkedin_url not in seen_urls:
                        seen_urls.add(c.linkedin_url)
                        contacts.append(c)
                    elif not c.linkedin_url:
                        if c.full_name not in [x.full_name for x in contacts]:
                            contacts.append(c)

                if not page_contacts:
                    break
        finally:
            await browser.close()

    _cache.set("linkedin_search", cache_key, [c.to_dict() for c in contacts])
    return contacts


async def scrape_profile(
    linkedin_url: str,
    auth_state_path: str = "auth_state.json",
) -> dict:
    """
    Scrape a full LinkedIn profile page and return all visible data.
    Returns name, headline, location, about, experience, education, skills.
    """
    # Normalize URL
    m = re.search(r"linkedin\.com/in/([\w%-]+)", linkedin_url)
    if not m:
        return {"error": "Invalid LinkedIn URL"}
    slug = m.group(1).split("?")[0].rstrip("/")
    url = f"https://www.linkedin.com/in/{slug}/"

    cached = _cache.get("linkedin_profile", url)
    if cached is not None:
        return cached

    async with async_playwright() as pw:
        browser, ctx = await _make_browser_context(pw, auth_state_path)
        page = await ctx.new_page()
        try:
            await throttle("linkedin")
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(random.uniform(2, 3))

            # Scroll to load all sections
            for _ in range(4):
                await page.evaluate("window.scrollBy(0, window.innerHeight)")
                await asyncio.sleep(0.8)

            html = await page.content()
            if any(x in html.lower() for x in ("authwall", "sign in to linkedin")):
                return {"error": "Authentication required. Provide auth_state.json.", "url": url}

            profile = _parse_full_profile(html, url)
            _cache.set("linkedin_profile", url, profile)
            return profile
        finally:
            await browser.close()


async def scrape_profiles_bulk(
    linkedin_urls: list[str],
    auth_state_path: str = "auth_state.json",
    concurrency: int = 2,
) -> list[dict]:
    """Scrape multiple LinkedIn profiles with controlled concurrency."""
    sem = asyncio.Semaphore(concurrency)

    async def _scrape_one(url: str) -> dict:
        async with sem:
            return await scrape_profile(url, auth_state_path)

    return list(await asyncio.gather(*[_scrape_one(u) for u in linkedin_urls]))
