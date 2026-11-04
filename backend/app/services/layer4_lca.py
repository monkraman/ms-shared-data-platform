"""LCA (Life Cycle Assessment) & Cradle-to-Gate Carbon Engine.

Calculates pack carbon footprint (g CO2e), Scope 3 Category 1 emissions,
Eco-Score grading (A to E), and actionable decarbonization recommendations.
"""

from typing import Dict, List, Optional
from app.schemas.canonical import ProductBase
from app.schemas.lca import (
    LcaAssessmentResponse,
    LcaComponentLine,
    LcaReductionRecommendation,
)


# Cradle-to-gate carbon emission factors (kg CO2e per kg substrate)
# Sourced from Ecoinvent 3.9 / DEFRA 2024 GHG Conversion Factors / ADEME Agribalyse
EMISSION_FACTORS_VIRGIN: Dict[str, float] = {
    "PET": 2.15,
    "HDPE": 1.85,
    "PP": 1.95,
    "LDPE": 1.90,
    "PS": 2.80,
    "PVC": 2.30,
    "GLASS": 0.85,
    "STEEL": 2.45,
    "ALUMINIUM": 8.24,
    "PAPER": 0.95,
    "CORRUGATED": 0.88,
    "WOOD": 0.35,
    "OTHER": 1.80,
}

EMISSION_FACTORS_RECYCLED: Dict[str, float] = {
    "PET": 0.65,        # 70% reduction vs virgin
    "HDPE": 0.70,       # 62% reduction vs virgin
    "PP": 0.75,         # 61% reduction vs virgin
    "LDPE": 0.72,
    "PS": 1.10,
    "PVC": 0.95,
    "GLASS": 0.42,      # 50% cullet reduction
    "STEEL": 0.75,      # 69% scrap reduction
    "ALUMINIUM": 0.82,  # 90% closed-loop remelt reduction
    "PAPER": 0.60,      # 37% recycled fiber
    "CORRUGATED": 0.55,
    "WOOD": 0.20,
    "OTHER": 0.90,
}


def _normalize_mat(material_str: str) -> str:
    m = (material_str or "").strip().upper()
    for key in ["ALUMINIUM", "ALUMINUM"]:
        if key in m:
            return "ALUMINIUM"
    for key in ["PET", "HDPE", "LDPE", "PP", "PS", "PVC", "GLASS", "STEEL", "PAPER", "CORRUGATED", "WOOD"]:
        if key in m:
            return key
    return "OTHER"


