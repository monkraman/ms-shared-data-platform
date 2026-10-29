"""Pydantic schemas for Multi-tenancy and workspace boundaries."""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class TenantTier(str, Enum):
    ENTERPRISE = "enterprise"
    PILOT = "pilot"
    DEMO = "demo"


class TenantBase(BaseModel):
    id: str = Field(..., description="Unique slug or identifier for tenant, e.g. khc-europe")
    name: str = Field(..., description="Full legal or organization name")
    sector: str = Field(..., description="Industry sector, e.g. Food & Beverage")
    tier: TenantTier = Field(default=TenantTier.ENTERPRISE)
    primary_jurisdiction: str = Field(default="FR", description="Default primary reporting market (ISO 3166-1 alpha-2)")
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
    tier: TenantTier = Field(default=TenantTier.ENTERPRISE)
    admin_email: Optional[str] = Field(default=None, description="Initial organization administrator email")
    admin_name: Optional[str] = Field(default=None, description="Initial administrator full name")
    admin_password: Optional[str] = Field(default="password123", description="Initial administrator password")




class TenantResponse(TenantBase):
    active_products_count: int = 0
    open_quality_issues_count: int = 0
    last_calculation_run_id: Optional[str] = None
