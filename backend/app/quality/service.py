"""Gaps of the current workspace: engine results plus what people decided about them."""

from __future__ import annotations

from collections import Counter
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.models import Product
from app.quality.engine import find_gaps
from app.quality.models import GapRule, GapState


async def gaps(db: AsyncSession, products: list[Product] | None = None) -> list[dict[str, Any]]:
    """Every gap in the workspace (RLS scopes products and states), with its status."""
    if products is None:
        products = list((await db.scalars(select(Product).order_by(Product.sku))).all())
    rules = list((await db.scalars(select(GapRule).order_by(GapRule.id))).all())
    states = {s.gap_id: s.status for s in (await db.scalars(select(GapState))).all()}
    return [{**g, "status": states.get(g["id"], "open")} for g in find_gaps(products, rules)]


def open_by_sku(all_gaps: list[dict[str, Any]]) -> Counter[str]:
    return Counter(g["sku"] for g in all_gaps if g["status"] != "resolved")
