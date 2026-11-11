"""Shared test helpers."""

from app.core.security import create_access_token


def as_superadmin(tenant_slug: str) -> dict[str, str]:
    """Headers the prototype UI sends for a platform admin working in a workspace."""
    token = create_access_token({"sub": "superadmin@test.local", "role": "superadmin"})
    return {"Authorization": f"Bearer {token}", "X-Tenant-ID": tenant_slug}