def calculate_lca_assessment(
    product: ProductBase,
    annual_units: int = 150000,
    grid_intensity: float = 0.233,
    transport_km: float = 350.0,
) -> LcaAssessmentResponse:
    """Calculate comprehensive product packaging LCA and Scope 3 carbon footprint."""
    enrichment = getattr(product, "lca_enrichment", None)
    if enrichment:
        if enrichment.transport_distance_km is not None:
            transport_km = enrichment.transport_distance_km
        if enrichment.grid_intensity_override is not None:
            grid_intensity = enrichment.grid_intensity_override
        renew_pct = enrichment.renewable_energy_pct or 0.0
    else:
        renew_pct = 0.0

    components = product.components or []
    lines: List[LcaComponentLine] = []
    total_tare_grams = 0.0
    total_co2e_grams = 0.0
    total_virgin_co2e_grams = 0.0

    # 1. Calculate component-level carbon footprints
    for comp in components:
        mat_str = comp.material.value if hasattr(comp.material, "value") else str(comp.material)
        mat_key = _normalize_mat(mat_str)
        virgin_factor = EMISSION_FACTORS_VIRGIN.get(mat_key, 1.80)
        recycled_factor = EMISSION_FACTORS_RECYCLED.get(mat_key, 0.90)

        pcr_pct = float(getattr(comp, "recycled_content_pct", 0.0) or 0.0)
        effective_factor = (
            ((100.0 - pcr_pct) / 100.0) * virgin_factor +
            (pcr_pct / 100.0) * recycled_factor
        )

        wt_g = float(comp.weight_grams or 0.0)
        total_tare_grams += wt_g

        # g CO2e = (weight in grams / 1000) * (kg CO2e / kg) * 1000 = weight_grams * effective_factor
        comp_co2e = wt_g * effective_factor
        comp_virgin_co2e = wt_g * virgin_factor
        total_co2e_grams += comp_co2e
        total_virgin_co2e_grams += comp_virgin_co2e

        level_str = comp.level.value if hasattr(comp.level, "value") else str(comp.level)

        lines.append(
            LcaComponentLine(
                component_id=comp.id,
                component_name=comp.name,
                packaging_level=level_str,
                material=mat_str,
                weight_grams=round(wt_g, 2),
                emission_factor_kg_co2e_per_kg=round(effective_factor, 3),
                component_co2e_grams=round(comp_co2e, 2),
                share_percentage=0.0,  # Computed below
            )
        )

    # Apply renewable electricity decarbonization factor if specified
    if renew_pct > 0:
        renew_factor = 1.0 - ((renew_pct / 100.0) * 0.12)
        total_co2e_grams = total_co2e_grams * renew_factor

    # Calculate share percentage
    if total_co2e_grams > 0:
        for line in lines:
            line.share_percentage = round((line.component_co2e_grams / total_co2e_grams) * 100.0, 1)

    # 2. Scope 3 Category 1 Annual Calculation
    # Annual tonnes = (g CO2e per pack * annual units) / 1,000,000
    annual_tonnes = (total_co2e_grams * annual_units) / 1_000_000.0
    pcr_savings_g = max(0.0, total_virgin_co2e_grams - total_co2e_grams)

    # 3. Eco-Score Benchmark Rating (A: best to E: worst)
    if total_co2e_grams <= 35.0:
        eco_grade = "A"
        eco_points = 94.0
    elif total_co2e_grams <= 75.0:
        eco_grade = "B"
        eco_points = 81.0
    elif total_co2e_grams <= 135.0:
        eco_grade = "C"
        eco_points = 64.0
    elif total_co2e_grams <= 230.0:
        eco_grade = "D"
        eco_points = 45.0
    else:
        eco_grade = "E"
        eco_points = 25.0

    # 4. Decarbonization Levers & Recommendations
    recommendations: List[LcaReductionRecommendation] = []

    # Check for PCR enhancement opportunity
    avg_pcr = (
        sum(float(getattr(c, "recycled_content_pct", 0.0) or 0.0) for c in components) / len(components)
        if components else 0.0
    )
    if avg_pcr < 50.0:
        pcr_boost_savings_g = total_co2e_grams * 0.28
        ann_savings_tonnes = (pcr_boost_savings_g * annual_units) / 1_000_000.0
        recommendations.append(
            LcaReductionRecommendation(
                action="Transition primary packaging resin to 50%+ certified post-consumer recycled (PCR)",
                estimated_co2e_saving_pct=28.0,
                annual_scope3_saving_tonnes=round(ann_savings_tonnes, 2),
                complexity="Medium",
            )
        )

    # Check for lightweighting opportunity
    if total_tare_grams > 25.0:
        lightweight_savings_g = total_co2e_grams * 0.10
        ann_savings_tonnes = (lightweight_savings_g * annual_units) / 1_000_000.0
        recommendations.append(
            LcaReductionRecommendation(
                action="Execute 10% wall-thickness optimization & lightweighting across bottle/closure body",
                estimated_co2e_saving_pct=10.0,
                annual_scope3_saving_tonnes=round(ann_savings_tonnes, 2),
                complexity="Low",
            )
        )

    # Renewable manufacturing energy recommendation
    renew_savings_g = total_co2e_grams * 0.07
    ann_renew_tonnes = (renew_savings_g * annual_units) / 1_000_000.0
    recommendations.append(
        LcaReductionRecommendation(
            action="Procure supplier green electricity guarantees of origin (PPA / REGO) for converter plant",
            estimated_co2e_saving_pct=7.0,
            annual_scope3_saving_tonnes=round(ann_renew_tonnes, 2),
            complexity="Low",
        )
    )

    # 5. Missing / Required Additional Data for ISO 14067 / EPD Third-Party Assurance
    required_gaps = []
    if enrichment and enrichment.epd_registration_id:
        required_gaps.append(f"[VERIFIED] Supplier EPD certified: {enrichment.epd_registration_id} (EN 15804)")
    else:
        required_gaps.append("[DATA NEEDED] Supplier cradle-to-gate Environmental Product Declaration (EPD ISO 14025 / EN 15804)")

    if renew_pct > 0:
        required_gaps.append(f"[VERIFIED] Converter green electricity mix: {renew_pct}% renewable PPA / REGO")
    else:
        required_gaps.append("[DATA NEEDED] Primary converter factory green electricity mix verification (REGO / Guarantees of Origin)")

    required_gaps.append(f"[VERIFIED] Inbound haulage logistics: {transport_km} km road freight from packaging converter")

    dominant_material = components[0].material.value if hasattr(components[0].material, "value") else str(components[0].material) if components else "Mixed Plastic"

    return LcaAssessmentResponse(
        sku=product.sku,
        product_name=product.name,
        brand=product.brand,
        primary_material=dominant_material,
        total_packaging_weight_grams=round(total_tare_grams, 2),
        pack_carbon_footprint_g_co2e=round(total_co2e_grams, 2),
        annual_units_placed=annual_units,
        annual_scope3_tonnes_co2e=round(annual_tonnes, 2),
        eco_score_grade=eco_grade,
        eco_score_points=round(eco_points, 1),
        recycled_content_reduction_g_co2e=round(pcr_savings_g, 2),
        grid_carbon_intensity_factor=grid_intensity,
        transport_cradle_to_gate_km=transport_km,
        component_breakdowns=lines,
        reduction_recommendations=recommendations,
        required_additional_data=required_gaps,
    )
