"""Automated tests for health check endpoints and API baseline."""

from fastapi.testclient import TestClient


def test_root_health_check(client: TestClient) -> None:
    """Verify that root /health returns 200 OK with expected payload structure."""
    response = client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "monkspaces-backend"
    assert "version" in data
    assert "environment" in data
    assert "timestamp" in data


def test_api_v1_health_check(client: TestClient) -> None:
    """Verify that versioned /api/v1/health returns 200 OK with identical payload structure."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "monkspaces-backend"
    assert data["version"] == "0.1.0"


def test_cors_headers_on_health(client: TestClient) -> None:
    """Verify that CORS preflight / headers work for allowed origins."""
    origin = "http://localhost:4200"
    response = client.get(
        "/api/v1/health",
        headers={"Origin": origin},
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == origin


def test_create_and_list_tenants(client: TestClient) -> None:
    """Verify creating a tenant workspace via Onboarding API and retrieving it."""
    payload = {
        "id": "nestle-nordic",
        "name": "Nordic FMCG Solutions",
        "sector": "food_beverage",
        "organisation_size": "L",
        "primary_currency": "EUR",
        "active_jurisdictions": ["SE_FTI_2025", "DK_DPA_2025"],
    }
    create_res = client.post("/api/v1/tenants", json=payload)
    assert create_res.status_code == 201
    created_data = create_res.json()
    assert created_data["id"] == "nestle-nordic"
    assert created_data["name"] == "Nordic FMCG Solutions"

    # Verify in list
    list_res = client.get("/api/v1/tenants")
    assert list_res.status_code == 200
    tenants = list_res.json()
    slugs = [t["id"] for t in tenants]
    assert "nestle-nordic" in slugs

