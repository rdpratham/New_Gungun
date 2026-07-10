"""Postprocessing: confidence flagging, fuzzy correction, regex extraction, reading order."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

from rapidfuzz import process, fuzz


def flag_low_confidence(
    regions: list[dict], threshold: float = 0.85
) -> tuple[list[dict], list[dict]]:
    """Split regions into (ok, needs_review) based on confidence threshold."""
    ok, review = [], []
    for r in regions:
        if r.get("confidence", 0) >= threshold:
            ok.append(r)
        else:
            review.append(r)
    return ok, review


def load_dictionary(path: str | Path) -> list[str]:
    path = Path(path)
    if not path.exists():
        return []
    return [w.strip() for w in path.read_text().splitlines() if w.strip()]


def fuzzy_correct(text: str, dictionary: list[str], threshold: int = 80) -> str:
    """Replace each word with the closest dictionary match if score >= threshold."""
    if not dictionary:
        return text
    words = text.split()
    corrected = []
    for word in words:
        clean = re.sub(r"[^\w]", "", word)
        if not clean:
            corrected.append(word)
            continue
        match = process.extractOne(clean, dictionary, scorer=fuzz.ratio)
        if match and match[1] >= threshold:
            corrected.append(word.replace(clean, match[0]))
        else:
            corrected.append(word)
    return " ".join(corrected)


def apply_fuzzy_correction(
    regions: list[dict], dictionary: list[str], threshold: int = 80
) -> list[dict]:
    """Apply fuzzy correction to all region texts."""
    for r in regions:
        r["text_corrected"] = fuzzy_correct(r.get("text", ""), dictionary, threshold)
    return regions


# Regex rules as compiled patterns
_DEFAULT_RULES: dict[str, re.Pattern] = {
    "date": re.compile(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b"),
    "phone": re.compile(r"\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"),
    "currency": re.compile(r"\$\s?\d{1,3}(,\d{3})*(\.\d{2})?"),
    "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
}


def extract_entities(text: str, rules: Optional[dict] = None) -> dict[str, list[str]]:
    """Find all regex matches per rule in text."""
    active = rules or _DEFAULT_RULES
    found: dict[str, list[str]] = {}
    for name, pattern in active.items():
        matches = [m.group(0) for m in pattern.finditer(text)]
        if matches:
            found[name] = matches
    return found


def sort_by_reading_order(regions: list[dict]) -> list[dict]:
    """Sort regions top-to-bottom, left-to-right using bounding box top-left corner."""
    def key(r: dict):
        bbox = r.get("bbox")
        if not bbox or len(bbox) < 1:
            return (0, 0)
        top_left = bbox[0]
        return (top_left[1], top_left[0])  # y, x

    return sorted(regions, key=key)


def build_page_text(regions: list[dict]) -> str:
    """Reconstruct page text from sorted regions."""
    return "\n".join(
        r.get("text_corrected", r.get("text", "")) for r in regions
    )
