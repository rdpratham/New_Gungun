"""File validation, PDF text-layer detection, and page rendering."""
import io
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
from pypdf import PdfReader
from PIL import Image


# Magic bytes for supported types
_MAGIC = {
    b"\xff\xd8\xff": "jpeg",
    b"\x89PNG": "png",
    b"%PDF": "pdf",
}

SUPPORTED_TYPES = {"jpeg", "pdf"}


def detect_file_type(data: bytes) -> Optional[str]:
    """Detect file type from magic bytes (first 8 bytes)."""
    header = data[:8]
    for magic, ftype in _MAGIC.items():
        if header[: len(magic)] == magic:
            return ftype
    return None


def validate_upload(data: bytes, filename: str, max_mb: int = 100) -> str:
    """Validate uploaded file. Returns detected type or raises ValueError."""
    if len(data) > max_mb * 1024 * 1024:
        raise ValueError(f"File exceeds maximum size of {max_mb} MB")

    ftype = detect_file_type(data)
    if ftype is None or ftype not in SUPPORTED_TYPES:
        raise ValueError(
            f"Unsupported file type. Detected: {ftype}. Supported: {', '.join(SUPPORTED_TYPES)}"
        )
    return ftype


def has_text_layer(pdf_data: bytes, min_chars: int = 10) -> bool:
    """Return True if PDF has a meaningful embedded text layer."""
    try:
        reader = PdfReader(io.BytesIO(pdf_data))
        for page in reader.pages:
            text = page.extract_text() or ""
            if len(text.strip()) >= min_chars:
                return True
    except Exception:
        pass
    return False


def extract_pdf_text_layer(pdf_data: bytes) -> list[dict]:
    """Fast path: extract text directly from PDF text layer, per page."""
    reader = PdfReader(io.BytesIO(pdf_data))
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        pages.append({
            "page_number": i + 1,
            "text": text,
            "source": "text_layer",
            "lines": [{"text": line, "confidence": 1.0, "bbox": None}
                      for line in text.splitlines() if line.strip()],
        })
    return pages


def render_pdf_pages(pdf_data: bytes, dpi: int = 300) -> list[dict]:
    """Render each PDF page to a PIL Image at the given DPI."""
    doc = fitz.open(stream=pdf_data, filetype="pdf")
    pages = []
    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    for i, page in enumerate(doc):
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        pages.append({"page_number": i + 1, "image": img, "dpi": dpi})
    doc.close()
    return pages


def load_image(data: bytes) -> Image.Image:
    """Load a JPG/PNG byte stream into a PIL Image."""
    return Image.open(io.BytesIO(data)).convert("RGB")


def get_pdf_page_count(pdf_data: bytes) -> int:
    doc = fitz.open(stream=pdf_data, filetype="pdf")
    count = doc.page_count
    doc.close()
    return count
