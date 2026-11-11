"""Main API router combining domain and system endpoints."""

from fastapi import APIRouter
from app.api.v1 import health, tenants, foundation, quality, epr, auth, config, compliance_modules, jobs

api_router = APIRouter()

# System endpoints
api_router.include_router(health.router, prefix="", tags=["System Health"])

# Dynamic Regulatory Configuration Engine (Sectors, Countries, DP01-DP45)
api_router.include_router(config.router)

# Authentication & Identity ([P1] SSO & Password, [P2] MFA, [P3] Sessions)
api_router.include_router(auth.router)

# Multi-tenancy
api_router.include_router(tenants.router)

# Layer 1: Canonical Shared Data Foundation
api_router.include_router(foundation.router)

# Layer 2: Data Quality & Single Source of Truth Correction Workflow
api_router.include_router(quality.router)

# Layer 3: EPR Compliance Module (Calculation, Hotspots, What-If Scenarios)
api_router.include_router(epr.router)

# Layer 4: Multi-Module Outcomes (EU PPWR Recyclability Scorecard & DPP Passport)
api_router.include_router(compliance_modules.router)

# Platform foundation (Step 0): background job status
api_router.include_router(jobs.router)
