"""
SQLite storage layer for the Outlook Mail Intelligence Agent.
Each email is stored with structured fields and an optional embedding blob.
"""

import json
import logging
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional

logger = logging.getLogger(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS emails (
    message_id      TEXT PRIMARY KEY,
    thread_id       TEXT,
    folder          TEXT,
    sender_name     TEXT,
    sender_email    TEXT,
    recipients_to   TEXT,   -- JSON list of {name, email}
    recipients_cc   TEXT,   -- JSON list
    recipients_bcc  TEXT,   -- JSON list
    subject         TEXT,
    date_sent       TEXT,   -- ISO 8601
    date_received   TEXT,   -- ISO 8601
    body_text       TEXT,
    attachments     TEXT,   -- JSON list of {name, type, size}
    categories      TEXT,   -- JSON list of strings
    is_read         INTEGER,
    importance      TEXT,
    is_deleted      INTEGER DEFAULT 0,
    embedding       BLOB,   -- numpy float32 array as raw bytes
    synced_at       TEXT    -- ISO 8601, when we last fetched this record
);

CREATE INDEX IF NOT EXISTS idx_emails_sender  ON emails(sender_email);
CREATE INDEX IF NOT EXISTS idx_emails_date    ON emails(date_received);
CREATE INDEX IF NOT EXISTS idx_emails_folder  ON emails(folder);
CREATE INDEX IF NOT EXISTS idx_emails_thread  ON emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_deleted ON emails(is_deleted);

CREATE TABLE IF NOT EXISTS sync_state (
    key   TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    action      TEXT,       -- 'sync', 'query', 'auth'
    detail      TEXT,
    occurred_at TEXT        -- ISO 8601
);
"""


@contextmanager
def get_conn(db_path: str) -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(db_path: str) -> None:
    with get_conn(db_path) as conn:
        conn.executescript(SCHEMA)
    logger.info("Database initialised at %s", db_path)


def upsert_email(conn: sqlite3.Connection, record: Dict[str, Any]) -> None:
    """Insert or update an email record (keyed on message_id)."""
    conn.execute(
        """
        INSERT INTO emails (
            message_id, thread_id, folder,
            sender_name, sender_email,
            recipients_to, recipients_cc, recipients_bcc,
            subject, date_sent, date_received,
            body_text, attachments, categories,
            is_read, importance, is_deleted, embedding, synced_at
        ) VALUES (
            :message_id, :thread_id, :folder,
            :sender_name, :sender_email,
            :recipients_to, :recipients_cc, :recipients_bcc,
            :subject, :date_sent, :date_received,
            :body_text, :attachments, :categories,
            :is_read, :importance, :is_deleted, :embedding, :synced_at
        )
        ON CONFLICT(message_id) DO UPDATE SET
            thread_id      = excluded.thread_id,
            folder         = excluded.folder,
            sender_name    = excluded.sender_name,
            sender_email   = excluded.sender_email,
            recipients_to  = excluded.recipients_to,
            recipients_cc  = excluded.recipients_cc,
            recipients_bcc = excluded.recipients_bcc,
            subject        = excluded.subject,
            date_sent      = excluded.date_sent,
            date_received  = excluded.date_received,
            body_text      = excluded.body_text,
            attachments    = excluded.attachments,
            categories     = excluded.categories,
            is_read        = excluded.is_read,
            importance     = excluded.importance,
            is_deleted     = excluded.is_deleted,
            embedding      = COALESCE(excluded.embedding, emails.embedding),
            synced_at      = excluded.synced_at
        """,
        record,
    )


def mark_deleted(conn: sqlite3.Connection, message_id: str) -> None:
    conn.execute(
        "UPDATE emails SET is_deleted=1 WHERE message_id=?", (message_id,)
    )


def get_sync_state(conn: sqlite3.Connection, key: str) -> Optional[str]:
    row = conn.execute(
        "SELECT value FROM sync_state WHERE key=?", (key,)
    ).fetchone()
    return row["value"] if row else None


def set_sync_state(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        "INSERT INTO sync_state(key, value) VALUES(?,?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, value),
    )


def log_action(conn: sqlite3.Connection, action: str, detail: str) -> None:
    from datetime import datetime, timezone
    conn.execute(
        "INSERT INTO audit_log(action, detail, occurred_at) VALUES(?,?,?)",
        (action, detail, datetime.now(timezone.utc).isoformat()),
    )


def fetch_for_search(
    conn: sqlite3.Connection,
    *,
    sender_email: Optional[str] = None,
    sender_name: Optional[str] = None,
    folder: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    subject_keyword: Optional[str] = None,
    is_read: Optional[bool] = None,
    limit: int = 500,
) -> List[sqlite3.Row]:
    """Structured filter returning candidate rows for semantic re-ranking."""
    clauses = ["is_deleted=0"]
    params: List[Any] = []

    if sender_email:
        clauses.append("LOWER(sender_email) LIKE ?")
        params.append(f"%{sender_email.lower()}%")
    if sender_name:
        clauses.append("LOWER(sender_name) LIKE ?")
        params.append(f"%{sender_name.lower()}%")
    if folder:
        clauses.append("LOWER(folder) LIKE ?")
        params.append(f"%{folder.lower()}%")
    if date_from:
        clauses.append("date_received >= ?")
        params.append(date_from)
    if date_to:
        clauses.append("date_received <= ?")
        params.append(date_to)
    if subject_keyword:
        # Match any significant word in the keyword phrase (OR logic)
        words = [w for w in subject_keyword.lower().split() if len(w) > 2]
        if words:
            sub_clauses = ["LOWER(subject) LIKE ?" for _ in words]
            clauses.append("(" + " OR ".join(sub_clauses) + ")")
            params.extend(f"%{w}%" for w in words)
        else:
            clauses.append("LOWER(subject) LIKE ?")
            params.append(f"%{subject_keyword.lower()}%")
    if is_read is not None:
        clauses.append("is_read=?")
        params.append(1 if is_read else 0)

    where = " AND ".join(clauses)
    sql = f"SELECT * FROM emails WHERE {where} ORDER BY date_received DESC LIMIT ?"
    params.append(limit)
    return conn.execute(sql, params).fetchall()


def count_emails(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM emails WHERE is_deleted=0").fetchone()[0]
