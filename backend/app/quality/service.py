"""Gaps of the current workspace: engine results plus what people decided about them."""

from __future__ import annotations

import uuid
from collections import Counter
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.models import Product
from app.core.tenancy import TENANT_SETTING
from app.platform.models import Tenant
from app.quality.engine import find_gaps
from app.quality.models import GapRule, GapState


async def gaps(db: AsyncSession, products: list[Product] | None = None) -> list[dict[str, Any]]:
    """Every gap in the workspace (RLS scopes products and states), with its status."""
    if products is None:
        products = list((await db.scalars(select(Product).order_by(Product.sku))).all())
    rules = applicable(list((await db.scalars(select(GapRule).order_by(GapRule.id))).all()), await current_tenant(db))
    states = {s.gap_id: s.status for s in (await db.scalars(select(GapState))).all()}
    return [{**g, "status": states.get(g["id"], "open")} for g in find_gaps(products, rules)]


async def current_tenant(db: AsyncSession) -> Tenant | None:
    """The workspace this session is bound to (RLS setting), if any."""
    raw = await db.scalar(text(f"SELECT current_setting('{TENANT_SETTING}', true)"))
    return await db.get(Tenant, uuid.UUID(raw)) if raw else None


def applicable(rules: list[GapRule], tenant: Tenant | None) -> list[GapRule]:
    """Rules for the workspace's modules and countries; all rules when the workspace has none set."""
    if tenant is None:
        return rules
    modules, countries = set(tenant.modules), set(tenant.countries)
    return [
        r
        for r in rules
        if (not modules or modules & set(r.modules))
        and (not r.countries or not countries or countries & set(r.countries))
    ]


def open_by_sku(all_gaps: list[dict[str, Any]]) -> Counter[str]:
    return Counter(g["sku"] for g in all_gaps if g["status"] != "resolved")
