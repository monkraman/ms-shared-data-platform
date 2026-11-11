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
