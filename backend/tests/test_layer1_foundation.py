"""Unit and integration tests for Layer 1: Shared Data Foundation."""

from fastapi.testclient import TestClient


def test_list_canonical_products(client: TestClient) -> None:
    """Test retrieving products list for KHC Europe tenant."""
    response = client.get("/api/v1/foundation/products", headers={"X-Tenant-ID": "khc-europe"})
    assert response.status_code == 200
    products = response.json()
    assert len(products) >= 4

    skus = [p["sku"] for p in products]
    assert "KHC-HTK-500G-GL" in skus
    assert "KHC-HTK-400ML-SQ" in skus


def test_get_product_detail_and_bom(client: TestClient) -> None:
    """Test retrieving product detail and packaging components BOM."""
    response = client.get(
        "/api/v1/foundation/products/KHC-HTK-500G-GL",
        headers={"X-Tenant-ID": "khc-europe"}
    )
    assert response.status_code == 200
    product = response.json()
    assert product["brand"] == "Heinz"
    assert "Glass" in product["primary_material_summary"]
    assert len(product["components"]) >= 3

    # Verify primary level component
    glass_bottle = next(c for c in product["components"] if c["id"] == "COMP-HK-001")
    assert glass_bottle["level"] == "primary"
    assert glass_bottle["material"] == "Glass"
    assert glass_bottle["weight_grams"] == 285.0
    assert glass_bottle["source_lineage"]["source_system"] == "Trace One (Devex PLM)"


def test_ingestion_batches_lineage(client: TestClient) -> None:
    """Test retrieving ingestion batches."""
    response = client.get("/api/v1/foundation/batches", headers={"X-Tenant-ID": "khc-europe"})
    assert response.status_code == 200
    batches = response.json()
    assert len(batches) >= 1
    assert "BATCH-TRACEEONE-089" in batches[0]["id"]


def test_simulate_traceone_sync(client: TestClient) -> None:
    """Test on-demand delta sync from KHC Trace One PLM."""
    response = client.post(
        "/api/v1/foundation/sync/traceone?spec_id=DEV-8821",
        headers={"X-Tenant-ID": "khc-europe"}
    )
    assert response.status_code == 200
    batch = response.json()
    assert "BATCH-SYNC-" in batch["id"]
    assert "DEV-8821" in batch["source_reference"]
