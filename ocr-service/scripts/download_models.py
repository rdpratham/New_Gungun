#!/usr/bin/env python3
"""Pre-download and pin EasyOCR model weights to /models directory.

Run this once before starting the service in an air-gapped environment:
    python scripts/download_models.py [--languages en fr de]
"""
import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = REPO_ROOT / "models"


def download(languages: list[str], gpu: bool) -> None:
    print(f"Downloading EasyOCR weights for: {languages}")
    print(f"Model storage: {MODELS_DIR}")
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    import easyocr
    reader = easyocr.Reader(
        lang_list=languages,
        gpu=gpu,
        model_storage_directory=str(MODELS_DIR),
        download_enabled=True,
        verbose=True,
    )
    print("Models downloaded successfully.")
    # Quick smoke test
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont
    img = Image.new("RGB", (200, 50), color="white")
    draw = ImageDraw.Draw(img)
    draw.text((10, 10), "Hello 123", fill="black")
    result = reader.readtext(np.array(img))
    print(f"Smoke test result: {result}")
    print("Done.")


def main():
    parser = argparse.ArgumentParser(description="Download EasyOCR model weights")
    parser.add_argument("--languages", nargs="+", default=["en"], help="Language codes")
    parser.add_argument("--gpu", action="store_true", help="Use GPU")
    args = parser.parse_args()
    download(args.languages, args.gpu)


if __name__ == "__main__":
    main()
