"""Functional tests for Modular Compliance: Entitlements, PPWR DoC, DPP, and ISO 14067 LCA."""

from tests.helpers import as_superadmin
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_ppwr_declaration_of_conformity():
    """Test generating EU PPWR Article 6 DoC for Kraft Heinz Ketchup Glass SKU."""
    response = client.get(
        "/api/v1/compliance/modules/ppwr/KHC-HTK-500G-GL",
        headers=as_superadmin("khc-europe"),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["sku"] == "KHC-HTK-500G-GL"
    assert "KHC-HTK-500G-GL" in data["doc_reference"]
    assert data["overall_recyclability_pct"] > 90.0
    assert "Grade A" in data["recyclability_grade"]
    assert data["heavy_metals_compliant"] is True
    assert data["pfas_substance_free"] is True
    assert data["source_sales_system"] == "Snowflake Analytics (sales_by_market)"
    assert len(data["components_assessed"]) >= 3


def test_digital_product_passport():
    """Test generating DPP QR Carrier and GS1 link for Kraft Heinz SKU."""
    response = client.get(
        "/api/v1/compliance/modules/dpp/KHC-HTK-500G-GL",
        headers=as_superadmin("khc-europe"),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["sku"] == "KHC-HTK-500G-GL"
    assert "https://id.monkspaces.com/01/" in data["gs1_digital_link_url"]
    assert data["total_packaging_weight_grams"] > 250.0
    assert len(data["disposal_instructions"]) > 0
    assert data["spec_source_system"] == "Trace One (Devex PLM)"


def test_lca_carbon_assessment_khc():
    """Test ISO 14067 LCA cradle-to-gate carbon engine for subscribed tenant."""
    response = client.get(
        "/api/v1/compliance/modules/lca/KHC-HTK-500G-GL",
        headers=as_superadmin("khc-europe"),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["sku"] == "KHC-HTK-500G-GL"
    assert data["pack_carbon_footprint_g_co2e"] > 0
    assert data["annual_scope3_tonnes_co2e"] > 0
    assert data["eco_score_grade"] in ["A", "B", "C", "D", "E"]
    assert len(data["component_breakdowns"]) >= 3
    assert len(data["reduction_recommendations"]) >= 1
    assert len(data["required_additional_data"]) >= 1


def test_module_entitlement_gating():
    """Test that Nordhavn Spirits (not subscribed to LCA) receives 403 Forbidden."""
    response = client.get(
        "/api/v1/compliance/modules/lca/KHC-HTK-500G-GL",
        headers=as_superadmin("nordhavn-spirits"),
    )
    assert response.status_code == 403
    assert "not activated for tenant 'nordhavn-spirits'" in response.json()["detail"]


def test_tenant_module_update_patch():
    """Test SuperAdmin toggling modules for a tenant workspace."""
    # 1. Update nordhavn to include LCA
    patch_res = client.patch(
        "/api/v1/tenants/nordhavn-spirits/modules",
        json={"active_modules": ["epr", "ppwr", "lca"]},
    )
    assert patch_res.status_code == 200
    assert "lca" in patch_res.json()["active_modules"]

    # 2. Now Nordhavn should successfully access LCA
    lca_res = client.get(
        "/api/v1/compliance/modules/lca/KHC-HTK-500G-GL",
        headers=as_superadmin("nordhavn-spirits"),
    )
    assert lca_res.status_code == 200

    # 3. Reset Nordhavn back to epr and ppwr only
    reset_res = client.patch(
        "/api/v1/tenants/nordhavn-spirits/modules",
        json={"active_modules": ["epr", "ppwr"]},
    )
    assert reset_res.status_code == 200
    assert "lca" not in reset_res.json()["active_modules"]


def test_enrich_ppwr_data():
    """Test attaching lab certificates and verifying PPWR DoC updates."""
    res = client.post(
        "/api/v1/compliance/modules/enrichment/KHC-HTK-500G-GL/ppwr",
        headers=as_superadmin("khc-europe"),
        json={
            "recyclass_cert_id": "RC-2025-EU-889",
            "pcr_cert_id": "EU-CERT-994",
            "pfas_free_declaration": True,
            "heavy_metals_pass": True,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert "DOC-PPWR-RC-2025-EU-889-KHC-HTK-500G-GL" == data["doc_reference"]
    assert data["pfas_substance_free"] is True
    assert data["is_compliant_for_eu_market"] is True


def test_enrich_lca_data():
    """Test attaching converter renewable energy and EPD registration."""
    res = client.post(
        "/api/v1/compliance/modules/enrichment/KHC-HTK-500G-GL/lca",
        headers=as_superadmin("khc-europe"),
        json={
            "renewable_energy_pct": 75.0,
            "transport_distance_km": 150.0,
            "epd_registration_id": "EPD-ENV-2024-912",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["transport_cradle_to_gate_km"] == 150.0
    gaps_str = " ".join(data["required_additional_data"])
    assert "EPD-ENV-2024-912" in gaps_str
    assert "75.0% renewable PPA" in gaps_str
