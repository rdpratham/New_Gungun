"""Image preprocessing pipeline: deskew, denoise, CLAHE, binarization, upscaling.

Each stage is independently toggleable via the config dict passed to `preprocess`.
"""
import math
from typing import Optional

import cv2
import numpy as np
from PIL import Image


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _pil_to_cv(img: Image.Image) -> np.ndarray:
    return cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2BGR)


def _cv_to_pil(arr: np.ndarray) -> Image.Image:
    if len(arr.shape) == 2:
        return Image.fromarray(arr)
    return Image.fromarray(cv2.cvtColor(arr, cv2.COLOR_BGR2RGB))


# ---------------------------------------------------------------------------
# Individual stages
# ---------------------------------------------------------------------------

def deskew(img: Image.Image) -> Image.Image:
    """Correct skew angle by finding dominant text angle via Hough lines."""
    gray = cv2.cvtColor(_pil_to_cv(img), cv2.COLOR_BGR2GRAY)
    # Threshold + find edges
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    coords = np.column_stack(np.where(thresh > 0))
    if len(coords) < 10:
        return img
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle += 90
    if abs(angle) < 0.5:
        return img
    h, w = gray.shape
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        _pil_to_cv(img), M, (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    return _cv_to_pil(rotated)


def orientation_correction(img: Image.Image) -> Image.Image:
    """Coarse orientation correction using EXIF data (Pillow handles it)."""
    try:
        from PIL import ImageOps
        return ImageOps.exif_transpose(img)
    except Exception:
        return img


def denoise(img: Image.Image) -> Image.Image:
    """Apply non-local means denoising."""
    arr = _pil_to_cv(img)
    denoised = cv2.fastNlMeansDenoisingColored(arr, None, 10, 10, 7, 21)
    return _cv_to_pil(denoised)


def clahe_contrast(img: Image.Image) -> Image.Image:
    """Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) on luminance."""
    arr = _pil_to_cv(img)
    lab = cv2.cvtColor(arr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    cl = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(l)
    enhanced = cv2.merge([cl, a, b])
    bgr = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
    return _cv_to_pil(bgr)


def adaptive_binarization(img: Image.Image) -> Image.Image:
    """Convert to grayscale and apply adaptive thresholding."""
    arr = _pil_to_cv(img)
    gray = cv2.cvtColor(arr, cv2.COLOR_BGR2GRAY)
    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 10
    )
    return _cv_to_pil(binary)


def border_cleanup(img: Image.Image) -> Image.Image:
    """Remove black borders/scan artifacts by cropping to content bounding box."""
    arr = np.array(img.convert("L"))
    # For binarized images, content is dark on white; flip if mostly dark
    if arr.mean() < 128:
        arr = 255 - arr
    _, thresh = cv2.threshold(arr, 200, 255, cv2.THRESH_BINARY_INV)
    coords = cv2.findNonZero(thresh)
    if coords is None:
        return img
    x, y, w, h = cv2.boundingRect(coords)
    # Add small margin
    pad = 10
    x = max(0, x - pad)
    y = max(0, y - pad)
    w = min(img.width - x, w + 2 * pad)
    h = min(img.height - y, h + 2 * pad)
    return img.crop((x, y, x + w, y + h))


def upscale(img: Image.Image, min_dpi: int = 150, target_dpi: int = 300) -> Image.Image:
    """Upscale image if its estimated DPI is below min_dpi."""
    w, h = img.size
    # Estimate DPI: if either dimension < 1000px we likely have a low-res image
    if max(w, h) < (min_dpi / 72) * 800:
        scale = target_dpi / min_dpi
        new_w = int(w * scale)
        new_h = int(h * scale)
        return img.resize((new_w, new_h), Image.LANCZOS)
    return img


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

_STAGE_ORDER = [
    "orientation_correction",
    "upscaling",
    "deskew",
    "denoise",
    "clahe",
    "adaptive_binarization",
    "border_cleanup",
]

_STAGE_FN = {
    "orientation_correction": orientation_correction,
    "upscaling": upscale,
    "deskew": deskew,
    "denoise": denoise,
    "clahe": clahe_contrast,
    "adaptive_binarization": adaptive_binarization,
    "border_cleanup": border_cleanup,
}


def preprocess(
    img: Image.Image,
    stages: Optional[dict] = None,
    save_debug: bool = False,
    debug_prefix: str = "",
) -> tuple[Image.Image, dict]:
    """Run the enabled preprocessing stages in order.

    Returns (processed_image, stage_debug_info).
    If save_debug=True, saves before/after thumbnails to debug_prefix path prefix.
    """
    if stages is None:
        stages = {k: True for k in _STAGE_ORDER}

    debug_info = {}
    original = img.copy()

    for stage_name in _STAGE_ORDER:
        if not stages.get(stage_name, True):
            debug_info[stage_name] = "skipped"
            continue
        fn = _STAGE_FN[stage_name]
        try:
            img = fn(img)
            debug_info[stage_name] = "ok"
        except Exception as exc:
            debug_info[stage_name] = f"error: {exc}"

    if save_debug and debug_prefix:
        _save_debug_thumbnails(original, img, debug_prefix)

    return img, debug_info


def _save_debug_thumbnails(before: Image.Image, after: Image.Image, prefix: str) -> None:
    thumb_size = (400, 400)
    b = before.copy()
    b.thumbnail(thumb_size)
    b.save(f"{prefix}_before.jpg")
    a = after.copy()
    a.thumbnail(thumb_size)
    a.save(f"{prefix}_after.jpg")
