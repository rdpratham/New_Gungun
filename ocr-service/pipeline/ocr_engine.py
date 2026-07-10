"""EasyOCR wrapper — loads model once and stays warm."""
from __future__ import annotations

import threading
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image


class OCREngine:
    """Singleton-style EasyOCR wrapper that loads weights once."""

    _instance: Optional["OCREngine"] = None
    _lock = threading.Lock()

    def __init__(
        self,
        languages: list[str] = None,
        gpu: bool = False,
        model_storage_directory: Optional[str] = None,
    ):
        if languages is None:
            languages = ["en"]
        self._languages = languages
        self._gpu = gpu
        self._model_dir = model_storage_directory
        self._reader = None

    @classmethod
    def get_instance(
        cls,
        languages: list[str] = None,
        gpu: bool = False,
        model_storage_directory: Optional[str] = None,
    ) -> "OCREngine":
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls(languages, gpu, model_storage_directory)
                cls._instance._load()
        return cls._instance

    def _load(self) -> None:
        import easyocr
        kwargs: dict = {
            "lang_list": self._languages,
            "gpu": self._gpu,
            "verbose": False,
        }
        if self._model_dir:
            kwargs["model_storage_directory"] = self._model_dir
        self._reader = easyocr.Reader(**kwargs)

    def _image_to_numpy(self, img: Image.Image) -> np.ndarray:
        return np.array(img.convert("RGB"))

    def read_image(self, img: Image.Image) -> list[dict]:
        """Run OCR on a PIL Image. Returns list of region dicts with bbox/text/confidence."""
        if self._reader is None:
            self._load()
        arr = self._image_to_numpy(img)
        raw = self._reader.readtext(arr, detail=1, paragraph=False)
        results = []
        for bbox, text, conf in raw:
            results.append({
                "bbox": [[int(p[0]), int(p[1])] for p in bbox],
                "text": text,
                "confidence": round(float(conf), 4),
            })
        return results

    def read_batch(self, images: list[Image.Image]) -> list[list[dict]]:
        """Process multiple images, returning results per image."""
        return [self.read_image(img) for img in images]
