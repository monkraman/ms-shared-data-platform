"""Unit and integration tests for Layer 2: Data Quality & Source-of-Truth Workflow."""

from fastapi.testclient import TestClient


def test_list_quality_issues(client: TestClient) -> None:
    """Test retrieving quality issues queue for KHC Europe."""
    response = client.get("/api/v1/quality/issues", headers={"X-Tenant-ID": "khc-europe"})
    assert response.status_code == 200
    issues = response.json()
    assert len(issues) >= 3

    # Check that blocker or warning issues exist
    severities = [i["severity"] for i in issues]
    assert "warning" in severities or "blocker" in severities


def test_propose_and_approve_correction_workflow(client: TestClient) -> None:
    """Test full cycle: propose correction -> verify target source system -> approve provisional."""
    # 1. Propose correction with target source system Trace One (Devex PLM)
    propose_payload = {
        "issue_id": "DQI-KHC-001",
        "proposed_value": "30.0% (Certified per Certificate #CERT-PET-2025)",
        "reason": "Supplier ALPLA confirmed certificate attached in vendor portal.",
        "target_source_system": "Trace One (Devex PLM)",
        "apply_provisional_override": True
    }
    response = client.post(
        "/api/v1/quality/propose-correction",
        json=propose_payload,
        headers={"X-Tenant-ID": "khc-europe"}
    )
    assert response.status_code == 200
    issue = response.json()
    assert issue["status"] == "pending_source_update"
    assert issue["provisional_value"] == propose_payload["proposed_value"]

    # 2. Approve provisional correction
    approve_payload = {
        "issue_id": "DQI-KHC-001",
        "approver_name": "Senior Compliance Officer",
        "notes": "Approved for 2025 provisional reporting while source ticket dispatches to Trace One.",
        "export_to_source_worklist": True
    }
    appr_res = client.post(
        "/api/v1/quality/approve-correction",
        json=approve_payload,
        headers={"X-Tenant-ID": "khc-europe"}
    )
    assert appr_res.status_code == 200
    updated_issue = appr_res.json()
    assert updated_issue["status"] == "provisionally_approved"


def test_export_source_system_worklist(client: TestClient) -> None:
    """Test exporting structured source system correction payload for KHC ERP & Trace One."""
    response = client.get(
        "/api/v1/quality/source-worklist/export",
        headers={"X-Tenant-ID": "khc-europe"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["tenant_id"] == "khc-europe"
    assert "Single Source of Truth" in data["target_system"]
    assert len(data["tickets"]) >= 1

    ticket = data["tickets"][0]
    assert "ticket_id" in ticket
    assert "field_name" in ticket
    assert "target_value" in ticket


def test_mark_issue_resolved_in_source(client: TestClient) -> None:
    """Test marking issue as resolved once KHC source system sync verifies update."""
    response = client.post(
        "/api/v1/quality/issues/DQI-KHC-003/resolve-in-source",
        headers={"X-Tenant-ID": "khc-europe"}
    )
    assert response.status_code == 200
    issue = response.json()
    assert issue["status"] == "resolved_in_source"
    assert "Single source of truth restored" in issue["description"]
