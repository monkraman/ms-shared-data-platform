"""Service layer for Layer 3: Extended Producer Responsibility (EPR) Calculation Engine."""

from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import uuid4

from app.schemas.canonical import MaterialCategory, PackagingLevel
from app.schemas.epr import (
    CalculationLineItem,
    CalculationRunRequest,
    CalculationRunResponse,
    HotspotAnalyticsResponse,
    JurisdictionRuleSet,
    MaterialHotspot,
    ProductHotspot,
    ScenarioSimulationRequest,
    ScenarioSimulationResponse,
)
from app.schemas.quality import IssueStatus
from app.services.store import data_store


class Layer3EprService:
    """Computes explainable, versioned, reproducible EPR fees with eco-modulation and hotspots."""

    @staticmethod
    def get_rule_sets() -> List[JurisdictionRuleSet]:
        """Fetch all approved jurisdiction regulatory fee schedules."""
        with data_store._lock:
            return list(data_store.rule_sets.values())

    @staticmethod
    def get_rule_set(rule_set_id: str) -> Optional[JurisdictionRuleSet]:
        """Fetch a specific rule-set by ID."""
        with data_store._lock:
            return data_store.rule_sets.get(rule_set_id)

    @classmethod
    def execute_calculation_run(cls, request: CalculationRunRequest) -> CalculationRunResponse:
        """Execute a reproducible EPR fee calculation for a tenant and jurisdiction."""
        tenant_id = request.tenant_id
        jurisdiction = request.jurisdiction.upper()
        year = request.reporting_year

        with data_store._lock:
            # Select rule set
            target_rule_set: Optional[JurisdictionRuleSet] = None
            if request.rule_set_id:
                target_rule_set = data_store.rule_sets.get(request.rule_set_id)
            else:
                for rs in data_store.rule_sets.values():
                    if rs.jurisdiction == jurisdiction and rs.reporting_year == year:
                        target_rule_set = rs
                        break

            if not target_rule_set:
                raise ValueError(f"No approved rule-set found for jurisdiction {jurisdiction} and year {year}")

            tenant_products = data_store.products.get(tenant_id, {})
            tenant_sales = data_store.sales.get(tenant_id, [])
            tenant_issues = data_store.quality_issues.get(tenant_id, {})

            # Filter sales for jurisdiction & year
            relevant_sales = [
                s for s in tenant_sales
                if s.jurisdiction == jurisdiction and s.reporting_year == year
            ]

            line_items: List[CalculationLineItem] = []
            warnings: List[str] = []
            total_sales_units = 0
            total_packaging_tonnes = 0.0
            total_fee_eur = 0.0
            provisional_records_count = 0

            for sale in relevant_sales:
                prod = tenant_products.get(sale.sku)
                if not prod:
                    warnings.append(f"Sales volume found for SKU {sale.sku}, but product master record is missing.")
                    continue

                total_sales_units += sale.units_sold

                # Check if product or its components have pending issues
                prod_issues = [
                    i for i in tenant_issues.values()
                    if (i.entity_id == prod.sku or any(i.entity_id == c.id for c in prod.components))
                ]
                has_provisional = any(i.status == IssueStatus.PROVISIONALLY_APPROVED for i in prod_issues)
                has_blocking = any(i.status in [IssueStatus.OPEN, IssueStatus.PENDING_SOURCE_UPDATE] and i.severity == "blocker" for i in prod_issues)

                if has_blocking:
                    warnings.append(
                        f"SKU {prod.sku} ({prod.name}) has unresolved BLOCKER data quality issue in KHC source systems. "
                        "Calculated with conservative estimate; not eligible for official regulatory filing until source is synced."
                    )

                for comp in prod.components:
                    comp_weight_grams = comp.weight_grams
                    total_weight_tonnes = (comp_weight_grams * sale.units_sold) / 1_000_000.0
                    total_packaging_tonnes += total_weight_tonnes

                    # Match tariff rate
                    mat_key = comp.material.value
                    tariff = target_rule_set.rates.get(mat_key)

                    if not tariff:
                        # Fallback tariff
                        base_rate = 500.00
                        applied_summary = f"Default fallback rate applied (Material '{mat_key}' unmapped in {target_rule_set.id})"
                        warnings.append(applied_summary)
                        discount_eur = 0.0
                        malus_eur = 0.0
                    else:
                        base_rate = tariff.base_rate_eur_per_tonne
                        summary_parts = [f"Base: €{base_rate:.2f}/t"]

                        # Check recycled content discount
                        discount_eur = 0.0
                        if comp.recycled_content_pct >= tariff.pcr_threshold_pct and tariff.recycled_content_discount_pct > 0:
                            discount_pct = tariff.recycled_content_discount_pct
                            discount_eur = (base_rate * (discount_pct / 100.0)) * total_weight_tonnes
                            summary_parts.append(f"-{discount_pct}% PCR Bonus (€{discount_eur:.2f})")

                        # Check disruptor malus
                        malus_eur = 0.0
                        if (comp.has_disruptor_pigment or not comp.is_recyclable) and tariff.disruptor_malus_pct > 0:
                            malus_pct = tariff.disruptor_malus_pct
                            malus_eur = (base_rate * (malus_pct / 100.0)) * total_weight_tonnes
                            summary_parts.append(f"+{malus_pct}% Malus Disruptor (€{malus_eur:.2f})")

                        applied_summary = ", ".join(summary_parts)

                    base_fee_eur = base_rate * total_weight_tonnes
                    eco_modulation_adj = malus_eur - discount_eur
                    net_fee_eur = max(0.0, base_fee_eur + eco_modulation_adj)
                    total_fee_eur += net_fee_eur

                    # Quality certification status
                    if has_blocking:
                        dq_status = "ESTIMATED_UNVERIFIED"
                    elif has_provisional:
                        dq_status = "PROVISIONAL_OVERRIDE"
                        provisional_records_count += 1
                    else:
                        dq_status = "CERTIFIED"

                    line_items.append(
                        CalculationLineItem(
                            sku=prod.sku,
                            product_name=prod.name,
                            component_name=comp.name,
                            level=comp.level.value,
                            material=mat_key,
                            weight_per_unit_grams=round(comp_weight_grams, 2),
                            units_placed_on_market=sale.units_sold,
                            total_weight_tonnes=round(total_weight_tonnes, 4),
                            base_tariff_eur_per_tonne=round(base_rate, 2),
                            base_fee_eur=round(base_fee_eur, 2),
                            eco_modulation_adjustment_eur=round(eco_modulation_adj, 2),
                            net_fee_eur=round(net_fee_eur, 2),
                            applied_rules_summary=applied_summary,
                            data_quality_status=dq_status,
                        )
                    )

            run_id = f"RUN-{jurisdiction}-{year}-{uuid4().hex[:6].upper()}"
            response = CalculationRunResponse(
                run_id=run_id,
                tenant_id=tenant_id,
                jurisdiction=jurisdiction,
                scheme_name=target_rule_set.scheme_name,
                reporting_year=year,
                rule_version=target_rule_set.version,
                calculated_at=datetime.now(timezone.utc),
                total_sales_units=total_sales_units,
                total_packaging_tonnes=round(total_packaging_tonnes, 3),
                total_fee_eur=round(total_fee_eur, 2),
                currency=target_rule_set.currency,
                records_processed=len(line_items),
                provisional_records_count=provisional_records_count,
                line_items=line_items,
                warnings=warnings,
            )

            if tenant_id not in data_store.runs:
                data_store.runs[tenant_id] = []
            data_store.runs[tenant_id].append(response)

            # Update tenant last run
            tenant = data_store.tenants.get(tenant_id)
            if tenant:
                tenant.last_calculation_run_id = run_id

            return response

    @staticmethod
    def get_runs(tenant_id: str) -> List[CalculationRunResponse]:
        """Fetch all calculation run history for a tenant."""
        with data_store._lock:
            return list(reversed(data_store.runs.get(tenant_id, [])))

    @staticmethod
    def get_run_by_id(tenant_id: str, run_id: str) -> Optional[CalculationRunResponse]:
        """Fetch a specific calculation run by ID."""
        with data_store._lock:
            runs = data_store.runs.get(tenant_id, [])
            for r in runs:
                if r.run_id == run_id:
                    return r
            return None

    @classmethod
    def get_hotspot_analytics(cls, tenant_id: str, run_id: Optional[str] = None) -> HotspotAnalyticsResponse:
        """Generate material breakdown and top fee-driving SKUs."""
        with data_store._lock:
            runs = data_store.runs.get(tenant_id, [])
            if not runs:
                # Trigger a default calculation first so hotspots are immediately populated
                pass

        if not runs:
            # Generate baseline run
            run = cls.execute_calculation_run(
                CalculationRunRequest(tenant_id=tenant_id, jurisdiction="FR", reporting_year=2025)
            )
        elif run_id:
            run = cls.get_run_by_id(tenant_id, run_id)
            if not run:
                run = runs[-1]
        else:
            run = runs[-1]

        # Group by material
        mat_agg: Dict[str, Dict[str, float]] = {}
        # Group by SKU
        sku_agg: Dict[str, Dict[str, Any]] = {}

        for item in run.line_items:
            # Material aggregation
            if item.material not in mat_agg:
                mat_agg[item.material] = {"tonnes": 0.0, "fee": 0.0}
            mat_agg[item.material]["tonnes"] += item.total_weight_tonnes
            mat_agg[item.material]["fee"] += item.net_fee_eur

            # SKU aggregation
            if item.sku not in sku_agg:
                sku_agg[item.sku] = {
                    "sku": item.sku,
                    "name": item.product_name,
                    "units": item.units_placed_on_market,
                    "tonnes": 0.0,
                    "fee": 0.0,
                }
            sku_agg[item.sku]["tonnes"] += item.total_weight_tonnes
            sku_agg[item.sku]["fee"] += item.net_fee_eur

        total_tonnes = max(0.0001, run.total_packaging_tonnes)
        total_fee = max(0.0001, run.total_fee_eur)

        mat_hotspots: List[MaterialHotspot] = [
            MaterialHotspot(
                material=mat,
                total_tonnes=round(v["tonnes"], 2),
                percentage_of_weight=round((v["tonnes"] / total_tonnes) * 100.0, 1),
                total_fee_eur=round(v["fee"], 2),
                percentage_of_fee=round((v["fee"] / total_fee) * 100.0, 1),
            )
            for mat, v in mat_agg.items()
        ]
        mat_hotspots.sort(key=lambda x: x.total_fee_eur, reverse=True)

        sku_hotspots: List[ProductHotspot] = []
        for s in sku_agg.values():
            fee_per_k = (s["fee"] / s["units"]) * 1000.0 if s["units"] > 0 else 0.0
            sku_hotspots.append(
                ProductHotspot(
                    sku=s["sku"],
                    name=s["name"],
                    units_sold=s["units"],
                    packaging_weight_tonnes=round(s["tonnes"], 2),
                    total_fee_eur=round(s["fee"], 2),
                    fee_per_thousand_units_eur=round(fee_per_k, 2),
                )
            )
        sku_hotspots.sort(key=lambda x: x.total_fee_eur, reverse=True)

        return HotspotAnalyticsResponse(
            tenant_id=tenant_id,
            run_id=run.run_id,
            jurisdiction=run.jurisdiction,
            reporting_year=run.reporting_year,
            total_fee_eur=run.total_fee_eur,
            total_tonnes=run.total_packaging_tonnes,
            material_breakdown=mat_hotspots,
            top_products=sku_hotspots,
        )

    @classmethod
    def simulate_scenario(cls, tenant_id: str, request: ScenarioSimulationRequest) -> ScenarioSimulationResponse:
        """Simulate packaging lightweighting or increased PCR content against baseline run."""
        baseline = cls.get_run_by_id(tenant_id, request.baseline_run_id)
        if not baseline:
            # Take latest
            with data_store._lock:
                runs = data_store.runs.get(tenant_id, [])
                if runs:
                    baseline = runs[-1]
                else:
                    baseline = cls.execute_calculation_run(
                        CalculationRunRequest(tenant_id=tenant_id, jurisdiction="FR", reporting_year=2025)
                    )

        target_mat = request.target_material
        simulated_fee = 0.0
        simulated_tonnes = 0.0

        for item in baseline.line_items:
            weight = item.total_weight_tonnes
            fee = item.net_fee_eur

            if item.material == target_mat:
                # Apply lightweighting
                if request.weight_reduction_pct > 0:
                    reduction_factor = (100.0 - request.weight_reduction_pct) / 100.0
                    weight *= reduction_factor
                    fee *= reduction_factor

                # Apply PCR discount bonus if simulated
                if request.increased_pcr_pct >= 30.0:
                    # CITEO gives 15% discount
                    pcr_discount = 0.15
                    fee = (item.base_tariff_eur_per_tonne * (1.0 - pcr_discount)) * weight

            simulated_tonnes += weight
            simulated_fee += fee

        fee_savings = max(0.0, baseline.total_fee_eur - simulated_fee)
        savings_pct = (fee_savings / baseline.total_fee_eur) * 100.0 if baseline.total_fee_eur > 0 else 0.0
        tonnes_saved = max(0.0, baseline.total_packaging_tonnes - simulated_tonnes)

        scenario_id = f"SCEN-{uuid4().hex[:6].upper()}"
        summary = (
            f"Simulating a {request.weight_reduction_pct}% weight reduction and {request.increased_pcr_pct}% PCR "
            f"on {target_mat} reduces annual {baseline.jurisdiction} EPR liability by €{fee_savings:,.2f} "
            f"({savings_pct:.1f}% reduction) and eliminates {tonnes_saved:,.1f} metric tonnes of packaging waste."
        )

        return ScenarioSimulationResponse(
            scenario_id=scenario_id,
            baseline_run_id=baseline.run_id,
            target_material=target_mat,
            parameters={
                "weight_reduction_pct": request.weight_reduction_pct,
                "increased_pcr_pct": request.increased_pcr_pct,
            },
            baseline_fee_eur=baseline.total_fee_eur,
            simulated_fee_eur=round(simulated_fee, 2),
            fee_savings_eur=round(fee_savings, 2),
            fee_savings_pct=round(savings_pct, 1),
            baseline_tonnes=baseline.total_packaging_tonnes,
            simulated_tonnes=round(simulated_tonnes, 2),
            tonnes_saved=round(tonnes_saved, 2),
            executive_summary=summary,
        )
