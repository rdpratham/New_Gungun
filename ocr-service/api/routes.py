"""FastAPI routes for job submission and status."""
import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from api.database import Job, JobStatus, get_db
from api.schemas import JobCreatedResponse, JobStatusResponse
from api.settings import settings
from pipeline.ingestion import validate_upload, get_pdf_page_count

router = APIRouter()


def _dispatch_job(job_id: str) -> None:
    if settings.worker_mode == "celery":
        try:
            from workers.celery_app import run_ocr_job
            run_ocr_job.delay(job_id)
            return
        except Exception:
            pass
    from workers.inline_queue import enqueue
    enqueue(job_id)


@router.post("/jobs", response_model=JobCreatedResponse, status_code=202)
async def submit_job(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    data = await file.read()

    try:
        ftype = validate_upload(data, file.filename or "", settings.max_upload_size_mb)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    job_id = str(uuid.uuid4())
    upload_path = settings.upload_dir / f"{job_id}_{file.filename}"
    upload_path.write_bytes(data)

    page_count = 0
    if ftype == "pdf":
        try:
            page_count = get_pdf_page_count(data)
        except Exception:
            page_count = 0

    job = Job(
        id=job_id,
        status=JobStatus.pending,
        filename=file.filename or "unknown",
        file_type=ftype,
        page_count=page_count,
        upload_path=str(upload_path),
    )
    db.add(job)
    db.commit()

    _dispatch_job(job_id)

    return JobCreatedResponse(
        job_id=job_id,
        status=JobStatus.pending,
        message=f"Job submitted. Using worker_mode='{settings.worker_mode}'.",
    )


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job(job_id: str, db: Session = Depends(get_db)):
    job: Job | None = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    result = None
    if job.status == JobStatus.completed and job.result_path:
        try:
            result_path = Path(job.result_path)
            if result_path.exists():
                raw = json.loads(result_path.read_text())
                # Strip image objects (not serializable)
                for p in raw.get("pages", []):
                    p.pop("image", None)
                result = raw
        except Exception:
            pass

    return JobStatusResponse(
        job_id=job.id,
        status=job.status,
        filename=job.filename,
        file_type=job.file_type,
        page_count=job.page_count,
        created_at=job.created_at,
        updated_at=job.updated_at,
        completed_at=job.completed_at,
        error_message=job.error_message,
        result=result,
    )


@router.get("/jobs/{job_id}/export/{format}")
async def export_job(job_id: str, format: str, db: Session = Depends(get_db)):
    if format not in ("txt", "json", "pdf"):
        raise HTTPException(status_code=400, detail="format must be txt, json, or pdf")

    job: Job | None = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != JobStatus.completed:
        raise HTTPException(status_code=409, detail="Job not yet completed")

    out_dir = settings.output_dir / job_id
    if format == "txt":
        p = out_dir / "result.txt"
    elif format == "json":
        p = out_dir / "result.json"
    else:
        p = out_dir / "searchable.pdf"

    if not p.exists():
        raise HTTPException(status_code=404, detail="Output file not found")

    from fastapi.responses import FileResponse
    media = {"txt": "text/plain", "json": "application/json", "pdf": "application/pdf"}
    return FileResponse(str(p), media_type=media[format], filename=p.name)
