"""Application configuration management using pydantic-settings."""

from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Core application settings with environment variable fallbacks."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = Field(
        default="Monkspaces Shared Data Platform API",
        description="Public name of the application",
    )
    app_version: str = Field(default="0.1.0", description="Semver application version")
    app_env: str = Field(default="development", description="Environment: development, staging, production")
    debug: bool = Field(default=False, description="Debug mode flag")
    host: str = Field(default="0.0.0.0", description="API server bind host")
    port: int = Field(default=8000, description="API server bind port")
    api_prefix: str = Field(default="/api/v1", description="Prefix for API routes")

    # Security & Tenancy
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:4200", "http://127.0.0.1:4200"],
        description="Allowed CORS origins for the frontend",
    )
    jwt_secret_key: str | None = Field(
        default=None,
        description="HS256 signing key for access tokens. Required when APP_ENV=production.",
    )
    access_token_minutes: int = Field(default=15, description="Lifetime of platform access tokens")
    database_url: str = Field(
        default="postgresql+psycopg://monkspaces_user:CHANGE_ME@localhost:5432/monkspaces_db",
        description="PostgreSQL connection string",
    )
    db_pool_size: int = Field(default=5, description="SQLAlchemy connection pool size")

    # Background jobs: Celery on Redis when REDIS_URL is set, otherwise in-process.
    redis_url: str | None = Field(default=None, description="Redis URL for the Celery job queue")

    @property
    def sqlalchemy_database_url(self) -> str:
        """Database URL normalised for SQLAlchemy's async psycopg 3 driver."""
        return normalise_database_url(self.database_url)

    @property
    def database_configured(self) -> bool:
        return bool(self.database_url) and "CHANGE_ME" not in self.database_url


def normalise_database_url(url: str) -> str:
    """Accept Neon, Render, Heroku-style or asyncpg URLs and return a psycopg 3 URL.

    psycopg understands libpq options such as ``sslmode`` and ``channel_binding``,
    so those are kept as they are.
    """
    for prefix in ("postgresql+asyncpg://", "postgresql+psycopg2://", "postgresql://", "postgres://"):
        if url.startswith(prefix):
            url = "postgresql+psycopg://" + url[len(prefix) :]
            break
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    query.setdefault("connect_timeout", "10")
    return urlunsplit(parts._replace(query=urlencode(query)))


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
