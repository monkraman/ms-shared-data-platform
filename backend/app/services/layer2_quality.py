"""Service layer for Layer 2: Data Quality, Source-of-Truth Correction Workflow, and Audit."""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4

from app.schemas.quality import (
    ApproveCorrectionRequest,
    DataQualityIssue,
    IssueSeverity,
    IssueStatus,
    ProposeCorrectionRequest,
    SourceCorrectionTicket,
    SourceWorklistExportResponse,
)
from app.services.store import data_store


class Layer2QualityService:
    """Manages data quality rule evaluation, issues queue, and source system correction tickets."""

    @staticmethod
    def get_issues(
        tenant_id: str,
        severity: Optional[IssueSeverity] = None,
        status: Optional[IssueStatus] = None,
        sku: Optional[str] = None,
    ) -> List[DataQualityIssue]:
        """Fetch filtered quality issues for a tenant."""
        with data_store._lock:
            issues = list(data_store.quality_issues.get(tenant_id, {}).values())

        if severity:
            issues = [i for i in issues if i.severity == severity]
        if status:
            issues = [i for i in issues if i.status == status]
        if sku:
            issues = [i for i in issues if i.entity_id == sku or sku in i.entity_id]

        return sorted(issues, key=lambda x: (x.severity != IssueSeverity.BLOCKER, x.id))

    @staticmethod
    def propose_correction(
        tenant_id: str,
        request: ProposeCorrectionRequest,
        actor: str = "Data Steward",
    ) -> DataQualityIssue:
        """Propose a correction for a quality issue while designating the source system for canonical update."""
        with data_store._lock:
            tenant_issues = data_store.quality_issues.get(tenant_id, {})
            issue = tenant_issues.get(request.issue_id)
            if not issue:
                raise ValueError(f"Issue {request.issue_id} not found for tenant {tenant_id}")

            issue.provisional_value = request.proposed_value
            issue.provisional_reason = f"{request.reason} (Target Source: {request.target_source_system})"
            issue.status = IssueStatus.PENDING_SOURCE_UPDATE
            issue.assigned_to = f"Compliance Lead (Pending Export to {request.target_source_system})"

            # Also create a staged source correction ticket
            ticket_id = f"TCK-KHC-{uuid4().hex[:6].upper()}"
            ticket = SourceCorrectionTicket(
                ticket_id=ticket_id,
                issue_id=issue.id,
                tenant_id=tenant_id,
                source_system=request.target_source_system,
                source_spec_reference=issue.source_spec_reference or "DEV-GENERAL",
                sku=issue.entity_id,
                field_name=issue.field_name,
                current_value=issue.current_value,
                target_value=request.proposed_value,
                reason=request.reason,
                status="READY_FOR_SOURCE_IMPORT",
            )
            if tenant_id not in data_store.correction_tickets:
                data_store.correction_tickets[tenant_id] = []
            data_store.correction_tickets[tenant_id].append(ticket)

            return issue

    @staticmethod
    def approve_correction(
        tenant_id: str,
        request: ApproveCorrectionRequest,
    ) -> DataQualityIssue:
        """Approve a provisional correction and approve dispatch to KHC source systems."""
        with data_store._lock:
            tenant_issues = data_store.quality_issues.get(tenant_id, {})
            issue = tenant_issues.get(request.issue_id)
            if not issue:
                raise ValueError(f"Issue {request.issue_id} not found for tenant {tenant_id}")

            issue.status = IssueStatus.PROVISIONALLY_APPROVED
            if request.notes:
                issue.description += f" [Approved by {request.approver_name}: {request.notes}]"

            return issue

    @staticmethod
    def export_source_worklist(tenant_id: str) -> SourceWorklistExportResponse:
        """Generate structured payload of data quality corrections for KHC source systems (Trace One & SAP)."""
        with data_store._lock:
            tickets = data_store.correction_tickets.get(tenant_id, [])

            # If empty, create standard ready tickets from any open issues for demonstration
            if not tickets:
                issues = data_store.quality_issues.get(tenant_id, {}).values()
                for idx, iss in enumerate(issues):
                    if iss.status in [IssueStatus.OPEN, IssueStatus.PENDING_SOURCE_UPDATE]:
                        t = SourceCorrectionTicket(
                            ticket_id=f"TCK-AUTO-{idx+1:03d}",
                            issue_id=iss.id,
                            tenant_id=tenant_id,
                            source_system="Trace One (Devex PLM)",
                            source_spec_reference=iss.source_spec_reference or "DEV-8821",
                            sku=iss.entity_id,
                            field_name=iss.field_name,
                            current_value=iss.current_value,
                            target_value=iss.provisional_value or "Validated Standard Reference",
                            reason=iss.suggested_source_action,
                            status="READY_FOR_SOURCE_IMPORT",
                        )
                        tickets.append(t)
                data_store.correction_tickets[tenant_id] = tickets

            return SourceWorklistExportResponse(
                tenant_id=tenant_id,
                total_tickets=len(tickets),
                export_format="JSON_REST_AND_CSV",
                target_system="Trace One PLM & SAP ERP (Single Source of Truth)",
                tickets=tickets,
                sync_instructions=(
                    "Import this payload into KHC Trace One PLM / SAP ERP S/4HANA via the Devex Integration API. "
                    "Once updated in the source system, Monkspaces delta-ingestion will re-verify the records "
                    "and mark the compliance data quality issues as RESOLVED_IN_SOURCE automatically."
                ),
            )

    @staticmethod
    def mark_resolved_in_source(tenant_id: str, issue_id: str) -> DataQualityIssue:
        """Simulate the upstream KHC source system having been corrected and synched back."""
        with data_store._lock:
            tenant_issues = data_store.quality_issues.get(tenant_id, {})
            issue = tenant_issues.get(issue_id)
            if not issue:
                raise ValueError(f"Issue {issue_id} not found for tenant {tenant_id}")

            issue.status = IssueStatus.RESOLVED_IN_SOURCE
            issue.description += " [VERIFIED: Source system synchronization completed. Single source of truth restored.]"

            # Update tenant counts
            tenant = data_store.tenants.get(tenant_id)
            if tenant and tenant.open_quality_issues_count > 0:
                tenant.open_quality_issues_count -= 1

            return issue
