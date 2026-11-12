"""Health check endpoints for platform monitoring and readiness."""

from datetime import UTC, datetime

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.core.config import get_settings
from app.core.db import get_engine
from app.core.tenancy import RLS_ROLE

router = APIRouter(tags=["System Health"])


class HealthCheckResponse(BaseModel):
    """Schema for health check responses."""

    status: str = Field(..., description="Operational status: healthy, degraded, or unhealthy")
    service: str = Field(..., description="Service identifier")
    version: str = Field(..., description="Application version")
    environment: str = Field(..., description="Runtime environment")
    timestamp: datetime = Field(..., description="Current server time (UTC)")


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    summary="Service Health Check",
    description="Returns service availability, version, environment, and current UTC timestamp.",
)
async def check_health() -> HealthCheckResponse:
    """Return platform operational status."""
    settings = get_settings()
    return HealthCheckResponse(
        status="healthy",
        service="monkspaces-backend",
        version=settings.app_version,
        environment=settings.app_env,
        timestamp=datetime.now(UTC),
    )


@router.get(
    "/health/ready",
    summary="Readiness check",
    description="Checks the database connection and the RLS role every request switches to. "
    "Returns 503 when either is missing.",
)
async def check_ready() -> JSONResponse:
    if not get_settings().database_configured:
        return JSONResponse({"status": "unready", "database": "not configured"}, status_code=503)
    try:
        async with get_engine().connect() as conn:
            role = await conn.scalar(text("SELECT 1 FROM pg_roles WHERE rolname = :r"), {"r": RLS_ROLE})
    except Exception:  # noqa: BLE001 - any failure means not ready
        return JSONResponse({"status": "unready", "database": "unreachable"}, status_code=503)
    if role is None:
        # A restored or new database without migrations: run `alembic upgrade head`.
        return JSONResponse({"status": "unready", "database": "migrations not applied"}, status_code=503)
    return JSONResponse({"status": "ready", "database": "ok"})
