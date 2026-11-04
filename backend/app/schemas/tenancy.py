"""Pydantic schemas for Multi-tenancy and workspace boundaries."""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class TenantTier(str, Enum):
    ENTERPRISE = "enterprise"
    PILOT = "pilot"
    DEMO = "demo"
    MID_MARKET = "mid_market"


class TenantBase(BaseModel):
    id: str = Field(..., description="Unique slug or identifier for tenant, e.g. khc-europe")
    name: str = Field(..., description="Full legal or organization name")
    sector: str = Field(..., description="Industry sector, e.g. Food & Beverage")
    tier: TenantTier = Field(default=TenantTier.ENTERPRISE)
    primary_jurisdiction: str = Field(default="GB", description="Default primary reporting market (ISO 3166-1 alpha-2)")
    active_modules: List[str] = Field(
        default_factory=lambda: ["epr", "ppwr", "dpp", "lca"],
        description="Subscribed compliance and intelligence modules: epr, ppwr, dpp, lca"
    )
    logo_url: Optional[str] = Field(default=None, description="Custom branding logo URL or base64")
    theme_color: Optional[str] = Field(default="#111827", description="Client brand theme hex color")
    source_systems: List[str] = Field(
        default_factory=lambda: ["Trace One (Devex PLM)", "SAP ERP", "Snowflake Data Lake"],
        description="Configured upstream source systems"
    )


class TenantCreate(BaseModel):
    id: str = Field(..., description="Unique slug or identifier for tenant, e.g. aurora-pack")
    name: str = Field(..., description="Full legal company name")
    sector: str = Field(..., description="Industry sector, e.g. Food & Beverage / Personal Care")
    organisation_size: Optional[str] = Field(default="L", description="Size threshold, e.g. L or S")
    rpd_organisation_id: Optional[str] = Field(default=None, description="UK Defra RPD ID")
    primary_currency: Optional[str] = Field(default="EUR", description="Reporting currency")
    active_jurisdictions: List[str] = Field(default_factory=list, description="Target EPR jurisdictions")
    active_modules: List[str] = Field(
        default_factory=lambda: ["epr", "ppwr", "dpp", "lca"],
        description="Subscribed compliance and intelligence modules: epr, ppwr, dpp, lca"
    )
    tier: TenantTier = Field(default=TenantTier.ENTERPRISE)
    logo_url: Optional[str] = Field(default=None, description="Custom branding logo URL or base64")
    theme_color: Optional[str] = Field(default="#111827", description="Client brand theme hex color")
    admin_email: Optional[str] = Field(default=None, description="Initial organization administrator email")
    admin_name: Optional[str] = Field(default=None, description="Initial administrator full name")
    admin_password: Optional[str] = Field(default="password123", description="Initial administrator password")


class TenantModulesUpdate(BaseModel):
    active_modules: List[str] = Field(
        ...,
        description="Updated list of active modules: epr, ppwr, dpp, lca"
    )


class TenantUpdate(BaseModel):
    name: Optional[str] = Field(default=None, description="Updated full legal company name")
    sector: Optional[str] = Field(default=None, description="Updated industry sector")
    tier: Optional[TenantTier] = Field(default=None, description="Enterprise tier")
    logo_url: Optional[str] = Field(default=None, description="Custom branding logo URL or base64")
    theme_color: Optional[str] = Field(default=None, description="Client brand theme hex color")
    active_modules: Optional[List[str]] = Field(default=None, description="Subscribed modules")


class TenantResponse(TenantBase):
    active_products_count: int = 0
    open_quality_issues_count: int = 0
    last_calculation_run_id: Optional[str] = None
