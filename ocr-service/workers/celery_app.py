"""Celery application and task definitions."""
from celery import Celery
from api.settings import settings

celery_app = Celery(
    "ocr_worker",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
)


@celery_app.task(name="workers.celery_app.run_ocr_job", bind=True, max_retries=2)
def run_ocr_job(self, job_id: str) -> str:
    try:
        from workers.job_processor import process_job
        process_job(job_id)
        return job_id
    except Exception as exc:
        raise self.retry(exc=exc, countdown=5)
