"""Unit tests for the validation/postprocessing module."""
import pytest
from pipeline.validation import (
    flag_low_confidence,
    fuzzy_correct,
    extract_entities,
    sort_by_reading_order,
    build_page_text,
    apply_fuzzy_correction,
)


def _region(text, conf, bbox=None):
    return {"text": text, "confidence": conf, "bbox": bbox or [[0, 0], [10, 0], [10, 10], [0, 10]]}


def test_flag_low_confidence_split():
    regions = [
        _region("good", 0.95),
        _region("bad", 0.60),
        _region("ok", 0.85),
        _region("poor", 0.40),
    ]
    ok, review = flag_low_confidence(regions, threshold=0.85)
    assert len(ok) == 2
    assert len(review) == 2
    assert all(r["confidence"] >= 0.85 for r in ok)
    assert all(r["confidence"] < 0.85 for r in review)


def test_fuzzy_correct_replaces_close_word():
    dictionary = ["invoice", "total", "amount"]
    result = fuzzy_correct("invoic totl", dictionary, threshold=70)
    assert "invoice" in result
    assert "total" in result


def test_fuzzy_correct_no_change_for_unknown():
    dictionary = ["invoice", "total"]
    result = fuzzy_correct("xyzqwerty", dictionary, threshold=80)
    assert "xyzqwerty" in result


def test_extract_entities_date():
    found = extract_entities("Due date: 01/15/2024 end")
    assert "date" in found
    assert any("01/15/2024" in d for d in found["date"])


def test_extract_entities_phone():
    found = extract_entities("Call us at 555-867-5309")
    assert "phone" in found


def test_extract_entities_currency():
    found = extract_entities("Total: $1,234.56")
    assert "currency" in found
    assert any("1,234.56" in c for c in found["currency"])


def test_extract_entities_email():
    found = extract_entities("Contact: user@example.com today")
    assert "email" in found


def test_sort_reading_order():
    regions = [
        {"text": "third", "confidence": 1.0, "bbox": [[0, 100], [50, 100], [50, 120], [0, 120]]},
        {"text": "first", "confidence": 1.0, "bbox": [[0, 0], [50, 0], [50, 20], [0, 20]]},
        {"text": "second", "confidence": 1.0, "bbox": [[0, 50], [50, 50], [50, 70], [0, 70]]},
    ]
    sorted_r = sort_by_reading_order(regions)
    assert [r["text"] for r in sorted_r] == ["first", "second", "third"]


def test_build_page_text():
    regions = [
        {"text": "Hello", "text_corrected": "Hello", "confidence": 1.0},
        {"text": "World", "text_corrected": "World", "confidence": 1.0},
    ]
    text = build_page_text(regions)
    assert "Hello" in text
    assert "World" in text


def test_apply_fuzzy_correction_adds_field():
    regions = [_region("invoic", 0.9)]
    result = apply_fuzzy_correction(regions, ["invoice", "total"], threshold=70)
    assert "text_corrected" in result[0]
