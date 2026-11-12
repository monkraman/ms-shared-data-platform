"""Import pipeline shared by CSV uploads and system syncs: targets, mapping, checks, apply.

One row = one packaging component of one product (product values repeat on each row).
Any field of the catalogue at product, passport or component level can be mapped.
"""

from __future__ import annotations

import re
import uuid
from collections import defaultdict
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog import reference
from app.catalog import service as catalog
from app.ingestion.models import ImportBatch
from app.quality.validation import check

# Only what places a row; other missing values are imported empty and show up as gaps.
REQUIRED = ("sku", "product_name", "component_name")
# Common column names in client files, by field.
ALIASES = {
    "sku": ("article", "articlenumber", "material number", "matnr", "item", "itemnumber", "productcode"),
    "product_name": ("product", "description", "productdescription", "name"),
    "component_name": ("component", "packagingcomponent", "packaging"),
    "packaging_level": ("level", "packaginglevel"),
    "weight_g": ("weight", "weightg", "grams", "weightgrams"),
    "units_per_pack": ("units", "unitsperpack", "quantity"),
    "recycled_content_pct": ("recycledcontent", "recycled", "pcr", "recycledpct"),
    "gtin": ("ean", "barcode", "upc"),
}
LEVELS = ("Product", "Passport", "Component")
MAX_ISSUES = 50


def targets() -> list[dict[str, Any]]:
    """Fields a column can map to: identifiers first, then the catalogue by level."""
    out = [
        {"key": "sku", "label": "SKU", "dp": "DP01", "required": True},
        {"key": "component_id", "label": "Component ID", "dp": None, "required": False},
    ]
    for level in LEVELS:
        for key, info in reference.fields().items():
            if info["level"] == level:
                out.append({"key": key, "label": info["label"], "dp": info["dp"], "required": key in REQUIRED})
    return out


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def suggest_mapping(columns: list[str]) -> dict[str, str | None]:
    by_name: dict[str, str] = {}
    for t in targets():
        by_name.setdefault(_norm(t["key"]), t["key"])
        by_name.setdefault(_norm(t["label"]), t["key"])
    for key, names in ALIASES.items():
        for name in names:
            by_name.setdefault(_norm(name), key)
    return {col: by_name.get(_norm(col)) for col in columns}


def parse(batch: ImportBatch) -> list[dict[str, Any]]:
    """Each row's mapped values and problems (row numbers count the header as row 1).

    Only a missing SKU, product name or component rejects a row. Values the catalogue does
    not accept ("26 g", "plastic") are imported as they are and listed as warnings: the
    Validation screen suggests the correction.
    """
    labels = {t["key"]: t["label"] for t in targets()}
    out = []
    for i, row in enumerate(batch.rows):
        values: dict[str, str] = {}
        for c, col in enumerate(batch.columns):
            key = batch.mapping.get(col)
            if key:
                values[key] = (row[c] if c < len(row) else "").strip()
        issues = [
            {"row": i + 2, "column": labels.get(k, k), "message": "Missing"} for k in REQUIRED if not values.get(k)
        ]
        warnings = []
        for key, raw in values.items():
            problem = check(key, raw)
            if problem:
                hint = f" (use {problem['suggestion']})" if problem["suggestion"] else ""
                warnings.append(
                    {"row": i + 2, "column": labels.get(key, key), "message": f"{problem['message']}{hint}"}
                )
        out.append({"values": values, "issues": issues, "warnings": warnings, "ok": not issues})
    return out


def _first_per_product(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """A product value repeats on each of its component rows: report it once per product."""
    seen, out = set(), []
    for r in rows:
        if not r["ok"]:
            continue
        for w in r["warnings"]:
            key = (r["values"].get("sku"), w["column"], w["message"])
            if key not in seen:
                seen.add(key)
                out.append(w)
    return out


def preview(batch: ImportBatch, existing_skus: set[str]) -> dict[str, Any]:
    rows = parse(batch)
    skus = {r["values"]["sku"] for r in rows if r["ok"]}
    return {
        "id": str(batch.id),
        "valid_rows": sum(1 for r in rows if r["ok"]),
        "invalid_rows": sum(1 for r in rows if not r["ok"]),
        "new_products": len(skus - existing_skus),
        "updated_products": len(skus & existing_skus),
        "issues": [i for r in rows for i in r["issues"]][:MAX_ISSUES],
        "warnings": _first_per_product(rows)[:MAX_ISSUES],
    }


async def apply(db: AsyncSession, tenant_id: uuid.UUID, batch: ImportBatch) -> dict[str, Any]:
    """Write the valid rows: products by SKU, components by ID or name; sales from a sync."""
    by_sku: dict[str, list[dict[str, str]]] = defaultdict(list)
    for r in parse(batch):
        if r["ok"]:
            by_sku[r["values"]["sku"]].append(r["values"])
    sales = (batch.extras or {}).get("sales", {})
    created = updated = 0
    for sku, lines in by_sku.items():
        product_fields: dict[str, str] = {}
        passport_fields: dict[str, str] = {}
        components = []
        for values in lines:
            component: dict[str, str] = {}
            for key, value in values.items():
                level = reference.field_level(key)
                if level == "Product":
                    product_fields[key] = value or product_fields.get(key, "")
                elif level == "Passport":
                    passport_fields[key] = value or passport_fields.get(key, "")
                elif level == "Component" or key == "component_id":
                    component[key] = value
            if "weight_source" not in component and batch.source == "csv":
                component["weight_source"] = "Imported"
            components.append(component)
        _, new = await catalog.upsert(
            db,
            tenant_id,
            sku,
            product_fields=product_fields,
            passport_fields=passport_fields,
            components=components,
            sales=[dict(s) for s in sales.get(sku, [])],
            source=batch.source,
        )
        created += new
        updated += not new
    return {"imported_products": len(by_sku), "created": created, "updated": updated}
