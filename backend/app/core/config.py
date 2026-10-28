"""Application configuration management using pydantic-settings."""

from functools import lru_cache
from typing import List
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
    cors_origins: List[str] = Field(
        default_factory=lambda: ["http://localhost:4200", "http://127.0.0.1:4200"],
        description="Allowed CORS origins for the frontend",
    )
    database_url: str = Field(
        default="postgresql+asyncpg://monkspaces_user:CHANGE_ME@localhost:5432/monkspaces_db",
        description="PostgreSQL connection string",
    )


@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
