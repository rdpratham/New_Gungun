# Enterprise OCR Service

Async OCR microservice powered by **EasyOCR** (CPU or GPU). No LLM, no cloud API calls.

## Stack

| Layer | Choice |
|---|---|
| API | FastAPI + Uvicorn |
| Queue | Celery + Redis (falls back to in-process thread queue if Redis unavailable) |
| Database | SQLite via SQLAlchemy (swap to Postgres with one env var) |
| PDF rendering | PyMuPDF (`fitz`) |
| Preprocessing | OpenCV + Pillow |
| OCR | EasyOCR |
| Fuzzy correction | rapidfuzz |

> **Worker mode used here:** `inline` (in-process background thread queue). Set `WORKER_MODE=celery` and provide a Redis URL to switch to Celery.

## Quick Start

```bash
cd ocr-service

# 1. Install dependencies
pip install -r requirements.txt

# 2. Pre-download EasyOCR model weights (once)
python scripts/download_models.py --languages en

# 3. Start the API server
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

# 4. Submit a job
curl -X POST http://localhost:8000/api/v1/jobs \
  -F "file=@/path/to/document.jpg"
# -> {"job_id": "...", "status": "pending"}

# 5. Poll for results
curl http://localhost:8000/api/v1/jobs/<job_id>

# 6. Export output
curl http://localhost:8000/api/v1/jobs/<job_id>/export/txt -o result.txt
curl http://localhost:8000/api/v1/jobs/<job_id>/export/json -o result.json
curl http://localhost:8000/api/v1/jobs/<job_id>/export/pdf -o searchable.pdf
```

## Docker

```bash
cd ocr-service
docker compose up --build
# API at http://localhost:8000
# Health: http://localhost:8000/health
```

The `Dockerfile.api` and `Dockerfile.worker` both run `scripts/download_models.py` at
build time so the container is fully self-contained after the first build (air-gap safe).

## Configuration

Edit `config/thresholds.yaml` to tune:

- `ocr.confidence_threshold` — regions below this go into `needs_review`
- `preprocessing.enabled_stages.*` — toggle individual preprocessing steps
- `preprocessing.save_debug_thumbnails` — save before/after PNGs to `debug_thumbnails/`
- `validation.regex_rules` — add/remove document-type regex patterns
- `config/dictionary.txt` — extend the fuzzy-correction word list (one word per line)

## Postgres Migration

Change one env var:

```bash
export DATABASE_URL=postgresql+psycopg2://user:pass@host/dbname
```

SQLAlchemy handles the rest.

## API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/jobs` | Submit JPG or PDF for OCR |
| `GET` | `/api/v1/jobs/{id}` | Poll status + retrieve results |
| `GET` | `/api/v1/jobs/{id}/export/{fmt}` | Download `txt`, `json`, or `pdf` |
| `GET` | `/health` | Health check |

## Running Tests

```bash
cd ocr-service
pytest tests/ -v
```

Unit tests run without EasyOCR model weights. The integration tests in
`test_fixtures_ocr.py` and `test_api.py` require EasyOCR to be installed
and models downloaded (they take 30–120 s each on CPU).

## Phase 2 (out of scope for this pass)

- Kubernetes manifests (Deployment, HPA, PVC)
- Prometheus metrics + Grafana dashboard
- RBAC / API key authentication
- PII redaction (names, SSN, DOB) before storage
- GPU node pools and CUDA-enabled Docker images
- S3/GCS for file storage instead of local disk
