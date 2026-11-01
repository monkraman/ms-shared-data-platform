"""Pydantic schemas for EU PPWR (Packaging & Packaging Waste Regulation) and DPP (Digital Product Passport)."""

from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class PPWRRecyclabilityGrade(str, Enum):
    GRADE_A = "Grade A (>=95% Recyclable)"
    GRADE_B = "Grade B (>=90% Recyclable)"
    GRADE_C = "Grade C (>=80% Recyclable)"
    GRADE_D = "Grade D (>=70% Recyclable)"
    GRADE_E = "Grade E (<70% Non-Compliant / Restricted)"


class PPWRComponentAssessment(BaseModel):
    component_id: str
    component_name: str
    material: str
    weight_grams: float
    recycled_content_pct: float
    is_separable: bool
    recyclability_rate_pct: float
    disruptor_present: bool
    compliance_notes: str


class PPWRDeclarationOfConformity(BaseModel):
    doc_reference: str = Field(..., description="Unique technical file reference, e.g. DOC-PPWR-KHC-2026-001")
    sku: str
    gtin: str
    product_name: str
    producer_legal_entity: str
    jurisdiction: str = "European Union"
    effective_ppwr_date: str = "2026-08-12 (Article 6 Technical Documentation)"
    
    # Recyclability Assessment
    overall_recyclability_pct: float
    recyclability_grade: PPWRRecyclabilityGrade
    is_compliant_for_eu_market: bool
    
    # Essential Requirements Checklist (Articles 5-11)
    heavy_metals_compliant: bool = Field(default=True, description="Total Pb, Cd, Hg, Cr(VI) < 100 ppm")
    pfas_substance_free: bool = Field(default=True, description="No intentionally added PFAS chemicals in food contact")
    packaging_minimisation_ratio_pct: float = Field(default=22.5, description="Empty space ratio (<40% limit)")
    reusable_packaging: bool = False
    
    # Lineage & Audit
    source_plm_spec: str = Field(..., description="PLM specification ID e.g. DEV-8821")
    source_sales_system: str = Field(..., description="ERP/Snowflake lineage reference")
    components_assessed: List[PPWRComponentAssessment]
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DigitalProductPassport(BaseModel):
    passport_id: str
    sku: str
    gtin: str
    product_name: str
    brand: str
    gs1_digital_link_url: str
    qr_data_carrier_payload: str
    
    # Material Passport breakdown
    total_packaging_weight_grams: float
    total_recycled_content_pct: float
    primary_polymer: str
    recyclability_grade: str
    
    # End of Life & Consumer Instructions
    disposal_instructions: List[str]
    harmonised_sorting_label: str
    
    # Traceability & Verification
    spec_source_system: str
    spec_reference_id: str
    verified_by: str = "Monkspaces Shared Data Foundation Engine"
    issued_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

