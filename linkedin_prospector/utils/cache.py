"""
Persistent SQLite cache for scraped data.
Prevents re-querying the same sources and saves API credits.
"""

import hashlib
import json
import sqlite3
import time
from pathlib import Path
from typing import Any, Optional


class Cache:
    def __init__(self, db_path: str = "prospector_cache.db", ttl_hours: int = 72):
        self.db_path = db_path
        self.ttl_seconds = ttl_hours * 3600
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS cache (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    source TEXT,
                    created_at REAL NOT NULL
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_source ON cache(source)")
            conn.commit()

    def _make_key(self, source: str, query: str) -> str:
        raw = f"{source}:{query.lower().strip()}"
        return hashlib.sha256(raw.encode()).hexdigest()

    def get(self, source: str, query: str) -> Optional[Any]:
        key = self._make_key(source, query)
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT value, created_at FROM cache WHERE key = ?", (key,)
            ).fetchone()
        if row is None:
            return None
        value, created_at = row
        if time.time() - created_at > self.ttl_seconds:
            self.delete(source, query)
            return None
        return json.loads(value)

    def set(self, source: str, query: str, value: Any):
        key = self._make_key(source, query)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO cache (key, value, source, created_at) VALUES (?, ?, ?, ?)",
                (key, json.dumps(value, ensure_ascii=False), source, time.time()),
            )
            conn.commit()

    def delete(self, source: str, query: str):
        key = self._make_key(source, query)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("DELETE FROM cache WHERE key = ?", (key,))
            conn.commit()

    def clear_source(self, source: str):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("DELETE FROM cache WHERE source = ?", (source,))
            conn.commit()

    def stats(self) -> dict:
        with sqlite3.connect(self.db_path) as conn:
            total = conn.execute("SELECT COUNT(*) FROM cache").fetchone()[0]
            by_source = conn.execute(
                "SELECT source, COUNT(*) FROM cache GROUP BY source"
            ).fetchall()
        return {"total": total, "by_source": dict(by_source)}
