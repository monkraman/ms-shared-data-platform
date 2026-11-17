"""Automated tests for health check endpoints and API baseline."""

import pytest
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


@pytest.mark.parametrize(
    "origin", ["https://trace.monkspaces.com", "https://traces.monkspaces.com", "http://localhost:5173"]
)
def test_cors_preflight_for_trace_frontend(client: TestClient, origin: str) -> None:
    """The Trace frontend may call the sign-in API from its site and its local dev server."""
    response = client.options(
        "/api/v1/auth/sign-in",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == origin
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_rejects_unknown_origin(client: TestClient) -> None:
    response = client.options(
        "/api/v1/auth/sign-in",
        headers={"Origin": "https://evil.example.com", "Access-Control-Request-Method": "POST"},
    )
    assert response.status_code == 400
