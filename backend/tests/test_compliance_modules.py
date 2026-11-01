"""Functional tests for EU PPWR Declaration of Conformity and DPP modules."""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_ppwr_declaration_of_conformity():
    """Test generating EU PPWR Article 6 DoC for Kraft Heinz Ketchup Glass SKU."""
    response = client.get(
        "/api/v1/compliance/modules/ppwr/KHC-HTK-500G-GL",
        headers={"X-Tenant-ID": "khc-europe"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["sku"] == "KHC-HTK-500G-GL"
    assert data["doc_reference"] == "DOC-PPWR-KHC-HTK-500G-GL-2026"
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
        headers={"X-Tenant-ID": "khc-europe"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["sku"] == "KHC-HTK-500G-GL"
    assert "https://id.monkspaces.com/01/" in data["gs1_digital_link_url"]
    assert data["total_packaging_weight_grams"] > 250.0
    assert len(data["disposal_instructions"]) > 0
    assert data["spec_source_system"] == "Trace One (Devex PLM)"

