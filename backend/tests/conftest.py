"""Pytest test fixtures.

Database tests need a real PostgreSQL (RLS cannot be faked). Point
``TEST_DATABASE_URL`` at a server where the user may create roles and databases, e.g.
``postgresql://postgres:postgres@localhost:5432/postgres``; without it they are skipped.

The fixture creates a fresh database owned by a non-superuser role, because
superusers bypass Row-Level Security and would hide isolation bugs.
"""

from __future__ import annotations

import os
import secrets
from collections.abc import Iterator
from urllib.parse import urlsplit, urlunsplit

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.main import create_application

APP_ROLE = "compliance_app_test"


@pytest.fixture(scope="session")
def client() -> TestClient:
    """Fixture providing a synchronous HTTP test client for the FastAPI application."""
    application = create_application()
    with TestClient(application) as test_client:
        yield test_client


def _with_credentials(url: str, user: str, password: str, dbname: str) -> str:
    parts = urlsplit(url.replace("postgresql+psycopg://", "postgresql://"))
    host = parts.hostname or "localhost"
    netloc = f"{user}:{password}@{host}" + (f":{parts.port}" if parts.port else "")
    return urlunsplit(parts._replace(netloc=netloc, path=f"/{dbname}"))


@pytest.fixture(scope="session")
def database_url() -> Iterator[str]:
    admin_url = os.environ.get("TEST_DATABASE_URL")
    if not admin_url:
        pytest.skip("TEST_DATABASE_URL not set; skipping PostgreSQL tests.")
    admin_url = admin_url.replace("postgresql+psycopg://", "postgresql://")
    dbname = f"ch_test_{secrets.token_hex(4)}"
    password = secrets.token_urlsafe(16)

    with psycopg.connect(admin_url, autocommit=True) as conn:
        exists = conn.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (APP_ROLE,)).fetchone()
        verb = "ALTER" if exists else "CREATE"
        conn.execute(f"{verb} ROLE {APP_ROLE} LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '{password}'")
        conn.execute(f"CREATE DATABASE {dbname} OWNER {APP_ROLE}")

    app_url = _with_credentials(admin_url, APP_ROLE, password, dbname)

    from alembic import command
    from alembic.config import Config

    from app.core.config import get_settings
    from app.core.db import get_engine, get_sessionmaker

    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = app_url
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_sessionmaker.cache_clear()

    cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    command.upgrade(cfg, "head")
    try:
        yield app_url
    finally:
        get_engine.cache_clear()
        get_sessionmaker.cache_clear()
        if previous is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous
        get_settings.cache_clear()
        with psycopg.connect(admin_url, autocommit=True) as conn:
            conn.execute(f"DROP DATABASE IF EXISTS {dbname} WITH (FORCE)")


@pytest.fixture(scope="session")
def db_client(database_url: str) -> Iterator[TestClient]:
    """A client whose app uses the test database; run async code with ``db_client.portal.call``."""
    application = create_application()
    with TestClient(application) as test_client:
        yield test_client
