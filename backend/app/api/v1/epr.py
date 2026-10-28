"""API Router for Layer 3: Extended Producer Responsibility (EPR) Calculation Engine."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import get_current_tenant_id
from app.schemas.epr import (
    CalculationRunRequest,
    CalculationRunResponse,
    HotspotAnalyticsResponse,
    JurisdictionRuleSet,
    ScenarioSimulationRequest,
    ScenarioSimulationResponse,
)
from app.services.layer3_epr import Layer3EprService

router = APIRouter(prefix="/compliance/epr", tags=["Layer 3: EPR Compliance Module"])


@router.get("/rule-sets", response_model=List[JurisdictionRuleSet])
def list_regulatory_rule_sets() -> List[JurisdictionRuleSet]:
    """Retrieve approved, versioned regulatory fee schedules (CITEO France, LUCID Germany, etc.)."""
    return Layer3EprService.get_rule_sets()


@router.get("/rule-sets/{rule_set_id}", response_model=JurisdictionRuleSet)
def get_rule_set(rule_set_id: str) -> JurisdictionRuleSet:
    """Retrieve material tariffs, PCR discounts, and disruptor malus rules for a specific rule set."""
    rule_set = Layer3EprService.get_rule_set(rule_set_id)
    if not rule_set:
        raise HTTPException(status_code=404, detail=f"Rule set '{rule_set_id}' not found.")
    return rule_set


@router.post("/calculate", response_model=CalculationRunResponse)
def run_epr_calculation(
    request: CalculationRunRequest,
    tenant_id: str = Depends(get_current_tenant_id),
) -> CalculationRunResponse:
    """Execute a reproducible EPR fee calculation with line-item explainability and eco-modulation."""
    request.tenant_id = tenant_id
    try:
        return Layer3EprService.execute_calculation_run(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/runs", response_model=List[CalculationRunResponse])
def list_calculation_runs(
    tenant_id: str = Depends(get_current_tenant_id),
) -> List[CalculationRunResponse]:
    """Retrieve calculation run history and audit snapshots for the tenant."""
    return Layer3EprService.get_runs(tenant_id)


@router.get("/runs/{run_id}", response_model=CalculationRunResponse)
def get_calculation_run_detail(
    run_id: str,
    tenant_id: str = Depends(get_current_tenant_id),
) -> CalculationRunResponse:
    """Retrieve detailed line items, component breakdowns, tariffs, and data quality certifications for a run."""
    run = Layer3EprService.get_run_by_id(tenant_id, run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Calculation run '{run_id}' not found.")
    return run


@router.get("/hotspots", response_model=HotspotAnalyticsResponse)
def get_fee_hotspots(
    run_id: Optional[str] = Query(None, description="Specific run ID to analyze; defaults to latest"),
    tenant_id: str = Depends(get_current_tenant_id),
) -> HotspotAnalyticsResponse:
    """Retrieve high-liability materials, top fee-driving packaging components, and cost percentages."""
    return Layer3EprService.get_hotspot_analytics(tenant_id, run_id=run_id)


@router.post("/simulate-scenario", response_model=ScenarioSimulationResponse)
def simulate_what_if_scenario(
    request: ScenarioSimulationRequest,
    tenant_id: str = Depends(get_current_tenant_id),
) -> ScenarioSimulationResponse:
    """Simulate what-if scenario (e.g. bottle lightweighting or PCR % increase) showing exact EUR savings."""
    return Layer3EprService.simulate_scenario(tenant_id, request)
