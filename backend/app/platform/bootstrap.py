"""Demo accounts created in the database on their first sign-in.

``seeds/bootstrap_users.json`` lists the accounts carried over from the prototype, with
Argon2 hashes only (no passwords in the repository). When one of them signs in and is not
in the database yet, the account (and its workspace, by slug) is created, then the normal
sign-in check runs against the stored hash. Delete the file to switch this off.
"""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.platform import repository as repo
from app.platform.models import TenantRole, TenantStatus, User

_FILE = Path(__file__).resolve().parents[2] / "seeds" / "bootstrap_users.json"


@cache
def _accounts() -> dict[str, dict[str, Any]]:
    if not _FILE.exists():
        return {}
    return {u["email"].lower(): u for u in json.loads(_FILE.read_text(encoding="utf-8"))["users"]}


async def import_user(db: AsyncSession, email: str) -> User | None:
    """Create the listed account on first use; None for anyone not listed."""
    account = _accounts().get(email.strip().lower())
    if account is None:
        return None
    user = await repo.upsert_user(
        db,
        email=account["email"],
        full_name=account["full_name"],
        is_platform_admin=account["is_platform_admin"],
        password_hash=account["password_hash"],
    )
    if account.get("tenant"):
        tenant = await repo.get_tenant_by_slug(db, account["tenant"])
        if tenant is None:
            tenant = await repo.upsert_tenant(
                db, slug=account["tenant"], name=account["tenant_name"], status=TenantStatus.ACTIVE
            )
        await repo.ensure_membership(db, tenant_id=tenant.id, user_id=user.id, role=TenantRole(account["role"]))
    await db.refresh(user, ["memberships"])
    return user
