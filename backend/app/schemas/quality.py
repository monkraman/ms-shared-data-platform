"""Pydantic schemas for Layer 2: Data Quality, Source-of-Truth Correction Workflow, and Audit."""

from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class IssueSeverity(str, Enum):
    BLOCKER = "blocker"    # Prevents official regulatory submission; excluded or estimated with penalty
    WARNING = "warning"    # Sub-optimal (e.g. default rate applied due to missing PCR verification certificate)
    INFO = "info"          # Best-practice advisory


class IssueStatus(str, Enum):
    OPEN = "open"                                    # Detected, awaiting action
    PENDING_SOURCE_UPDATE = "pending_source_update"  # Correction dispatched to KHC source system (Trace One / ERP)
    PROVISIONALLY_APPROVED = "provisionally_approved"# Approved for internal simulation only; flagged in reports
    RESOLVED_IN_SOURCE = "resolved_in_source"        # Synced back from source system; verified & closed
    DISMISSED = "dismissed"                          # False positive or exempted by compliance officer


class DataQualityIssue(BaseModel):
    id: str = Field(..., description="Unique issue code, e.g. DQI-1002")
    tenant_id: str
    rule_code: str = Field(..., description="Rule code, e.g. RULE-MISSING-WEIGHT, RULE-POLYMER-UNMAPPED")
    rule_title: str
    severity: IssueSeverity
    entity_type: str = Field(..., description="Product, PackagingComponent, SalesVolume")
    entity_id: str = Field(..., description="SKU or Component ID")
    field_name: str
    current_value: Optional[str] = None
    description: str
    suggested_source_action: str = Field(
        ...,
        description="Explicit instructions for KHC source systems (Trace One PLM / SAP ERP) to maintain single source of truth"
    )
    source_spec_reference: Optional[str] = Field(None, description="E.g. Trace One Devex Specification ID #DEV-9410")
    status: IssueStatus = IssueStatus.OPEN
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    assigned_to: Optional[str] = None
    provisional_value: Optional[str] = None
    provisional_reason: Optional[str] = None


class ProposeCorrectionRequest(BaseModel):
    issue_id: str
    proposed_value: str = Field(..., description="The value that should be updated")
    reason: str = Field(..., description="Business rationale or evidence document reference")
    target_source_system: str = Field(default="Trace One (Devex PLM)", description="Source system to update")
    apply_provisional_override: bool = Field(
        default=True,
        description="If True, allows running what-if compliance calculations while waiting for KHC source system sync"
    )


class ApproveCorrectionRequest(BaseModel):
    issue_id: str
    approver_name: str
    notes: Optional[str] = None
    export_to_source_worklist: bool = True


class SourceCorrectionTicket(BaseModel):
    ticket_id: str
    issue_id: str
    tenant_id: str
    source_system: str
    source_spec_reference: str
    sku: str
    field_name: str
    current_value: Optional[str]
    target_value: str
    reason: str
    status: str = Field(default="READY_FOR_SOURCE_IMPORT")
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SourceWorklistExportResponse(BaseModel):
    tenant_id: str
    total_tickets: int
    export_format: str = "JSON_REST_AND_CSV"
    target_system: str = "Trace One PLM & SAP ERP"
    tickets: List[SourceCorrectionTicket]
    sync_instructions: str
