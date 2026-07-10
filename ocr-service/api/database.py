from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, Text, Enum
from sqlalchemy.orm import DeclarativeBase, sessionmaker
import enum
import datetime

from api.settings import settings


engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class JobStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True)
    status = Column(Enum(JobStatus), default=JobStatus.pending, nullable=False)
    filename = Column(String(512), nullable=False)
    file_type = Column(String(32), nullable=False)
    page_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    result_path = Column(String(1024), nullable=True)
    upload_path = Column(String(1024), nullable=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
