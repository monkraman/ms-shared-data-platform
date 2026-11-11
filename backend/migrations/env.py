"""Alembic environment: async SQLAlchemy with psycopg 3, URL from app settings."""

import asyncio

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

import app.models  # noqa: F401 - load every table
from app.core.config import get_settings
from app.core.db import Base

target_metadata = Base.metadata
# Leave the prototype's tables (schema "platform", created by scripts/init_schema.sql) alone.
INCLUDE_SCHEMAS = {None, "public"}


def include_object(obj, name, type_, reflected, compare_to):
    return not (type_ == "table" and getattr(obj, "schema", None) not in INCLUDE_SCHEMAS)


def database_url() -> str:
    url = context.config.attributes.get("database_url") or get_settings().sqlalchemy_database_url
    if "CHANGE_ME" in url:
        raise RuntimeError("Set DATABASE_URL before running migrations.")
    return url


def run_migrations_offline() -> None:
    context.configure(
        url=database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        include_object=include_object,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _run(connection) -> None:
    context.configure(
        connection=connection, target_metadata=target_metadata, include_object=include_object, compare_type=True
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = create_async_engine(database_url())
    async with engine.connect() as connection:
        await connection.run_sync(_run)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
