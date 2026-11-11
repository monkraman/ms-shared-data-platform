"""API router: one module per screen or domain under app/api/v1."""

from fastapi import APIRouter

from app.api.v1 import (
    auth,
    compliance,
    data_points,
    data_sources,
    gaps,
    health,
    horizon,
    imports,
    insights,
    jobs,
    products,
    workspaces,
)

api_router = APIRouter()

api_router.include_router(health.router, prefix="", tags=["System Health"])
api_router.include_router(auth.router)  # screen 1 (sign-in) and 9 (users)
api_router.include_router(workspaces.router)  # screen 2
api_router.include_router(data_points.router)  # screen 3
api_router.include_router(products.router)  # screen 4
api_router.include_router(imports.router)  # screen 5
api_router.include_router(gaps.router)  # screens 6-8
api_router.include_router(data_sources.router)  # screen 18
api_router.include_router(compliance.router)  # screens 12-13
api_router.include_router(insights.router)  # screen 14
api_router.include_router(horizon.router)  # horizon scanning
api_router.include_router(jobs.router)  # background job status
