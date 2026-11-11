"""Move prototype users into the database the first time they sign in.

The prototype (``app/services/store.py``) keeps users in memory and JSON files with
plain-text passwords. When such a user signs in with their current password, they are
created here with an Argon2 hash, in a workspace with the same slug (for example
``khc-europe``), so the existing pages keep working. Delete this module once every
prototype user has moved (screen 9 replaces user management).
"""

from __future__ import annotations

import hmac

from sqlalchemy.ext.asyncio import AsyncSession

from app.platform import repository as repo
from app.platform.models import TenantRole, TenantStatus, User
from app.platform.passwords import hash_password

_ROLES = {
    "org_admin": TenantRole.ORG_ADMIN,
    "analyst": TenantRole.ANALYST,
    "viewer": TenantRole.VIEWER,
    "supplier_contact": TenantRole.VIEWER,
}


async def import_user(db: AsyncSession, email: str, password: str) -> User | None:
    from app.services.store import data_store  # Prototype store; imported only here.

    legacy = data_store.get_user(email)
    stored = (legacy or {}).get("password")
    if not legacy or not stored or not hmac.compare_digest(str(stored).encode(), password.encode()):
        return None

    is_admin = legacy.get("role") == "superadmin"
    user = await repo.upsert_user(
        db,
        email=email,
        full_name=legacy.get("full_name") or email,
        is_platform_admin=is_admin,
        password_hash=hash_password(password),
    )
    slug = legacy.get("tenant_id")
    if slug and not is_admin:
        tenant = await repo.get_tenant_by_slug(db, slug)
        if tenant is None:
            legacy_tenant = data_store.tenants.get(slug)
            name = getattr(legacy_tenant, "name", None) or legacy.get("organisation_name") or slug
            tenant = await repo.upsert_tenant(db, slug=slug, name=name, status=TenantStatus.ACTIVE)
        await repo.ensure_membership(
            db, tenant_id=tenant.id, user_id=user.id, role=_ROLES.get(legacy.get("role", ""), TenantRole.VIEWER)
        )
    await db.refresh(user, ["memberships"])
    return user
