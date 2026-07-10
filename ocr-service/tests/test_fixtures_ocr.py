"""Integration tests using synthetic fixtures with known ground truth.

These tests require EasyOCR model weights. Skip them with:
    pytest -k "not fixture"
or download weights first:
    python scripts/download_models.py
"""
import time
import pytest
from fastapi.testclient import TestClient
from rapidfuzz.distance import Levenshtein

from api.main import app
from api.database import init_db
from api.settings import settings
from tests.conftest import requires_easyocr

init_db()

pytestmark = requires_easyocr
from tests.generate_fixtures import generate_all, FIXTURES_DIR, SIMPLE_TEXT


settings.worker_mode = "inline"
client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def fixtures():
    generate_all()


def _submit_and_wait(file_path, content_type="image/jpeg", timeout=120):
    with open(file_path, "rb") as f:
        data = f.read()
    resp = client.post(
        "/api/v1/jobs",
        files={"file": (file_path.name, data, content_type)},
    )
    assert resp.status_code == 202
    job_id = resp.json()["job_id"]

    for _ in range(timeout):
        r = client.get(f"/api/v1/jobs/{job_id}")
        body = r.json()
        if body["status"] in ("completed", "failed"):
            return body
        time.sleep(1)
    return body


def test_simple_jpg_ground_truth():
    result = _submit_and_wait(FIXTURES_DIR / "simple.jpg")
    assert result["status"] == "completed", result.get("error_message")
    full_text = result["result"]["pages"][0]["full_text"]
    # Allow up to 30% edit distance relative to ground truth length
    dist = Levenshtein.distance(full_text.lower(), SIMPLE_TEXT.lower())
    tolerance = max(5, int(len(SIMPLE_TEXT) * 0.30))
    assert dist <= tolerance, f"OCR text too far from ground truth. Got: '{full_text}', Expected: '{SIMPLE_TEXT}', distance={dist}"


def test_multiline_jpg_has_structure():
    result = _submit_and_wait(FIXTURES_DIR / "multiline.jpg")
    assert result["status"] == "completed"
    page = result["result"]["pages"][0]
    assert len(page["regions"]) > 0
    assert all("confidence" in r for r in page["regions"])


def test_multipage_pdf_page_count():
    result = _submit_and_wait(FIXTURES_DIR / "multipage.pdf", content_type="application/pdf")
    assert result["status"] == "completed"
    assert result["result"]["page_count"] == 2
    assert len(result["result"]["pages"]) == 2


def test_textlayer_pdf_fast_path():
    result = _submit_and_wait(FIXTURES_DIR / "textlayer.pdf", content_type="application/pdf")
    assert result["status"] == "completed"
    page = result["result"]["pages"][0]
    assert page.get("source") == "text_layer"
    assert "Text Layer PDF Content" in page["full_text"]
