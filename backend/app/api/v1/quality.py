"""API Router for Layer 2: Data Quality, Source-of-Truth Correction Workflow, and Audit."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import get_current_tenant_id
from app.schemas.quality import (
    ApproveCorrectionRequest,
    DataQualityIssue,
    IssueSeverity,
    IssueStatus,
    ProposeCorrectionRequest,
    SourceWorklistExportResponse,
)
from app.services.layer2_quality import Layer2QualityService

router = APIRouter(prefix="/quality", tags=["Layer 2: Data Quality & Source-of-Truth Workflow"])


@router.get("/issues", response_model=List[DataQualityIssue])
def list_quality_issues(
    severity: Optional[IssueSeverity] = Query(None, description="Filter by issue severity"),
    status: Optional[IssueStatus] = Query(None, description="Filter by resolution status"),
    sku: Optional[str] = Query(None, description="Filter by product SKU"),
    tenant_id: str = Depends(get_current_tenant_id),
) -> List[DataQualityIssue]:
    """Retrieve data quality issues queue, blocking compliance gaps, and source system action items."""
    return Layer2QualityService.get_issues(tenant_id, severity=severity, status=status, sku=sku)


@router.post("/propose-correction", response_model=DataQualityIssue)
def propose_data_correction(
    request: ProposeCorrectionRequest,
    tenant_id: str = Depends(get_current_tenant_id),
) -> DataQualityIssue:
    """Propose a correction for a quality issue while designating the source system (e.g. Trace One) as single source of truth."""
    try:
        return Layer2QualityService.propose_correction(tenant_id, request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/approve-correction", response_model=DataQualityIssue)
def approve_provisional_correction(
    request: ApproveCorrectionRequest,
    tenant_id: str = Depends(get_current_tenant_id),
) -> DataQualityIssue:
    """Approve a provisional correction and approve dispatch of correction ticket to KHC source systems."""
    try:
        return Layer2QualityService.approve_correction(tenant_id, request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/source-worklist/export", response_model=SourceWorklistExportResponse)
def export_source_system_worklist(
    tenant_id: str = Depends(get_current_tenant_id),
) -> SourceWorklistExportResponse:
    """Export structured correction payload for KHC Trace One PLM & SAP ERP to maintain single source of truth."""
    return Layer2QualityService.export_source_worklist(tenant_id)


@router.post("/issues/{issue_id}/resolve-in-source", response_model=DataQualityIssue)
def mark_issue_resolved_in_source(
    issue_id: str,
    tenant_id: str = Depends(get_current_tenant_id),
) -> DataQualityIssue:
    """Verify that KHC source systems have updated the master record and mark issue as resolved."""
    try:
        return Layer2QualityService.mark_resolved_in_source(tenant_id, issue_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
