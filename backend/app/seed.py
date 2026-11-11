"""Load seed data through the repositories: ``python -m app.seed demo``.

Fixtures live in ``seeds/<name>/``. Running it twice is safe (it updates in place).
Passwords: SEED_PASSWORD if set, otherwise one random password printed once.
Never run the demo seed against production.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import secrets
from pathlib import Path

import app.models  # noqa: F401
from app.core.audit import record_audit
from app.core.config import get_settings
from app.core.db import dispose_engine
from app.core.tenancy import tenant_session
from app.platform import repository as repo
from app.platform.models import LegalEntity, TenantRole, TenantStatus
from app.platform.passwords import hash_password

SEEDS_DIR = Path(__file__).resolve().parent.parent / "seeds"


async def seed(name: str, password: str) -> dict[str, int]:
    fixture = json.loads((SEEDS_DIR / name / "platform.json").read_text(encoding="utf-8"))
    password_hash = hash_password(password)
    async with tenant_session(None, platform_access=True) as session:
        tenants = {}
        for t in fixture["tenants"]:
            tenant = await repo.upsert_tenant(
                session, slug=t["slug"], name=t["name"], status=TenantStatus(t.get("status", "active"))
            )
            tenant.sector = t.get("sector", tenant.sector or "Other")
            tenant.brand_color = t.get("brand_color", tenant.brand_color or "#1b3c6d")
            tenant.logo_url = t.get("logo_url")
            tenant.countries = t.get("countries", [])
            tenant.modules = t.get("modules", [])
            await session.refresh(tenant, ["legal_entities"])
            tenant.legal_entities = [LegalEntity(**e) for e in t.get("legal_entities", [])]
            tenants[t["slug"]] = tenant
        for u in fixture["users"]:
            user = await repo.upsert_user(
                session,
                email=u["email"],
                full_name=u["full_name"],
                is_platform_admin=u.get("is_platform_admin", False),
                password_hash=password_hash,
            )
            for m in u.get("memberships", []):
                await repo.ensure_membership(
                    session, tenant_id=tenants[m["tenant"]].id, user_id=user.id, role=TenantRole(m["role"])
                )
        await record_audit(
            session,
            action="seed.loaded",
            entity_type="seed",
            entity_id=name,
            actor_email="seed-cli",
            after={"tenants": len(fixture["tenants"]), "users": len(fixture["users"])},
        )
    return {"tenants": len(fixture["tenants"]), "users": len(fixture["users"])}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name", choices=sorted(p.name for p in SEEDS_DIR.iterdir() if p.is_dir()))
    args = parser.parse_args()

    if get_settings().app_env == "production" and args.name == "demo":
        raise SystemExit("Refusing to load demo seed data with APP_ENV=production.")

    password = os.environ.get("SEED_PASSWORD")
    generated = password is None
    password = password or secrets.token_urlsafe(12)

    async def run() -> dict[str, int]:
        try:
            return await seed(args.name, password)
        finally:
            await dispose_engine()

    counts = asyncio.run(run())
    print(f"Seed '{args.name}' loaded: {counts['tenants']} tenants, {counts['users']} users.")
    if generated:
        print(f"Password for every seeded user (shown once): {password}")


if __name__ == "__main__":
    main()
