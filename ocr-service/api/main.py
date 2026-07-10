"""FastAPI application entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.database import init_db
from api.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Enterprise OCR Service",
        description="Async OCR microservice powered by EasyOCR. No LLM, no cloud APIs.",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "ocr-service"}

    app.include_router(router, prefix="/api/v1")
    return app


app = create_app()
