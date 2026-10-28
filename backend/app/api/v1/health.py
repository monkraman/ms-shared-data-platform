"""Health check endpoint for platform monitoring and readiness."""

from datetime import datetime, timezone
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.config import get_settings

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
        timestamp=datetime.now(timezone.utc),
    )
