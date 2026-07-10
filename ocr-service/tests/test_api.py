"""Integration tests for the FastAPI endpoints."""
import io
import time
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from api.main import app
from api.database import init_db
from api.settings import settings


# Force inline worker mode for tests
settings.worker_mode = "inline"
init_db()

client = TestClient(app)


def _make_jpg_bytes(text: str = "Hello World") -> bytes:
    img = Image.new("RGB", (400, 80), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((10, 20), text, fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    return buf.getvalue()


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_submit_job_returns_job_id():
    data = _make_jpg_bytes()
    resp = client.post(
        "/api/v1/jobs",
        files={"file": ("test.jpg", data, "image/jpeg")},
    )
    assert resp.status_code == 202
    body = resp.json()
    assert "job_id" in body
    assert body["status"] == "pending"


def test_submit_invalid_file():
    resp = client.post(
        "/api/v1/jobs",
        files={"file": ("bad.exe", b"\x00\x01\x02\x03", "application/octet-stream")},
    )
    assert resp.status_code == 400


def test_get_job_not_found():
    resp = client.get("/api/v1/jobs/nonexistent-id")
    assert resp.status_code == 404


@pytest.mark.skipif(
    not __import__("pathlib").Path.home().joinpath(".EasyOCR/model").exists()
    and not list(__import__("pathlib").Path(__file__).parent.parent.joinpath("models").glob("*.pth")),
    reason="EasyOCR model weights not downloaded. Run: python scripts/download_models.py",
)
def test_submit_and_poll_jpg():
    """Submit a JPG and wait for completion (inline worker, no Redis needed)."""
    data = _make_jpg_bytes("Invoice 100")
    resp = client.post(
        "/api/v1/jobs",
        files={"file": ("invoice.jpg", data, "image/jpeg")},
    )
    assert resp.status_code == 202
    job_id = resp.json()["job_id"]

    # Poll until done (inline worker is async thread — give it up to 60s)
    for _ in range(60):
        status_resp = client.get(f"/api/v1/jobs/{job_id}")
        assert status_resp.status_code == 200
        body = status_resp.json()
        if body["status"] in ("completed", "failed"):
            break
        time.sleep(1)

    assert body["status"] == "completed", f"Job failed: {body.get('error_message')}"
    assert body["result"] is not None
    pages = body["result"]["pages"]
    assert len(pages) == 1
    page = pages[0]
    assert "regions" in page
    assert "full_text" in page
    # Each region must have confidence
    for region in page["regions"]:
        assert "confidence" in region
        assert 0.0 <= region["confidence"] <= 1.0
