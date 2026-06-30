"""
Natural-language query parser.
Extracts structured filters (sender, date range, folder, subject keywords)
plus a semantic body-search term from a plain-English question.
No external API required — uses regex + heuristics.
"""

import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional


@dataclass
class ParsedQuery:
    sender_email: Optional[str] = None
    sender_name: Optional[str] = None
    folder: Optional[str] = None
    date_from: Optional[str] = None   # ISO 8601
    date_to: Optional[str] = None     # ISO 8601
    subject_keyword: Optional[str] = None
    semantic_query: str = ""
    is_read: Optional[bool] = None
    raw: str = ""


_FOLDER_ALIASES = {
    "inbox": "inbox",
    "sent": "sentitems",
    "sent items": "sentitems",
    "drafts": "drafts",
    "deleted": "deleteditems",
    "trash": "deleteditems",
    "archive": "archive",
    "junk": "junkemail",
    "spam": "junkemail",
}

_RELATIVE_DATE_PATTERNS = [
    (r"\btoday\b", 0, 0),
    (r"\byesterday\b", -1, -1),
    (r"\blast\s+(\d+)\s+days?\b", None, None),    # special
    (r"\bthis\s+week\b", None, None),             # special
    (r"\blast\s+week\b", None, None),             # special
    (r"\bthis\s+month\b", None, None),            # special
    (r"\blast\s+month\b", None, None),            # special
]

_MONTH_NAMES = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    "january": 1, "february": 2, "march": 3, "april": 4, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}

_WEEKDAY_NAMES = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}


def _iso(dt: datetime) -> str:
    return dt.replace(hour=0, minute=0, second=0, microsecond=0).isoformat() + "Z"


def _iso_end(dt: datetime) -> str:
    return dt.replace(hour=23, minute=59, second=59, microsecond=0).isoformat() + "Z"


def _parse_relative_dates(text: str) -> tuple[Optional[str], Optional[str], str]:
    now = datetime.now(timezone.utc)
    date_from = date_to = None
    consumed = text

    # "last N days"
    m = re.search(r"\blast\s+(\d+)\s+days?\b", text, re.I)
    if m:
        n = int(m.group(1))
        date_from = _iso(now - timedelta(days=n))
        date_to = _iso_end(now)
        consumed = consumed[:m.start()] + consumed[m.end():]
        return date_from, date_to, consumed

    # "last week"
    if re.search(r"\blast\s+week\b", text, re.I):
        start = now - timedelta(days=now.weekday() + 7)
        end = start + timedelta(days=6)
        date_from, date_to = _iso(start), _iso_end(end)
        consumed = re.sub(r"\blast\s+week\b", "", consumed, flags=re.I)
        return date_from, date_to, consumed

    # "this week"
    if re.search(r"\bthis\s+week\b", text, re.I):
        start = now - timedelta(days=now.weekday())
        date_from, date_to = _iso(start), _iso_end(now)
        consumed = re.sub(r"\bthis\s+week\b", "", consumed, flags=re.I)
        return date_from, date_to, consumed

    # "last month"
    if re.search(r"\blast\s+month\b", text, re.I):
        first_this = now.replace(day=1)
        last_m_end = first_this - timedelta(days=1)
        last_m_start = last_m_end.replace(day=1)
        date_from, date_to = _iso(last_m_start), _iso_end(last_m_end)
        consumed = re.sub(r"\blast\s+month\b", "", consumed, flags=re.I)
        return date_from, date_to, consumed

    # "this month"
    if re.search(r"\bthis\s+month\b", text, re.I):
        date_from = _iso(now.replace(day=1))
        date_to = _iso_end(now)
        consumed = re.sub(r"\bthis\s+month\b", "", consumed, flags=re.I)
        return date_from, date_to, consumed

    # "today"
    if re.search(r"\btoday\b", text, re.I):
        date_from = _iso(now)
        date_to = _iso_end(now)
        consumed = re.sub(r"\btoday\b", "", consumed, flags=re.I)
        return date_from, date_to, consumed

    # "yesterday"
    if re.search(r"\byesterday\b", text, re.I):
        yest = now - timedelta(days=1)
        date_from = _iso(yest)
        date_to = _iso_end(yest)
        consumed = re.sub(r"\byesterday\b", "", consumed, flags=re.I)
        return date_from, date_to, consumed

    # "last Tuesday"
    m = re.search(r"\blast\s+(" + "|".join(_WEEKDAY_NAMES) + r")\b", text, re.I)
    if m:
        target_wd = _WEEKDAY_NAMES[m.group(1).lower()]
        days_ago = (now.weekday() - target_wd) % 7 or 7
        day = now - timedelta(days=days_ago)
        date_from, date_to = _iso(day), _iso_end(day)
        consumed = consumed[:m.start()] + consumed[m.end():]
        return date_from, date_to, consumed

    # "on Monday" / "on March 5" / "in January"
    m = re.search(r"\b(?:on|in)\s+(" + "|".join(_MONTH_NAMES) + r")\s*(\d{1,2})?\b", text, re.I)
    if m:
        month_n = _MONTH_NAMES[m.group(1).lower()]
        year = now.year if month_n <= now.month else now.year - 1
        day_n = int(m.group(2)) if m.group(2) else 1
        try:
            start = datetime(year, month_n, day_n, tzinfo=timezone.utc)
            if m.group(2):
                date_from, date_to = _iso(start), _iso_end(start)
            else:
                import calendar
                last_day = calendar.monthrange(year, month_n)[1]
                date_from = _iso(start)
                date_to = _iso_end(start.replace(day=last_day))
        except ValueError:
            pass
        consumed = consumed[:m.start()] + consumed[m.end():]
        return date_from, date_to, consumed

    return None, None, consumed


