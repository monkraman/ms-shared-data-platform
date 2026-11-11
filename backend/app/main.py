"""FastAPI application entry point for Monkspaces Shared Data Platform."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models  # noqa: F401 - register every table and job handler
from app.api.router import api_router
from app.api.v1.health import router as health_router
from app.core.config import get_settings
from app.core.db import dispose_engine
from app.core.errors import register_error_handlers
from app.core.jobs import wait_for_inline_jobs
from app.core.request_context import RequestIdMiddleware, configure_logging


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    yield
    await wait_for_inline_jobs()
    await dispose_engine()


def create_application() -> FastAPI:
    """Application factory for Monkspaces Shared Data Platform API."""
    settings = get_settings()
    configure_logging()

    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Compliance Hub API: client workspaces, product and packaging data, imports and syncs, "
            "data gaps, EPR and PPWR results, insights and horizon scanning. Every endpoint needs a "
            "signed-in user and a named permission; client data is isolated by Postgres row-level security."
        ),
        lifespan=lifespan,
        docs_url="/docs" if settings.debug or settings.app_env != "production" else None,
        redoc_url="/redoc" if settings.debug or settings.app_env != "production" else None,
    )

    # Cross-Origin Resource Sharing (CORS) - Configured for Vercel & Local Dev
    allowed_origins = [
        "https://ms-shared-data-platform-nine.vercel.app",
        "http://localhost:4200",
        "http://localhost:3000",
        "http://127.0.0.1:4200",
    ]
    application.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )
    # Outermost, so every response and log line carries a request ID.
    application.add_middleware(RequestIdMiddleware)
    register_error_handlers(application)

    # Mount API routers
    # 1. Root /health endpoint for orchestration (Docker, K8s, Cloud Run)
    application.include_router(health_router, prefix="", tags=["System Health"])
    # 2. Versioned API prefix (/api/v1)
    application.include_router(api_router, prefix=settings.api_prefix)

    return application


app = create_application()
