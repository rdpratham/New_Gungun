"""Unit tests for the natural-language query parser."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from query_parser import parse


def test_parse_sender_email():
    pq = parse("find emails from alice@example.com about the budget")
    assert pq.sender_email == "alice@example.com"


def test_parse_sender_name():
    pq = parse("show messages from John about Q3")
    assert pq.sender_name == "John"


def test_parse_folder_inbox():
    pq = parse("list unread emails in inbox")
    assert pq.folder == "inbox"
    assert pq.is_read is False


def test_parse_folder_sent():
    pq = parse("emails in sent items last week")
    assert pq.folder == "sentitems"


def test_parse_subject_keyword():
    pq = parse("emails about the Q3 budget from Sarah")
    assert pq.subject_keyword is not None
    assert "Q3" in pq.subject_keyword or "budget" in pq.subject_keyword


def test_parse_today():
    pq = parse("emails from today")
    assert pq.date_from is not None
    assert pq.date_to is not None


def test_parse_yesterday():
    pq = parse("what did Sarah send yesterday")
    assert pq.date_from is not None
    # date_from and date_to should be the same calendar day
    assert pq.date_from[:10] == pq.date_to[:10]


def test_parse_last_n_days():
    pq = parse("emails from the last 7 days")
    assert pq.date_from is not None


def test_parse_this_week():
    pq = parse("unread emails this week")
    assert pq.date_from is not None
    assert pq.is_read is False


def test_semantic_query_fallback():
    pq = parse("contract renewal discussion")
    assert "contract" in pq.semantic_query or "renewal" in pq.semantic_query


def test_empty_query():
    pq = parse("   ")
    assert pq.raw == "   "


def test_parse_last_tuesday():
    pq = parse("find emails from last Tuesday")
    assert pq.date_from is not None
    assert pq.date_from[:10] == pq.date_to[:10]


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
