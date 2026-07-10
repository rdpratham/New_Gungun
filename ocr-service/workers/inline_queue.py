"""In-process background task queue — used when Redis/Celery is unavailable."""
import threading
from queue import Queue, Empty


_queue: Queue = Queue()
_started = False
_lock = threading.Lock()


def _worker_loop() -> None:
    while True:
        try:
            job_id = _queue.get(timeout=1)
        except Empty:
            continue
        try:
            from workers.job_processor import process_job
            process_job(job_id)
        except Exception:
            pass
        finally:
            _queue.task_done()


def start_worker() -> None:
    global _started
    with _lock:
        if not _started:
            t = threading.Thread(target=_worker_loop, daemon=True)
            t.start()
            _started = True


def enqueue(job_id: str) -> None:
    start_worker()
    _queue.put(job_id)
