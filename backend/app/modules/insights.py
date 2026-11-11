"""Why the EPR numbers are what they are, and what to do about them.

* Hotspots: materials, products and components that carry the fee, each with its "why".
* Recommendations (rule-based, each with its impact):
  - lightweight: a component heavier than similar ones (same kind and material; per ml of
    product when both volumes are known) by more than 20% → saving if brought to their average;
  - recyclability: limited or poor recyclability → redesign (fee at stake);
  - recycled content: plastic with 0% recycled content → PPWR targets;
  - measure: fee resting on an estimated weight → measure it (fee at stake).
"""

from __future__ import annotations

import re
from typing import Any

from app.catalog.fields import fmt
from app.catalog.models import Product

HEAVIER_BY = 1.2
KINDS = ("bottle", "cap", "lid", "label", "tray", "film", "can", "jar", "carton", "case", "sachet", "box", "pouch")
# Containers are compared per ml of product (a 700 ml bottle may weigh more than a 460 ml one).
CONTAINERS = {"bottle", "jar", "can", "pouch"}
MIN_SHARE = 0.005  # recommendations below 0.5% of the fee are noise
MIN_GRAMS = 5  # small parts (labels) are left out of recycled-content advice


def _kind(name: str) -> str | None:
    """The component's main noun: the last kind word in its name ("6-bottle case" is a case)."""
    words = re.findall(r"[a-z]+", name.lower())
    return next((w.rstrip("s") for w in reversed(words) if w.rstrip("s") in KINDS), None)


def _volumes(products: list[Product]) -> dict[str, float]:
    out = {}
    for p in products:
        raw = str((p.fields.get("container_volume_ml") or {}).get("value", "")).strip()
        try:
            if raw and float(raw) > 0:
                out[p.sku] = float(raw)
        except ValueError:
            pass
    return out


def hotspots(result: dict[str, Any]) -> dict[str, Any]:
    total = result["total_fee"] or 0
    cur = result["currency"]

    def share(fee: float) -> float:
        return round(fee / total * 100, 1) if total else 0

    components = [c for c in result["by_component"] if c["fee"] > 0][:8]
    top3 = sum(c["fee"] for c in components[:3])
    return {
        "materials": [
            {**m, "why": f"{fmt(m['fee_tonnes'])} t × {fmt(m['rate'])} {cur}/t"} for m in result["by_material"]
        ],
        "products": [{**p, "share_pct": share(p["fee"])} for p in result["by_product"][:5] if p["fee"] > 0],
        "components": [
            {
                "sku": c["sku"],
                "product_name": c["product_name"],
                "component_id": c["component_id"],
                "name": c["name"],
                "material": c["material"],
                "fee": round(c["fee"], 2),
                "share_pct": share(c["fee"]),
                "estimated": c["estimated"],
                "why": f"{fmt(c['per_unit_g'])} g × {c['fee_units'] / 1e6:,.2f}M units = {fmt(c['tonnes'])} t "
                f"at {fmt(c['rate'])} {cur}/t",
            }
            for c in components
        ],
        "top3_share_pct": share(top3),
    }


def recommendations(result: dict[str, Any], products: list[Product]) -> list[dict[str, Any]]:
    comps = [c for c in result["by_component"] if c["fee"] > 0]
    volumes = _volumes(products)
    recs: list[dict[str, Any]] = []

    for c in comps:
        kind = _kind(c["name"])
        if kind is None or c["estimated"]:
            continue
        peers = [
            p
            for p in result["by_component"]
            if p is not c
            and not p["estimated"]
            and p["material_code"] == c["material_code"]
            and _kind(p["name"]) == kind
        ]
        per_ml = (
            kind in CONTAINERS
            and c["level"] == "Primary"
            and c["sku"] in volumes
            and all(p["sku"] in volumes for p in peers)
        )

        def size(x: dict[str, Any], per_ml: bool = per_ml) -> float:
            return x["per_unit_g"] / volumes[x["sku"]] if per_ml else x["per_unit_g"]

        if not peers:
            continue
        avg = sum(size(p) for p in peers) / len(peers)
        if avg <= 0 or size(c) <= avg * HEAVIER_BY:
            continue
        target_g = c["weight_g"] * avg / size(c)
        saving = c["fee"] * (1 - avg / size(c))
        basis = f"{kind}s per ml of product" if per_ml else f"{kind}s"
        recs.append(
            {
                "id": f"lightweight:{c['component_id']}",
                "kind": "lightweight",
                "title": f"Lightweight the {c['name'].lower()} of {c['product_name']}",
                "detail": f"{fmt(c['weight_g'])} g is {round((size(c) / avg - 1) * 100)}% heavier than similar "
                f"{c['material'].lower()} {basis} ({len(peers)} compared). At their average it would weigh "
                f"{fmt(target_g)} g.",
                "impact_value": round(saving, 2),
                "impact_label": "Saving per year",
                "effort": "medium",
                "sku": c["sku"],
                "component_id": c["component_id"],
                "scenario": {"component_id": c["component_id"], "weight_g": f"{target_g:.1f}"},
            }
        )

    for c in comps:
        if c["recyclability"] in ("Limited", "Poor", "Not recyclable"):
            recs.append(
                {
                    "id": f"recyclability:{c['component_id']}",
                    "kind": "recyclability",
                    "title": f"Redesign the {c['name'].lower()} of {c['product_name']} for recycling",
                    "detail": f"Rated {c['recyclability'].lower()} recyclability. PPWR requires recyclable packaging "
                    "from 2030, and UK fees will rise for poorly recyclable packaging once fee modulation starts.",
                    "impact_value": round(c["fee"], 2),
                    "impact_label": "Fee at stake",
                    "effort": "high",
                    "sku": c["sku"],
                    "component_id": c["component_id"],
                    "scenario": None,
                }
            )
        if c["material_code"] == "PL" and c["recycled_content_pct"] == 0 and c["per_unit_g"] >= MIN_GRAMS:
            recs.append(
                {
                    "id": f"recycled:{c['component_id']}",
                    "kind": "recycled_content",
                    "title": f"Add recycled plastic to the {c['name'].lower()} of {c['product_name']}",
                    "detail": "No recycled content today. PPWR sets minimum recycled content for plastic packaging "
                    "from 2030.",
                    "impact_value": None,
                    "impact_label": None,
                    "effort": "medium",
                    "sku": c["sku"],
                    "component_id": c["component_id"],
                    "scenario": None,
                }
            )
        if c["estimated"] and c["fee"] >= MIN_SHARE * (result["total_fee"] or 0):
            recs.append(
                {
                    "id": f"measure:{c['component_id']}",
                    "kind": "measure",
                    "title": f"Measure the {c['name'].lower()} of {c['product_name']}",
                    "detail": f"The fee uses an estimated or specification weight of {fmt(c['weight_g'])} g.",
                    "impact_value": round(c["fee"], 2),
                    "impact_label": "Fee at stake",
                    "effort": "low",
                    "sku": c["sku"],
                    "component_id": c["component_id"],
                    "scenario": None,
                }
            )

    order = {"lightweight": 0, "measure": 1, "recyclability": 2, "recycled_content": 3}
    return sorted(recs, key=lambda r: (order[r["kind"]], -(r["impact_value"] or 0)))
