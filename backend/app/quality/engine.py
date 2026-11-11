"""Runs the active gap rules over every product and component value.

Pure function of products and rules (same input, same gaps); ids are stable
(``<rule>:<component code or SKU>``) so a person's decision about a gap survives re-runs.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from app.catalog import reference
from app.catalog.models import FieldMap, Product
from app.quality.models import GapRule


def _fails(check: dict[str, Any], value: str, fields: FieldMap) -> bool:
    v = value.strip()
    kind = check.get("kind")
    if kind == "missing":
        return v == ""
    if kind == "in":
        return v in check.get("values", [])
    if kind == "certificate_missing":
        recycled = (fields.get("recycled_content_pct") or {}).get("value") or "0"
        try:
            has_recycled = float(recycled) > 0
        except ValueError:
            has_recycled = False
        return has_recycled and v in ("", "n/a")
    if kind == "pfas_missing":
        return (fields.get("food_contact") or {}).get("value") == "Yes" and v in ("", "n/a")
    return False


def find_gaps(products: Iterable[Product], rules: Iterable[GapRule]) -> list[dict[str, Any]]:
    labels = reference.fields()
    gaps: list[dict[str, Any]] = []
    products = list(products)
    for rule in (r for r in rules if r.active):
        on_component = reference.field_level(rule.field) == "Component"
        for p in products:
            name = (p.fields.get("product_name") or {}).get("value") or p.sku
            scopes = [(c, c.fields) for c in p.components] if on_component else [(None, {**p.fields, **p.passport})]
            for component, fields in scopes:
                # An absent field only counts for "missing" rules.
                if rule.field not in fields and rule.check.get("kind") != "missing":
                    continue
                value = str((fields.get(rule.field) or {}).get("value", ""))
                if not _fails(rule.check, value, fields):
                    continue
                gaps.append(
                    {
                        "id": f"{rule.id}:{component.code if component else p.sku}",
                        "sku": p.sku,
                        "product_name": name,
                        "component_id": component.code if component else None,
                        "component_name": (component.fields.get("component_name") or {}).get("value")
                        if component
                        else None,
                        "data_point": rule.data_point,
                        "field": rule.field,
                        "field_label": (labels.get(rule.field) or {}).get("label", rule.field),
                        "current_value": value,
                        "rule_id": rule.id,
                        "rule_name": rule.name,
                        "severity": rule.severity,
                        "modules": list(rule.modules),
                    }
                )
    return gaps
