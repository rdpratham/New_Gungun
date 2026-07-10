"""Shared pytest fixtures and skip markers."""
import pytest
from pathlib import Path

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"


def _easyocr_available() -> bool:
    """Check if EasyOCR model weights have been downloaded."""
    try:
        import easyocr  # noqa: F401
        # Check for at least one weight file
        if list(MODELS_DIR.glob("*.pth")):
            return True
        # Try a tiny in-memory load to see if cached models exist elsewhere
        import easyocr.config as cfg
        default_dir = Path.home() / ".EasyOCR" / "model"
        if default_dir.exists() and list(default_dir.glob("*.pth")):
            return True
        return False
    except ImportError:
        return False


requires_easyocr = pytest.mark.skipif(
    not _easyocr_available(),
    reason="EasyOCR model weights not available. Run: python scripts/download_models.py",
)
