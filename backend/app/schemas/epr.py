"""Pydantic schemas for Layer 3: Extended Producer Responsibility (EPR) Module."""

from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class TariffRate(BaseModel):
    material: str
    base_rate_eur_per_tonne: float = Field(..., description="Base fee in EUR per metric tonne")
    description: str
    recycled_content_discount_pct: float = Field(default=0.0, description="Discount % if minimum PCR content met")
    pcr_threshold_pct: float = Field(default=30.0, description="Minimum PCR % required for discount")
    disruptor_malus_pct: float = Field(default=0.0, description="Penalty % for disruptors like carbon black or PVC")


class JurisdictionRuleSet(BaseModel):
    id: str = Field(..., description="E.g. FR-CITEO-2025")
    jurisdiction: str = Field(..., description="Country Code: FR, DE, UK")
    scheme_name: str = Field(..., description="CITEO (France), ZSVR/LUCID (Germany), DEFRA pEPR (UK)")
    reporting_year: int
    version: str = Field(default="1.0.0-approved", description="Immutable rule-set version")
    currency: str = "EUR"
    effective_from: str
    effective_to: str
    rates: Dict[str, TariffRate] = Field(..., description="Tariffs keyed by canonical MaterialCategory")


class CalculationLineItem(BaseModel):
    sku: str
    product_name: str
    component_name: str
    level: str
    material: str
    weight_per_unit_grams: float
    units_placed_on_market: int
    total_weight_tonnes: float
    base_tariff_eur_per_tonne: float
    base_fee_eur: float
    eco_modulation_adjustment_eur: float
    net_fee_eur: float
    applied_rules_summary: str
    data_quality_status: str = Field(default="CERTIFIED", description="CERTIFIED, PROVISIONAL_OVERRIDE, ESTIMATED")


class CalculationRunRequest(BaseModel):
    tenant_id: str
    jurisdiction: str = Field(default="FR", description="Country code, e.g. FR, DE, UK")
    reporting_year: int = Field(default=2025)
    rule_set_id: Optional[str] = None
    include_provisional_corrections: bool = Field(
        default=True,
        description="Include records with provisional steward approvals for what-if visibility"
    )
    notes: Optional[str] = None


class CalculationRunResponse(BaseModel):
    run_id: str
    tenant_id: str
    jurisdiction: str
    scheme_name: str
    reporting_year: int
    rule_version: str
    calculated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    total_sales_units: int
    total_packaging_tonnes: float
    total_fee_eur: float
    currency: str = "EUR"
    records_processed: int
    provisional_records_count: int
    line_items: List[CalculationLineItem]
    warnings: List[str] = Field(default_factory=list)


class MaterialHotspot(BaseModel):
    material: str
    total_tonnes: float
    percentage_of_weight: float
    total_fee_eur: float
    percentage_of_fee: float


class ProductHotspot(BaseModel):
    sku: str
    name: str
    units_sold: int
    packaging_weight_tonnes: float
    total_fee_eur: float
    fee_per_thousand_units_eur: float


class HotspotAnalyticsResponse(BaseModel):
    tenant_id: str
    run_id: str
    jurisdiction: str
    reporting_year: int
    total_fee_eur: float
    total_tonnes: float
    material_breakdown: List[MaterialHotspot]
    top_products: List[ProductHotspot]


class ScenarioSimulationRequest(BaseModel):
    baseline_run_id: str
    target_material: str = Field(..., description="E.g. PET (Clear / Light Blue)")
    weight_reduction_pct: float = Field(default=0.0, ge=0.0, le=50.0, description="Lightweighting simulation %")
    increased_pcr_pct: float = Field(default=0.0, ge=0.0, le=100.0, description="Target PCR % (e.g. increase to 50%)")
    notes: Optional[str] = None


class ScenarioSimulationResponse(BaseModel):
    scenario_id: str
    baseline_run_id: str
    target_material: str
    parameters: Dict[str, float]
    baseline_fee_eur: float
    simulated_fee_eur: float
    fee_savings_eur: float
    fee_savings_pct: float
    baseline_tonnes: float
    simulated_tonnes: float
    tonnes_saved: float
    executive_summary: str
