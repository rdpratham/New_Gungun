"""Unit tests for the search module (no embeddings)."""

import json
import os
import sys
import tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from db import get_conn, init_db, upsert_email
from query_parser import ParsedQuery
from search import search


def _rec(mid, sender_name, sender_email, subject, body, date="2024-09-01T09:00:00Z", folder="inbox"):
    return {
        "message_id": mid,
        "thread_id": "t",
        "folder": folder,
        "sender_name": sender_name,
        "sender_email": sender_email,
        "recipients_to": "[]",
        "recipients_cc": "[]",
        "recipients_bcc": "[]",
        "subject": subject,
        "date_sent": date,
        "date_received": date,
        "body_text": body,
        "attachments": "[]",
        "categories": "[]",
        "is_read": 0,
        "importance": "normal",
        "is_deleted": 0,
        "embedding": None,
        "synced_at": "2024-09-01T10:00:00Z",
    }


@pytest.fixture
def db_with_data(tmp_path):
    db = str(tmp_path / "test.db")
    init_db(db)
    records = [
        _rec("1", "Alice Smith", "alice@example.com", "Q3 Budget Review", "The Q3 budget is attached."),
        _rec("2", "Bob Jones", "bob@example.com", "Team lunch Friday", "We are meeting at noon."),
        _rec("3", "Alice Smith", "alice@example.com", "Contract renewal", "Please sign the contract by EOD."),
        _rec("4", "Carol White", "carol@example.com", "Q3 Budget concerns", "I have concerns about the Q3 numbers."),
    ]
    with get_conn(db) as conn:
        for r in records:
            upsert_email(conn, r)
    return db


def test_search_by_sender(db_with_data):
    pq = ParsedQuery(sender_name="Alice", semantic_query="email", raw="emails from Alice")
    results = search(db_with_data, pq, embedding_model="none", top_k=10)
    assert len(results) == 2
    assert all(r.sender_name == "Alice Smith" for r in results)


def test_search_by_subject_keyword(db_with_data):
    pq = ParsedQuery(subject_keyword="Q3", semantic_query="budget", raw="Q3 budget")
    results = search(db_with_data, pq, embedding_model="none", top_k=10)
    assert len(results) == 2


def test_search_no_results(db_with_data):
    pq = ParsedQuery(sender_email="nobody@example.com", semantic_query="xyz", raw="xyz")
    results = search(db_with_data, pq, embedding_model="none", top_k=10)
    assert results == []


def test_search_top_k(db_with_data):
    pq = ParsedQuery(semantic_query="email", raw="all emails")
    results = search(db_with_data, pq, embedding_model="none", top_k=2)
    assert len(results) <= 2


def test_result_has_snippet(db_with_data):
    pq = ParsedQuery(semantic_query="budget", raw="budget")
    results = search(db_with_data, pq, embedding_model="none", top_k=5)
    assert any(r.snippet for r in results)


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
