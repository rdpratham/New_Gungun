"""
Embedding generation and cosine similarity helpers.
Uses sentence-transformers locally (no API key required).
Falls back gracefully if the library is unavailable.
"""

import logging
import sqlite3
import struct
from typing import List, Optional

import numpy as np

logger = logging.getLogger(__name__)

_model = None
_model_name: Optional[str] = None


def _get_model(model_name: str):
    global _model, _model_name
    if _model is not None and _model_name == model_name:
        return _model
    try:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading embedding model: %s", model_name)
        _model = SentenceTransformer(model_name)
        _model_name = model_name
        return _model
    except Exception as e:
        logger.warning("Could not load sentence-transformers: %s — semantic search disabled", e)
        return None


def encode(text: str, model_name: str) -> Optional[bytes]:
    """Return float32 embedding as raw bytes, or None if model unavailable."""
    model = _get_model(model_name)
    if model is None:
        return None
    vec = model.encode(text, normalize_embeddings=True)
    return vec.astype(np.float32).tobytes()


def cosine_similarity(blob: bytes, query_vec: np.ndarray) -> float:
    """Decode a stored blob and compute cosine similarity with query_vec."""
    arr = np.frombuffer(blob, dtype=np.float32)
    # Both are L2-normalised so dot product == cosine similarity
    return float(np.dot(arr, query_vec))


def embed_all_pending(
    db_path: str,
    model_name: str,
    batch_size: int = 64,
) -> int:
    """Embed any emails whose embedding column is NULL. Returns count embedded."""
    model = _get_model(model_name)
    if model is None:
        return 0

    import sqlite3 as _sqlite3
    conn = _sqlite3.connect(db_path)
    conn.row_factory = _sqlite3.Row
    try:
        rows = conn.execute(
            "SELECT message_id, subject, body_text FROM emails "
            "WHERE embedding IS NULL AND is_deleted=0 LIMIT 10000"
        ).fetchall()

        if not rows:
            return 0

        texts = [f"{r['subject']}\n\n{r['body_text'] or ''}"[:2048] for r in rows]
        ids = [r["message_id"] for r in rows]

        logger.info("Embedding %d emails...", len(texts))
        vecs = model.encode(texts, normalize_embeddings=True, batch_size=batch_size, show_progress_bar=True)

        with conn:
            for mid, vec in zip(ids, vecs):
                blob = vec.astype(np.float32).tobytes()
                conn.execute(
                    "UPDATE emails SET embedding=? WHERE message_id=?",
                    (blob, mid),
                )
        logger.info("Embedded %d emails", len(ids))
        return len(ids)
    finally:
        conn.close()


def semantic_rank(
    rows: List[sqlite3.Row],
    query: str,
    model_name: str,
    top_k: int = 20,
) -> List[sqlite3.Row]:
    """Re-rank rows by cosine similarity to the query. Falls back to original order."""
    model = _get_model(model_name)
    if model is None:
        return rows[:top_k]

    query_vec = model.encode(query, normalize_embeddings=True).astype(np.float32)

    scored = []
    for row in rows:
        blob = row["embedding"]
        if blob:
            score = cosine_similarity(blob, query_vec)
        else:
            # No embedding yet: give mild score based on keyword overlap
            text = f"{row['subject']} {row['body_text'] or ''}".lower()
            q_words = query.lower().split()
            score = sum(w in text for w in q_words) / max(len(q_words), 1) * 0.5
        scored.append((score, row))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in scored[:top_k]]
