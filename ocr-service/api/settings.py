import os
from pathlib import Path
from pydantic_settings import BaseSettings


BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # Database
    database_url: str = f"sqlite:///{BASE_DIR}/ocr_jobs.db"

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    # File storage
    upload_dir: Path = BASE_DIR / "uploads"
    models_dir: Path = BASE_DIR / "models"
    output_dir: Path = BASE_DIR / "outputs"
    debug_thumbnails_dir: Path = BASE_DIR / "debug_thumbnails"

    # Config paths
    thresholds_config: Path = BASE_DIR / "config" / "thresholds.yaml"
    dictionary_path: Path = BASE_DIR / "config" / "dictionary.txt"

    # Limits
    max_upload_size_mb: int = 100
    max_pages_per_pdf: int = 200

    # Worker mode: "celery" or "inline" (in-process fallback)
    worker_mode: str = "inline"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Ensure directories exist
for d in [settings.upload_dir, settings.output_dir, settings.debug_thumbnails_dir]:
    d.mkdir(parents=True, exist_ok=True)
