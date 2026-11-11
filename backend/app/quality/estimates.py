"""Proposed values for estimable gaps, with the basis a person can check.

* ``similar_average``: the average of the same field on the workspace's other components of
  the same material and packaging level (then the same material), using recorded values
  (not other estimates); no similar component → no estimate (the gap then needs data).
* ``fixed``: the rule's value (for example 0% recycled content, the conservative choice).
"""

from __future__ import annotations

from typing import Any

from app.catalog.fields import ESTIMATE_SOURCES, fmt, number, value
from app.catalog.models import Component, Product


def _measured(c: Component, field: str) -> float | None:
    if field == "weight_g" and value(c.fields, "weight_source") in ESTIMATE_SOURCES:
        return None
    return number(value(c.fields, field))


def propose(
    estimate: dict[str, Any] | None, field: str, component: Component | None, products: list[Product]
) -> dict[str, str] | None:
    if not estimate:
        return None
    method = estimate.get("method")
    if method == "fixed":
        return {"value": str(estimate.get("value", "")), "method": "fixed", "basis": "Default value"}
    if method != "similar_average" or component is None:
        return None

    material = value(component.fields, "material")
    level = value(component.fields, "packaging_level")
    others = [c for p in products for c in p.components if c is not component]
    for scope, label in (
        ([c for c in others if value(c.fields, "material") == material and value(c.fields, "packaging_level") == level],
         f"{material} {level.lower()}"),
        ([c for c in others if value(c.fields, "material") == material], material),
    ):  # fmt: skip
        values = [v for c in scope if (v := _measured(c, field)) is not None]
        if values and material:
            avg = sum(values) / len(values)
            noun = "component" if len(values) == 1 else "components"
            return {
                "value": fmt(avg),
                "method": "similar_average",
                "basis": f"Average of {len(values)} {label} {noun}",
            }
    return None
