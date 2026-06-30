"""Unit tests for the SQLite storage layer."""

import json
import sys
import tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from db import get_conn, init_db, upsert_email, mark_deleted, fetch_for_search, count_emails, set_sync_state, get_sync_state


@pytest.fixture
def tmp_db(tmp_path):
    db = str(tmp_path / "test.db")
    init_db(db)
    return db


def _sample_record(message_id="msg-001", folder="inbox"):
    return {
        "message_id": message_id,
        "thread_id": "thread-001",
        "folder": folder,
        "sender_name": "Alice Smith",
        "sender_email": "alice@example.com",
        "recipients_to": json.dumps([{"name": "Bob", "email": "bob@example.com"}]),
        "recipients_cc": "[]",
        "recipients_bcc": "[]",
        "subject": "Q3 Budget Review",
        "date_sent": "2024-09-01T09:00:00Z",
        "date_received": "2024-09-01T09:01:00Z",
        "body_text": "Please review the attached Q3 budget document.",
        "attachments": "[]",
        "categories": "[]",
        "is_read": 0,
        "importance": "normal",
        "is_deleted": 0,
        "embedding": None,
        "synced_at": "2024-09-01T10:00:00Z",
    }


def test_init_db(tmp_db):
    with get_conn(tmp_db) as conn:
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    assert "emails" in tables
    assert "sync_state" in tables
    assert "audit_log" in tables


def test_upsert_and_count(tmp_db):
    with get_conn(tmp_db) as conn:
        upsert_email(conn, _sample_record())
    with get_conn(tmp_db) as conn:
        assert count_emails(conn) == 1


def test_upsert_idempotent(tmp_db):
    rec = _sample_record()
    with get_conn(tmp_db) as conn:
        upsert_email(conn, rec)
    rec["subject"] = "Updated Subject"
    with get_conn(tmp_db) as conn:
        upsert_email(conn, rec)
    with get_conn(tmp_db) as conn:
        assert count_emails(conn) == 1
        row = conn.execute("SELECT subject FROM emails WHERE message_id='msg-001'").fetchone()
        assert row["subject"] == "Updated Subject"


def test_mark_deleted(tmp_db):
    with get_conn(tmp_db) as conn:
        upsert_email(conn, _sample_record())
    with get_conn(tmp_db) as conn:
        mark_deleted(conn, "msg-001")
    with get_conn(tmp_db) as conn:
        assert count_emails(conn) == 0  # is_deleted=0 filter


def test_fetch_for_search_by_sender(tmp_db):
    with get_conn(tmp_db) as conn:
        upsert_email(conn, _sample_record("a"))
        upsert_email(conn, _sample_record("b"))
        upsert_email(conn, {**_sample_record("c"), "sender_email": "bob@example.com"})

    with get_conn(tmp_db) as conn:
        rows = fetch_for_search(conn, sender_email="alice@example.com")
    assert len(rows) == 2


def test_fetch_for_search_by_folder(tmp_db):
    with get_conn(tmp_db) as conn:
        upsert_email(conn, _sample_record("a", folder="inbox"))
        upsert_email(conn, _sample_record("b", folder="sentitems"))

    with get_conn(tmp_db) as conn:
        rows = fetch_for_search(conn, folder="inbox")
    assert len(rows) == 1


def test_sync_state(tmp_db):
    with get_conn(tmp_db) as conn:
        assert get_sync_state(conn, "delta:inbox") is None
        set_sync_state(conn, "delta:inbox", "https://example.com/delta?token=abc")
    with get_conn(tmp_db) as conn:
        val = get_sync_state(conn, "delta:inbox")
    assert val == "https://example.com/delta?token=abc"


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
