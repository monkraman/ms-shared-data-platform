"""FastAPI application entry point for Monkspaces Shared Data Platform."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.api.v1.health import router as health_router
from app.core.config import get_settings


def create_application() -> FastAPI:
    """Application factory for Monkspaces Shared Data Platform API."""
    settings = get_settings()

    openapi_tags = [
        {
            "name": "System Health",
            "description": "Liveness and readiness probes for platform orchestration, container health, and uptime monitoring.",
        },
        {
            "name": "Authentication & Identity",
            "description": "Enterprise SSO (Microsoft, Google, SAML), email/password login, 6-digit MFA challenge verification, and active session auditing.",
        },
        {
            "name": "Multi-Tenancy",
            "description": "Tenant workspace lifecycle, active regulatory jurisdictions, and enterprise ERP connector configurations.",
        },
        {
            "name": "Layer 1: Shared Data Foundation",
            "description": "Canonical product catalogue, Bill of Materials (BOM) hierarchies, multi-material laminate composition splits (DP01–DP25), and sales placed on market.",
        },
        {
            "name": "Layer 2: Data Quality & Source-of-Truth Workflow",
            "description": "Financial risk engine (€ money-at-risk), country requirements validation, blocker vs warning gap management, and source correction dispatch tickets.",
        },
        {
            "name": "Layer 3: EPR Compliance Module",
            "description": "Extended Producer Responsibility (EPR) regulatory calculation engine, versioned fee tariffs (UK Defra PackUK 2026/27, Citeo France), RAM RAG eco-modulation multipliers, fee hotspot analytics, and what-if scenario simulations.",
        },
    ]

    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "## Monkspaces Shared Product & Packaging Data Platform API\n\n"
            "An enterprise-grade, multi-tenant SaaS API for collecting, normalising, governing, "
            "and calculating compliance liabilities across national EPR regulations (UK Defra RPD, CITEO, VerpackG) "
            "and future EU PPWR / Digital Product Passport requirements.\n\n"
            "### Architecture Highlights:\n"
            "- **Layer 1 Canonical Foundation:** Master products, BOM tree, and sales placed on market.\n"
            "- **Layer 2 Data Quality:** Financial liability exposure (€ at risk) and source correction workflow.\n"
            "- **Layer 3 EPR Compliance:** Reproducible calculation runs with line-item formula explainability.\n"
            "- **Strict Multi-Tenancy:** Scoped by `X-Tenant-ID` header with consultant workspace isolation.\n"
        ),
        openapi_tags=openapi_tags,
        docs_url="/docs" if settings.debug or settings.app_env != "production" else None,
        redoc_url="/redoc" if settings.debug or settings.app_env != "production" else None,
    )

    # Cross-Origin Resource Sharing (CORS)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount API routers
    # 1. Root /health endpoint for orchestration (Docker, K8s, Cloud Run)
    application.include_router(health_router, prefix="", tags=["System Health"])
    # 2. Versioned API prefix (/api/v1)
    application.include_router(api_router, prefix=settings.api_prefix)

    return application


app = create_application()
