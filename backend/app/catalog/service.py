"""Products as the API returns them, and the merge rules imports and edits share.

Field maps are replaced, never changed in place (JSON columns only save on reassignment).
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog import reference
from app.catalog.models import Component, FieldMap, Product, SalesLine


def _num(value: str | None) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except ValueError:
        return None


def _value(fields: FieldMap, key: str) -> str:
    return str((fields.get(key) or {}).get("value", ""))


def component_out(c: Component) -> dict[str, Any]:
    f = c.fields
    units = _num(_value(f, "units_per_pack"))
    return {
        "id": c.code,
        "name": _value(f, "component_name"),
        "level": _value(f, "packaging_level"),
        "units_per_pack": units if units else 1,
        "material": _value(f, "material"),
        "polymer": _value(f, "polymer"),
        "weight_g": _num(_value(f, "weight_g")),
        "weight_source": _value(f, "weight_source"),
        "recycled_content_pct": _num(_value(f, "recycled_content_pct")),
        "recyclability": _value(f, "recyclability_result"),
        "supplier_id": _value(f, "supplier_id"),
        "fields": f,
    }


def sales_out(s: SalesLine) -> dict[str, Any]:
    f = s.fields
    return {
        "id": s.code,
        "period": _value(f, "period"),
        "channel": _value(f, "channel"),
        "units_placed": _num(_value(f, "units_placed")) or 0,
        "units_exported": _num(_value(f, "units_exported")) or 0,
    }


def summary(p: Product, open_gaps: int = 0) -> dict[str, Any]:
    """List row: totals are computed from the stored values, never stored."""
    components = [component_out(c) for c in p.components]
    per_unit = sum((c["weight_g"] or 0) / (c["units_per_pack"] or 1) for c in components)
    values = [
        v
        for v in [*p.fields.values(), *p.passport.values(), *(v for c in p.components for v in c.fields.values())]
        if v.get("dp")
    ]
    filled = sum(1 for v in values if str(v.get("value", "")).strip())
    return {
        "sku": p.sku,
        "name": _value(p.fields, "product_name") or p.sku,
        "brand": _value(p.fields, "brand"),
        "gtin": _value(p.fields, "gtin"),
        "component_count": len(components),
        "packaging_g_per_unit": round(per_unit, 1),
        "materials": list(dict.fromkeys(c["material"] for c in components if c["material"])),
        "completeness_pct": round(filled / len(values) * 100) if values else 0,
        "open_gaps": open_gaps,
    }


def detail(p: Product, open_gaps: int = 0) -> dict[str, Any]:
    return {
        **summary(p, open_gaps),
        "fields": p.fields,
        "passport": p.passport,
        "components": [component_out(c) for c in p.components],
        "sales": [sales_out(s) for s in p.sales],
    }


def fv(key: str, value: Any) -> dict[str, Any]:
    """One stored value, tagged with its data point from the field catalogue."""
    return {"dp": reference.field_dp(key), "value": "" if value is None else str(value)}


def merge(current: FieldMap, incoming: dict[str, Any], *, keep_blank: bool = True) -> FieldMap:
    """New map with incoming values; a blank incoming value never wipes a stored one."""
    out = dict(current)
    for key, value in incoming.items():
        text = "" if value is None else str(value).strip()
        if text or (keep_blank and key not in out):
            out[key] = fv(key, text)
    return out


async def get_by_sku(db: AsyncSession, sku: str) -> Product | None:
    return await db.scalar(select(Product).where(Product.sku == sku))


async def upsert(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    sku: str,
    *,
    product_fields: dict[str, Any],
    passport_fields: dict[str, Any],
    components: list[dict[str, Any]],
    sales: list[dict[str, Any]] | None = None,
    source: str,
) -> tuple[Product, bool]:
    """Create or update a product by SKU. Components match by code, then by name, else are added.

    Returns the product and whether it was new.
    """
    product = await get_by_sku(db, sku)
    created = product is None
    if product is None:
        product = Product(tenant_id=tenant_id, sku=sku, fields={}, passport={}, components=[], sales=[])
        db.add(product)
    product.fields = merge(product.fields, product_fields)
    product.passport = merge(product.passport, passport_fields)
    product.source = source

    for row in components:
        code = str(row.pop("component_id", "") or "").strip()
        name = str(row.get("component_name", "") or "").strip()
        match = next((c for c in product.components if code and c.code == code), None) or next(
            (c for c in product.components if name and _value(c.fields, "component_name") == name), None
        )
        if match is None:
            position = len(product.components) + 1
            match = Component(tenant_id=tenant_id, code=code or f"{sku}-{position:02d}", position=position, fields={})
            product.components.append(match)
        match.fields = merge(match.fields, row)

    for row in sales or []:
        code = str(row.pop("id", "") or "").strip() or f"{sku}-S{len(product.sales) + 1}"
        line = next((s for s in product.sales if s.code == code), None)
        if line is None:
            line = SalesLine(tenant_id=tenant_id, code=code, fields={})
            product.sales.append(line)
        line.fields = merge(line.fields, row)

    await db.flush()
    return product, created
