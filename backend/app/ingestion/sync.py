"""Simulated ERP and PLM syncs (until real connectors, screen 18).

A sync reads the sample client's records and sends only the fields whose data point comes
from that system (the dictionary's ``source``), through the same mapping, review and
approval as a CSV file. ERP brings the product master and sales; PLM brings packaging specs.
Values neither system holds (supplier, manual) stay empty and show up as gaps.
"""

from __future__ import annotations

from typing import Any, Literal

from app.catalog import reference

System = Literal["erp", "plm"]

SYSTEM_NAMES: dict[str, str] = {"erp": "SAP S/4HANA", "plm": "Trace One PLM"}
# Values the simulated systems format the way real exports often do, so validation has
# something realistic to find: (sku, component id or None, field, value as exported).
EXPORT_QUIRKS: dict[str, list[tuple[str, str | None, str, str]]] = {
    "erp": [("HLA-KET-460", None, "gtin", "5790 0010 0001 1")],
    "plm": [
        ("HLA-KET-700", "HLA-KET-700-04", "weight_g", "0.21 kg"),
        ("HLA-MAYO-400", "HLA-MAYO-400-02", "material", "plastic"),
        ("HLA-BEAN-415", "HLA-BEAN-415-01", "food_contact", "yes"),
        ("HLA-SOUP-400", None, "data_carrier_url", "id.example.com/01/05790001000046"),
    ],
}

# Identifiers every system shares, so rows land on the right product and component.
KEYS = ("sku", "component_id", "product_name", "brand", "component_name", "packaging_level", "material", "weight_g")


def _source_of(key: str) -> str | None:
    dp = reference.field_dp(key)
    point = next((d for d in reference.dictionary()["data_points"] if d["code"] == dp), None) if dp else None
    return point["source"] if point else None


def _sends(key: str, system: System) -> bool:
    return key in KEYS or _source_of(key) == system


def sync_rows(system: System) -> tuple[list[str], list[list[str]], dict[str, Any]]:
    """Columns, rows (one per component) and sales lines by SKU for this system."""
    products = reference.sample_products()["products"]
    keys: list[str] = list(KEYS)
    for p in products:
        for k in [*p["fields"], *p["passport"], *(k for c in p["components"] for k in c["fields"])]:
            if k not in keys and _sends(k, system):
                keys.append(k)

    rows: list[list[str]] = []
    for p in products:
        product_values = {k: v["value"] for k, v in {**p["fields"], **p["passport"]}.items()}
        for c in p["components"]:
            values = {
                **product_values,
                **{k: v["value"] for k, v in c["fields"].items()},
                "sku": p["sku"],
                "component_id": c["id"],
            }
            for sku, component, key, exported in EXPORT_QUIRKS.get(system, []):
                if sku == p["sku"] and component in (None, c["id"]):
                    values[key] = exported
            rows.append([str(values.get(k, "")) for k in keys])

    sales: dict[str, list[dict[str, str]]] = {}
    if system == "erp":
        for p in products:
            sales[p["sku"]] = [
                {"id": s["id"], **{k: v["value"] for k, v in s["fields"].items()}} for s in p.get("sales", [])
            ]
    return keys, rows, {"sales": sales}
