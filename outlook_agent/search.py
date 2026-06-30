"""
Hybrid search: structured SQL filter + semantic re-ranking.
"""

import json
import logging
import sqlite3
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from db import fetch_for_search, get_conn, log_action
from embeddings import semantic_rank
from query_parser import ParsedQuery

logger = logging.getLogger(__name__)

SNIPPET_LEN = 300


@dataclass
class SearchResult:
    message_id: str
    thread_id: str
    folder: str
    sender_name: str
    sender_email: str
    subject: str
    date_received: str
    snippet: str
    is_read: bool
    importance: str
    recipients_to: List[Dict]
    recipients_cc: List[Dict]
    categories: List[str]
    attachments: List[Dict]
    body_text: str      # full body (for "full detail" requests)
    score: float = 0.0


def _make_snippet(body: str, query_words: List[str]) -> str:
    """Extract a short snippet centred around the first keyword match."""
    if not body:
        return ""
    body_lower = body.lower()
    best_pos = len(body)
    for w in query_words:
        pos = body_lower.find(w.lower())
        if 0 <= pos < best_pos:
            best_pos = pos
    if best_pos == len(body):
        return body[:SNIPPET_LEN].replace("\n", " ").strip()
    start = max(0, best_pos - 80)
    end = min(len(body), start + SNIPPET_LEN)
    snippet = body[start:end].replace("\n", " ").strip()
    if start > 0:
        snippet = "…" + snippet
    if end < len(body):
        snippet += "…"
    return snippet


def _row_to_result(row: sqlite3.Row, query_words: List[str]) -> SearchResult:
    recipients_to = json.loads(row["recipients_to"] or "[]")
    recipients_cc = json.loads(row["recipients_cc"] or "[]")
    attachments = json.loads(row["attachments"] or "[]")
    categories = json.loads(row["categories"] or "[]")
    body = row["body_text"] or ""
    return SearchResult(
        message_id=row["message_id"],
        thread_id=row["thread_id"] or "",
        folder=row["folder"] or "",
        sender_name=row["sender_name"] or "",
        sender_email=row["sender_email"] or "",
        subject=row["subject"] or "(no subject)",
        date_received=row["date_received"] or "",
        snippet=_make_snippet(body, query_words),
        is_read=bool(row["is_read"]),
        importance=row["importance"] or "normal",
        recipients_to=recipients_to,
        recipients_cc=recipients_cc,
        categories=categories,
        attachments=attachments,
        body_text=body,
    )


def search(
    db_path: str,
    pq: ParsedQuery,
    embedding_model: str = "all-MiniLM-L6-v2",
    top_k: int = 10,
) -> List[SearchResult]:
    """
    Run hybrid search:
    1. Structured SQL filter (fast)
    2. Semantic re-ranking on results (if embeddings available)
    Returns top_k results ordered by relevance.
    """
    with get_conn(db_path) as conn:
        rows = fetch_for_search(
            conn,
            sender_email=pq.sender_email,
            sender_name=pq.sender_name,
            folder=pq.folder,
            date_from=pq.date_from,
            date_to=pq.date_to,
            subject_keyword=pq.subject_keyword,
            is_read=pq.is_read,
            limit=500,
        )
        log_action(conn, "query", f"'{pq.raw}' → {len(rows)} candidates")

    if not rows:
        return []

    semantic_q = pq.semantic_query or pq.raw
    if embedding_model and embedding_model.lower() != "none":
        ranked_rows = semantic_rank(rows, semantic_q, embedding_model, top_k=top_k)
    else:
        ranked_rows = list(rows[:top_k])

    query_words = semantic_q.split()
    results = [_row_to_result(r, query_words) for r in ranked_rows]
    return results
