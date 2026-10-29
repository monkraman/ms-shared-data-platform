"""Pydantic schemas for dynamic, configurable regulatory rules, sectors, countries, and data points."""

from typing import List, Optional, Dict
from pydantic import BaseModel, Field


class SectorConfig(BaseModel):
    id: str = Field(..., description="Unique sector identifier, e.g. food_beverage")
    name: str = Field(..., description="Display name of the sector")
    description: str = Field(..., description="Sector scope and applicable product types")
    default_categories: List[str] = Field(default_factory=list, description="Common packaging / product categories")
    active: bool = True


class UserRoleConfig(BaseModel):
    role_key: str = Field(..., description="Role key, e.g. superadmin, org_admin, analyst, viewer, supplier_contact")
    name: str = Field(..., description="Human display title")
    description: str = Field(..., description="Scope of authority and permissions")
    is_client_assignable: bool = True


class TariffRate(BaseModel):
    material_code: str = Field(..., description="Material classification, e.g. PLASTIC_RIGID, ALUMINIUM, GLASS")
    material_name: str = Field(..., description="Full material title")
    jurisdiction: str = Field(..., description="Country or scheme code, e.g. UK_DEFRA, DK_DPA")
    currency: str = Field(default="GBP", description="Tariff currency")
    base_rate_per_tonne: float = Field(..., description="Base fee in local currency per metric tonne")
    unit: str = Field(default="tonne", description="Billing unit")
    ram_green_discount_pct: float = Field(default=0.0, description="Recyclability assessment green discount %")
    ram_amber_rate_pct: float = Field(default=0.0, description="Recyclability assessment amber neutral rate %")
    ram_red_penalty_pct: float = Field(default=0.0, description="Recyclability assessment red penalty %")
    effective_year: str = Field(default="2025/2026", description="Regulatory fee schedule year")
    source_citation: str = Field(default="", description="Official statutory instrument / tariff notice")


class RegulationConfig(BaseModel):
    regulation_code: str = Field(..., description="Unique regulatory code, e.g. UK_PEPR, EU_PPWR, DE_VERPACKG")
    name: str = Field(..., description="Official title of regulation")
    country_code: str = Field(..., description="ISO 3166-1 alpha-2 country code, or EU")
    country_name: str = Field(..., description="Country name")
    description: str = Field(..., description="Regulatory requirement summary")
    national_report_name: str = Field(..., description="Specific filing or data file name")
    fee_system_name: str = Field(..., description="Fee scheme or eco-modulation mechanism")
    ppwr_applicable: bool = Field(default=False, description="Whether EU PPWR applies in addition to national EPR")
    applies_from: Optional[str] = Field(default=None, description="Enforcement date if applicable")
    legal_basis: str = Field(default="", description="Statutory instrument or EU directive")


class CountryConfig(BaseModel):
    country_code: str = Field(..., description="ISO 3166-1 alpha-2 country code")
    country_name: str = Field(..., description="Full country name")
    currency: str = Field(default="EUR", description="Local filing currency (e.g. GBP, EUR, DKK)")
    is_eu_member: bool = Field(default=True, description="Whether EU PPWR applies by default")
    regulations: List[str] = Field(default_factory=list, description="Applicable regulation codes")
    data_points_required_count: int = Field(default=0, description="Number of mandatory data points")
    active: bool = True


class DataPointDefinition(BaseModel):
    id: str = Field(..., description="Canonical ID e.g. DP01 to DP45")
    name: str = Field(..., description="Data point name")
    description: str = Field(..., description="Scope and validation requirements")
    comes_from: str = Field(..., description="Primary source (ERP, PLM, Supplier, Manual)")
    system_field_example: str = Field(default="", description="SAP / PLM field reference")
    applicable_countries: List[str] = Field(default_factory=list, description="Countries requiring this data point")
    goes_into: List[str] = Field(default_factory=list, description="Outputs (National EPR, Fee, PPWR DoC, etc.)")
    ppwr_note: Optional[str] = Field(default=None, description="PPWR specific notes")


class ComplianceMatrixRequest(BaseModel):
    sector_ids: List[str] = Field(default_factory=list, description="Selected sector IDs")
    country_codes: List[str] = Field(default_factory=list, description="Selected country codes")


class ComplianceMatrixResponse(BaseModel):
    applicable_regulations: List[RegulationConfig]
    total_data_points_required: int
    required_data_points: List[DataPointDefinition]
    source_systems_needed: List[str]
    national_reports: Dict[str, str]
    fee_systems: Dict[str, str]


class MasterDataResponse(BaseModel):
    sectors: List[SectorConfig]
    countries: List[CountryConfig]
    regulations: List[RegulationConfig]
    tariffs: List[TariffRate]
    user_roles: List[UserRoleConfig]
    data_points_total: int
