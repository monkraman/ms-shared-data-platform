"""Unit and integration tests for Layer 3: EPR Compliance Module."""

from fastapi.testclient import TestClient


def test_list_regulatory_rule_sets(client: TestClient) -> None:
    """Test retrieving approved EPR fee schedules (CITEO France, LUCID Germany)."""
    response = client.get("/api/v1/compliance/epr/rule-sets")
    assert response.status_code == 200
    rule_sets = response.json()
    assert len(rule_sets) >= 2

    rule_ids = [rs["id"] for rs in rule_sets]
    assert "FR-CITEO-2025" in rule_ids
    assert "DE-LUCID-2025" in rule_ids


def test_execute_epr_calculation_run(client: TestClient) -> None:
    """Test executing a reproducible EPR calculation run for France CITEO 2025."""
    payload = {
        "tenant_id": "khc-europe",
        "jurisdiction": "FR",
        "reporting_year": 2025,
        "include_provisional_corrections": True,
        "notes": "2025 CITEO preliminary declaration simulation"
    }
    response = client.post(
        "/api/v1/compliance/epr/calculate",
        json=payload,
        headers={"X-Tenant-ID": "khc-europe"}
    )
    assert response.status_code == 200
    run = response.json()

    assert "RUN-FR-2025-" in run["run_id"]
    assert run["jurisdiction"] == "FR"
    assert run["total_fee_eur"] > 0
    assert run["total_packaging_tonnes"] > 0
    assert len(run["line_items"]) > 0

    # Verify line-item transparency & explainability
    first_item = run["line_items"][0]
    assert "sku" in first_item
    assert "material" in first_item
    assert "base_tariff_eur_per_tonne" in first_item
    assert "net_fee_eur" in first_item
    assert "Base: €" in first_item["applied_rules_summary"]


def test_get_fee_hotspots(client: TestClient) -> None:
    """Test retrieving material and SKU fee hotspots."""
    response = client.get(
        "/api/v1/compliance/epr/hotspots",
        headers={"X-Tenant-ID": "khc-europe"}
    )
    assert response.status_code == 200
    hotspots = response.json()

    assert hotspots["total_fee_eur"] > 0
    assert len(hotspots["material_breakdown"]) > 0
    assert len(hotspots["top_products"]) > 0

    # Ensure material breakdown sums up properly
    total_pct = sum(m["percentage_of_fee"] for m in hotspots["material_breakdown"])
    assert 98.0 <= total_pct <= 102.0  # approximate 100% with rounding


def test_simulate_what_if_scenario(client: TestClient) -> None:
    """Test what-if simulation: 10% PET lightweighting + 50% PCR content."""
    # First get or execute run
    calc_res = client.post(
        "/api/v1/compliance/epr/calculate",
        json={"tenant_id": "khc-europe", "jurisdiction": "FR", "reporting_year": 2025},
        headers={"X-Tenant-ID": "khc-europe"}
    )
    run_id = calc_res.json()["run_id"]

    sim_payload = {
        "baseline_run_id": run_id,
        "target_material": "PET (Clear / Light Blue)",
        "weight_reduction_pct": 10.0,
        "increased_pcr_pct": 50.0,
        "notes": "Projected bottle redesign"
    }
    response = client.post(
        "/api/v1/compliance/epr/simulate-scenario",
        json=sim_payload,
        headers={"X-Tenant-ID": "khc-europe"}
    )
    assert response.status_code == 200
    sim = response.json()

    assert sim["fee_savings_eur"] > 0
    assert sim["fee_savings_pct"] > 0
    assert sim["tonnes_saved"] > 0
    assert "reduces annual FR EPR liability" in sim["executive_summary"]
