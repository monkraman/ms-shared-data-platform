"""Pytest test fixtures."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_application


@pytest.fixture(scope="session")
def client() -> TestClient:
    """Fixture providing a synchronous HTTP test client for the FastAPI application."""
    application = create_application()
    with TestClient(application) as test_client:
        yield test_client
