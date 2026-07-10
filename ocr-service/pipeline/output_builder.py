"""Build output artifacts: JSON result, plain text, searchable PDF."""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


def build_json_result(job_id: str, pages: list[dict]) -> dict:
    """Assemble the full job result dict."""
    return {
        "job_id": job_id,
        "page_count": len(pages),
        "pages": pages,
    }


def write_json(result: dict, output_path: Path) -> None:
    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2))


def write_txt(pages: list[dict], output_path: Path) -> None:
    lines = []
    for page in pages:
        lines.append(f"--- Page {page['page_number']} ---")
        lines.append(page.get("full_text", ""))
        lines.append("")
    output_path.write_text("\n".join(lines), encoding="utf-8")


def write_searchable_pdf(
    pages: list[dict],
    output_path: Path,
) -> None:
    """Create a searchable PDF with invisible text overlay over the original images."""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        raise RuntimeError("PyMuPDF required for searchable PDF output")

    doc = fitz.open()
    for page_data in pages:
        img: Image.Image | None = page_data.get("image")
        if img is None:
            continue
        w, h = img.size
        pdf_page = doc.new_page(width=w, height=h)

        # Insert original image
        import io
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        img_bytes = buf.read()
        rect = fitz.Rect(0, 0, w, h)
        pdf_page.insert_image(rect, stream=img_bytes)

        # Overlay invisible text
        for region in page_data.get("regions", []):
            bbox = region.get("bbox")
            text = region.get("text_corrected", region.get("text", ""))
            if not bbox or not text:
                continue
            # bbox is [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]
            x0 = min(p[0] for p in bbox)
            y0 = min(p[1] for p in bbox)
            x1 = max(p[0] for p in bbox)
            y1 = max(p[1] for p in bbox)
            rect_text = fitz.Rect(x0, y0, x1, y1)
            if rect_text.is_empty or rect_text.is_infinite:
                continue
            pdf_page.insert_textbox(
                rect_text,
                text,
                fontsize=max(8, int((y1 - y0) * 0.8)),
                render_mode=3,  # invisible
            )

    doc.save(str(output_path))
    doc.close()
