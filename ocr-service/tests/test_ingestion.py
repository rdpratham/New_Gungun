"""Unit tests for the ingestion layer."""
import io
import pytest
from PIL import Image

from pipeline.ingestion import detect_file_type, validate_upload, has_text_layer, load_image


def _make_jpg_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (100, 50), color="white").save(buf, format="JPEG")
    return buf.getvalue()


def _make_png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (100, 50), color="white").save(buf, format="PNG")
    return buf.getvalue()


def test_detect_jpeg():
    assert detect_file_type(_make_jpg_bytes()) == "jpeg"


def test_detect_pdf_magic():
    fake_pdf = b"%PDF-1.4 fake content"
    assert detect_file_type(fake_pdf) == "pdf"


def test_detect_unknown():
    assert detect_file_type(b"\x00\x01\x02\x03") is None


def test_validate_upload_jpeg_ok():
    data = _make_jpg_bytes()
    ftype = validate_upload(data, "test.jpg")
    assert ftype == "jpeg"


def test_validate_upload_size_exceeded():
    # 200 bytes passed as max 0 MB (effectively 0) — but let's use a real check
    data = _make_jpg_bytes()
    with pytest.raises(ValueError, match="maximum size"):
        validate_upload(data, "test.jpg", max_mb=0)


def test_validate_upload_unsupported_type():
    with pytest.raises(ValueError, match="Unsupported"):
        validate_upload(b"\x00\x01\x02\x03", "file.bin")


def test_load_image():
    data = _make_jpg_bytes()
    img = load_image(data)
    assert img.mode == "RGB"
    assert img.size == (100, 50)


def test_has_text_layer_false_on_fake_pdf():
    assert has_text_layer(b"%PDF-1.4 no real content here") is False
