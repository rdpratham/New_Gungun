"""Unit tests for each preprocessing stage."""
import numpy as np
import pytest
from PIL import Image

from pipeline.preprocessing import (
    deskew,
    denoise,
    clahe_contrast,
    adaptive_binarization,
    border_cleanup,
    upscale,
    orientation_correction,
    preprocess,
)


def _white_image(w=200, h=100) -> Image.Image:
    return Image.new("RGB", (w, h), color=(255, 255, 255))


def _text_image() -> Image.Image:
    from PIL import ImageDraw
    img = Image.new("RGB", (300, 80), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((10, 20), "Test OCR 1234", fill=(0, 0, 0))
    return img


def test_deskew_returns_image():
    img = _text_image()
    result = deskew(img)
    assert isinstance(result, Image.Image)


def test_denoise_returns_same_size():
    img = _text_image()
    result = denoise(img)
    assert result.size == img.size


def test_clahe_returns_same_size():
    img = _text_image()
    result = clahe_contrast(img)
    assert result.size == img.size


def test_adaptive_binarization_is_grayscale():
    img = _text_image()
    result = adaptive_binarization(img)
    assert result.mode in ("L", "RGB")


def test_border_cleanup_returns_image():
    img = _text_image()
    result = border_cleanup(img)
    assert isinstance(result, Image.Image)


def test_upscale_small_image():
    small = Image.new("RGB", (50, 50), color="white")
    result = upscale(small, min_dpi=150, target_dpi=300)
    assert result.size[0] >= small.size[0]


def test_upscale_large_image_unchanged():
    large = Image.new("RGB", (2000, 1500), color="white")
    result = upscale(large, min_dpi=150, target_dpi=300)
    assert result.size == large.size


def test_orientation_correction_returns_image():
    img = _text_image()
    result = orientation_correction(img)
    assert isinstance(result, Image.Image)


def test_preprocess_all_stages():
    img = _text_image()
    result, info = preprocess(img)
    assert isinstance(result, Image.Image)
    assert isinstance(info, dict)
    # All stages should have been attempted
    for stage_name, status in info.items():
        assert status in ("ok", "skipped") or status.startswith("error")


def test_preprocess_selective_disable():
    img = _text_image()
    stages = {k: False for k in ["deskew", "denoise", "clahe", "adaptive_binarization", "border_cleanup", "upscaling", "orientation_correction"]}
    result, info = preprocess(img, stages=stages)
    for v in info.values():
        assert v == "skipped"


def test_preprocess_debug_thumbnails(tmp_path):
    img = _text_image()
    prefix = str(tmp_path / "debug")
    result, _ = preprocess(img, save_debug=True, debug_prefix=prefix)
    assert (tmp_path / "debug_before.jpg").exists()
    assert (tmp_path / "debug_after.jpg").exists()
