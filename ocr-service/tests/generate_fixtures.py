"""Generate synthetic test fixtures (called at test-collection time)."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
import io


FIXTURES_DIR = Path(__file__).parent / "fixtures"

SIMPLE_TEXT = "Hello World 2024"
MULTILINE_TEXT = "Invoice #1234\nDate: 01/15/2024\nTotal: $99.99\nPhone: 555-867-5309"
NOISY_TEXT = "Test Document"


def _make_text_image(text: str, width: int = 400, height: int = 100, font_size: int = 24) -> Image.Image:
    img = Image.new("RGB", (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", font_size)
    except Exception:
        font = ImageFont.load_default()
    draw.text((10, 10), text, fill=(0, 0, 0), font=font)
    return img


def generate_all() -> None:
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

    # Simple single-line JPG
    img = _make_text_image(SIMPLE_TEXT, width=400, height=60)
    img.save(FIXTURES_DIR / "simple.jpg", "JPEG", quality=95)

    # Multi-line JPG with entities
    img2 = _make_text_image(MULTILINE_TEXT, width=500, height=120, font_size=18)
    img2.save(FIXTURES_DIR / "multiline.jpg", "JPEG", quality=95)

    # Noisy image (add gaussian noise)
    import numpy as np
    img3 = _make_text_image(NOISY_TEXT, width=400, height=80)
    arr = np.array(img3).astype(np.int32)
    noise = np.random.normal(0, 15, arr.shape).astype(np.int32)
    noisy = np.clip(arr + noise, 0, 255).astype(np.uint8)
    Image.fromarray(noisy).save(FIXTURES_DIR / "noisy.jpg", "JPEG", quality=85)

    # Multi-page PDF (2 pages) — image-only (no text layer)
    import fitz
    doc = fitz.open()
    for i, text in enumerate(["Page One Text", "Page Two Text"], 1):
        img_page = _make_text_image(text, width=400, height=80)
        buf = io.BytesIO()
        img_page.save(buf, format="PNG")
        buf.seek(0)
        page = doc.new_page(width=400, height=80)
        page.insert_image(fitz.Rect(0, 0, 400, 80), stream=buf.read())
    doc.save(str(FIXTURES_DIR / "multipage.pdf"))
    doc.close()

    # Single-page text-layer PDF
    doc2 = fitz.open()
    page = doc2.new_page(width=400, height=200)
    page.insert_text((10, 50), "Text Layer PDF Content", fontsize=14)
    doc2.save(str(FIXTURES_DIR / "textlayer.pdf"))
    doc2.close()


if __name__ == "__main__":
    generate_all()
    print("Fixtures generated in", FIXTURES_DIR)
