"""Tenant context and Row-Level Security (RLS).

Every tenant table has a ``tenant_id`` column and the policy created by
:func:`enable_tenant_rls`. Each database transaction sets two Postgres settings:

* ``app.tenant_id``: the active tenant; rows of other tenants are invisible.
* ``app.platform_access``: ``on`` only for platform-wide work by a platform admin
  (for example listing every workspace). It is never set from client input.

A query that forgets to filter by tenant therefore returns nothing instead of
another client's data. RLS is ``FORCE``d, so it applies to the table owner too.

Superusers and roles with BYPASSRLS skip RLS, and hosted Postgres (Neon) often gives
the login role BYPASSRLS. So every transaction also runs ``SET LOCAL ROLE
compliance_rls`` (created by migration 0002), a role that cannot bypass RLS.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_sessionmaker

TENANT_SETTING = "app.tenant_id"
PLATFORM_SETTING = "app.platform_access"
RLS_ROLE = "compliance_rls"


@asynccontextmanager
async def tenant_session(tenant_id: uuid.UUID | None, *, platform_access: bool = False) -> AsyncIterator[AsyncSession]:
    """Open a session in one transaction scoped to ``tenant_id``.

    Commits when the block finishes and rolls back on error. Pass
    ``platform_access=True`` only after checking a platform permission.
    """
    async with get_sessionmaker()() as session, session.begin():
        await apply_tenant_settings(session, tenant_id, platform_access=platform_access)
        yield session


async def apply_tenant_settings(
    session: AsyncSession, tenant_id: uuid.UUID | None, *, platform_access: bool = False
) -> None:
    # Both are transaction-local (SET LOCAL / set_config(..., true)), so safe with pooling.
    await session.execute(text(f"SET LOCAL ROLE {RLS_ROLE}"))
    await session.execute(
        text("SELECT set_config(:tk, :tv, true), set_config(:pk, :pv, true)"),
        {
            "tk": TENANT_SETTING,
            "tv": str(tenant_id) if tenant_id else "",
            "pk": PLATFORM_SETTING,
            "pv": "on" if platform_access else "off",
        },
    )


# --- Migration helpers -------------------------------------------------------------

_CURRENT_TENANT = f"NULLIF(current_setting('{TENANT_SETTING}', true), '')::uuid"
_PLATFORM = f"current_setting('{PLATFORM_SETTING}', true) = 'on'"


def tenant_rls_statements(table: str, *, allow_null_tenant_insert: bool = False) -> list[str]:
    """SQL that turns on RLS for a tenant table.

    ``allow_null_tenant_insert`` lets rows without a tenant be written (for example
    platform audit events such as a failed sign-in); only platform access can read them.
    """
    check = f"tenant_id = {_CURRENT_TENANT} OR {_PLATFORM}"
    if allow_null_tenant_insert:
        check = f"tenant_id IS NULL OR {check}"
    return [
        f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY",
        f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY",
        (f"CREATE POLICY tenant_read ON {table} FOR SELECT USING (tenant_id = {_CURRENT_TENANT} OR {_PLATFORM})"),
        f"CREATE POLICY tenant_insert ON {table} FOR INSERT WITH CHECK ({check})",
        (
            f"CREATE POLICY tenant_update ON {table} FOR UPDATE "
            f"USING (tenant_id = {_CURRENT_TENANT} OR {_PLATFORM}) "
            f"WITH CHECK (tenant_id = {_CURRENT_TENANT} OR {_PLATFORM})"
        ),
        (f"CREATE POLICY tenant_delete ON {table} FOR DELETE USING (tenant_id = {_CURRENT_TENANT} OR {_PLATFORM})"),
    ]


def enable_tenant_rls(op, table: str, *, allow_null_tenant_insert: bool = False) -> None:
    """Use in Alembic migrations: ``enable_tenant_rls(op, "products")``."""
    for statement in tenant_rls_statements(table, allow_null_tenant_insert=allow_null_tenant_insert):
        op.execute(statement)


def disable_tenant_rls(op, table: str) -> None:
    for policy in ("tenant_read", "tenant_insert", "tenant_update", "tenant_delete"):
        op.execute(f"DROP POLICY IF EXISTS {policy} ON {table}")
    op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
