"""EPR fee calculation from the workspace's products, packaging components and sales.

For each sales line in the year: units on the market = placed − exported; each component
adds units × weight per pack ÷ units per pack to its material's tonnage. Fees apply to the
regime's channels (UK: household packaging only). Components without a weight or material
are counted as data issues, never guessed here (estimation is the gaps module's job).
"""

from __future__ import annotations

import json
from collections import defaultdict
from functools import cache
from pathlib import Path
from typing import Any

from app.catalog.models import FieldMap, Product

_REFERENCE = Path(__file__).resolve().parent / "reference" / "regimes.json"
ESTIMATED_SOURCES = {"Spec", "Estimated"}


@cache
def reference() -> dict[str, Any]:
    return json.loads(_REFERENCE.read_text(encoding="utf-8"))


def regimes() -> dict[str, dict[str, Any]]:
    return reference()["regimes"]


def material_code(material: str) -> str | None:
    text = material.strip().lower()
    if not text:
        return None
    return reference()["material_aliases"].get(text, "OT")


def _v(fields: FieldMap, key: str) -> str:
    return str((fields.get(key) or {}).get("value", "")).strip()


def _num(text: str) -> float | None:
    try:
        return float(text) if text else None
    except ValueError:
        return None


def years(products: list[Product]) -> list[str]:
    return sorted({_v(s.fields, "period") for p in products for s in p.sales if _v(s.fields, "period")}, reverse=True)


def calculate(regime_id: str, products: list[Product], year: str | None) -> dict[str, Any]:
    regime = regimes()[regime_id]
    rates: dict[str, float] = regime["rates"]
    names: dict[str, str] = reference()["materials"]
    fee_channels = set(regime["fee_channels"])
    available = years(products)
    year = year or (available[0] if available else None)

    tonnes: dict[str, float] = defaultdict(float)  # all packaging placed, by material
    fee_tonnes: dict[str, float] = defaultdict(float)  # in scope for fees, by material
    by_product: list[dict[str, Any]] = []
    missing_weight = estimated = components = without_sales = 0

    for p in products:
        lines = [s for s in p.sales if _v(s.fields, "period") == year]
        if not lines:
            without_sales += 1
        p_tonnes = p_fee = 0.0
        p_materials: dict[str, float] = defaultdict(float)
        for c in p.components:
            components += 1
            weight = _num(_v(c.fields, "weight_g"))
            code = material_code(_v(c.fields, "material"))
            if weight is None or code is None:
                missing_weight += 1
                continue
            if _v(c.fields, "weight_source") in ESTIMATED_SOURCES:
                estimated += 1
            per_unit_g = weight / (_num(_v(c.fields, "units_per_pack")) or 1)
            for s in lines:
                units = max((_num(_v(s.fields, "units_placed")) or 0) - (_num(_v(s.fields, "units_exported")) or 0), 0)
                t = units * per_unit_g / 1_000_000
                tonnes[code] += t
                p_tonnes += t
                p_materials[code] += t
                if _v(s.fields, "channel") in fee_channels:
                    fee_tonnes[code] += t
                    p_fee += t * rates.get(code, rates["OT"])
        main = max(p_materials, key=p_materials.get) if p_materials else None
        by_product.append(
            {
                "sku": p.sku,
                "name": _v(p.fields, "product_name") or p.sku,
                "tonnes": round(p_tonnes, 3),
                "fee": round(p_fee, 2),
                "main_material": names[main] if main else None,
            }
        )

    total_fee = sum(fee_tonnes[m] * rates.get(m, rates["OT"]) for m in fee_tonnes)
    by_material = [
        {
            "code": m,
            "name": names[m],
            "tonnes": round(tonnes[m], 3),
            "fee_tonnes": round(fee_tonnes[m], 3),
            "rate": rates.get(m, rates["OT"]),
            "fee": round(fee_tonnes[m] * rates.get(m, rates["OT"]), 2),
            "share_pct": round(fee_tonnes[m] * rates.get(m, rates["OT"]) / total_fee * 100, 1) if total_fee else 0,
        }
        for m in sorted(tonnes, key=lambda m: -fee_tonnes[m] * rates.get(m, rates["OT"]))
    ]
    return {
        "regime": regime_id,
        "name": regime["name"],
        "currency": regime["currency"],
        "year": year,
        "years": available,
        "rates_status": regime["rates_status"],
        "rates_note": regime["rates_note"],
        "fee_channels": sorted(fee_channels),
        "total_fee": round(total_fee, 2),
        "total_tonnes": round(sum(tonnes.values()), 3),
        "fee_tonnes": round(sum(fee_tonnes.values()), 3),
        "products": len(products),
        "by_material": by_material,
        "by_product": sorted(by_product, key=lambda r: -r["fee"]),
        "data_quality": {
            "components": components,
            "missing_weight_or_material": missing_weight,
            "estimated_weights": estimated,
            "products_without_sales": without_sales,
        },
        "targets": regime.get("targets", []),
    }
