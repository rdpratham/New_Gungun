from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel


class JobCreatedResponse(BaseModel):
    job_id: str
    status: str
    message: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    filename: str
    file_type: str
    page_count: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    result: Optional[dict[str, Any]] = None