def parse(question: str) -> ParsedQuery:
    pq = ParsedQuery(raw=question)
    text = question

    # Folder: "in inbox", "in my drafts" (run before sender to avoid false matches)
    for alias, folder_id in _FOLDER_ALIASES.items():
        if re.search(r"\bin\s+(?:my\s+)?" + re.escape(alias) + r"\b", text, re.I):
            pq.folder = folder_id
            text = re.sub(r"\bin\s+(?:my\s+)?" + re.escape(alias) + r"\b", "", text, flags=re.I)
            break

    # Date range BEFORE sender — so "from today/last week/last Tuesday" don't parse as sender
    date_from, date_to, text = _parse_relative_dates(text)
    pq.date_from = date_from
    pq.date_to = date_to

    # Sender: "from John", "from john@example.com", "sent by …"
    # Each captured word uses a negative lookahead to avoid consuming stop words.
    _SW = r"about|in|on|sent|with|last|this|today|yesterday|from|re|regarding|the|a|an|all|any"
    _WORD = r"(?!(?:" + _SW + r")\b)[A-Za-z0-9._%+\-@]+"
    m = re.search(
        r"\b(?:from|sent\s+by|by)\s+(" + _WORD + r")(?:\s+(" + _WORD + r"))?",
        text, re.I,
    )
    if m:
        val = " ".join(filter(None, [m.group(1), m.group(2)])).strip()
        if "@" in val:
            pq.sender_email = val.split()[0]   # email is always one token
        else:
            pq.sender_name = val
        text = text[:m.start()] + text[m.end():]

    # Subject: "about X", "subject X", "with subject X", "re: X"
    m = re.search(r"\b(?:about|subject(?:ed)?|re:|regarding)\s+['\"]?([^'\"]+?)['\"]?(?:\s+(?:from|in|on|sent)|$)", text, re.I)
    if m:
        kw = m.group(1).strip()
        # strip leading articles so "the Q3 budget" → "Q3 budget"
        kw = re.sub(r"^(?:the|a|an)\s+", "", kw, flags=re.I)
        pq.subject_keyword = kw
        text = text[:m.start()] + text[m.end():]

    # Read/unread
    if re.search(r"\bunread\b", text, re.I):
        pq.is_read = False
        text = re.sub(r"\bunread\b", "", text, flags=re.I)
    elif re.search(r"\bread\b", text, re.I):
        pq.is_read = True
        text = re.sub(r"\bread\b", "", text, flags=re.I)

    # Whatever remains is the semantic query
    filler = re.compile(
        r"\b(find|search|show|get|list|what|emails?|messages?|mail|me|all|any|"
        r"did|does|do|is|are|was|were|have|has|had|can|could|would|should|please|"
        r"tell|give|look|for|with|that|which|where|when|who|how|the|a|an)\b",
        re.I,
    )
    semantic = filler.sub(" ", text).strip()
    semantic = re.sub(r"\s+", " ", semantic).strip(" ,.")
    pq.semantic_query = semantic or question

    return pq
