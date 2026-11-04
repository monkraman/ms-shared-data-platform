"""Pydantic Schemas for LCA (Life Cycle Assessment) & Carbon Footprint Module."""

from typing import List, Optional
from pydantic import BaseModel, Field


class LcaComponentLine(BaseModel):
    component_id: str = Field(..., description="Unique component identifier")
    component_name: str = Field(..., description="Packaging item name (e.g. Bottle Body, Cap)")
    packaging_level: str = Field(..., description="Primary, Secondary, Tertiary")
    material: str = Field(..., description="Canonical polymer / substrate material")
    weight_grams: float = Field(..., description="Component tare weight in grams")
    emission_factor_kg_co2e_per_kg: float = Field(
        ..., 
        description="Ecoinvent/DEFRA cradle-to-gate carbon intensity (kg CO2e per kg resin/material)"
    )
    component_co2e_grams: float = Field(
        ..., 
        description="Total calculated cradle-to-gate CO2e in grams for this component"
    )
    share_percentage: float = Field(
        ..., 
        description="Proportion of total packaging footprint contributed by this component"
    )


class LcaReductionRecommendation(BaseModel):
    action: str = Field(..., description="Intervention action description")
    estimated_co2e_saving_pct: float = Field(..., description="Estimated % CO2e reduction")
    annual_scope3_saving_tonnes: float = Field(..., description="Estimated annual metric tonnes CO2e avoided")
    complexity: str = Field(..., description="Low, Medium, High")


class LcaAssessmentResponse(BaseModel):
    sku: str = Field(..., description="Canonical Product SKU")
    product_name: str = Field(..., description="Consumer Product Name")
    brand: str = Field(..., description="Brand Identifier")
    primary_material: str = Field(..., description="Dominant packaging substrate")
    total_packaging_weight_grams: float = Field(..., description="Sum of all packaging components tare weight (g)")
    pack_carbon_footprint_g_co2e: float = Field(
        ..., 
        description="Cradle-to-gate carbon footprint per single consumer pack (g CO2e)"
    )
    annual_units_placed: int = Field(
        ..., 
        description="Annual units sold / placed on market across all jurisdictions"
    )
    annual_scope3_tonnes_co2e: float = Field(
        ..., 
        description="Annual Scope 3 Category 1 (Purchased Goods) packaging emissions in metric tonnes CO2e"
    )
    eco_score_grade: str = Field(..., description="Eco-Score Grade from A (Best) to E (Worst)")
    eco_score_points: float = Field(..., description="Eco-Score benchmark points (0-100 scale)")
    recycled_content_reduction_g_co2e: float = Field(
        default=0.0,
        description="Grams CO2e saved per pack due to post-consumer recycled (PCR) content substitution"
    )
    grid_carbon_intensity_factor: float = Field(
        default=0.233,
        description="Country manufacturing electricity grid intensity (kg CO2e/kWh)"
    )
    transport_cradle_to_gate_km: float = Field(
        default=350.0,
        description="Estimated supplier-to-filler haulage transport distance (km)"
    )
    component_breakdowns: List[LcaComponentLine] = Field(
        default_factory=list,
        description="Component-by-component carbon footprint breakdown"
    )
    reduction_recommendations: List[LcaReductionRecommendation] = Field(
        default_factory=list,
        description="Prioritized decarbonization levers"
    )
    required_additional_data: List[str] = Field(
        default_factory=list,
        description="Module-specific data gaps required to certify ISO 14067 / EPD declaration"
    )

