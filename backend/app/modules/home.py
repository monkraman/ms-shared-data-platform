"""Home: the workspace's position on one page, calculated from the same engines as every screen.

* Fees per EPR regime (``epr.calculate``) with the share of the fee by RAM rating, and the fee
  that rests on estimated weights.
* PPWR: declarations ready, SKUs whose grade fails 2030 (``assessment``).
* Data health: stored values that are verified, estimated or flagged by validation, and gaps.
* Hotspots: the components carrying the most fee, each with its best recommendation.
* What waits for the user: corrections to apply, gaps due, declarations to review, open actions.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from app.catalog.models import Product
from app.modules import insights

RAMS = ("Green", "Amber", "Red")


def fee_card(result: dict[str, Any]) -> dict[str, Any]:
    """A regime's fee, its split by RAM rating and the part that rests on estimated weights."""
    by_ram: dict[str, float] = defaultdict(float)
    for c in result["by_component"]:
        by_ram[c.get("ram") or "Red"] += c["fee"]
    total = result["total_fee"] or 0
    return {
        "regime": result["regime"],
        "name": result["name"],
        "currency": result["currency"],
        "year": result["year"],
        "total_fee": result["total_fee"],
        "fee_tonnes": result["fee_tonnes"],
        "rates_status": result["rates_status"],
        "modulated": result["modulated"],
        "ram_share_pct": {r: round(by_ram[r] / total * 100) if total else 0 for r in RAMS},
        "fee_on_estimates": round(sum(c["fee"] for c in result["by_component"] if c["estimated"]), 2),
    }


def data_health(products: list[Product], issues: list[dict[str, Any]], gaps: list[dict[str, Any]]) -> dict[str, Any]:
    """Stored values by trust: flagged by validation, estimated, or verified (everything else)."""
    values = [
        v
        for p in products
        for v in [*p.fields.values(), *p.passport.values(), *(v for c in p.components for v in c.fields.values())]
        if v.get("dp") and str(v.get("value", "")).strip()
    ]
    filled = len(values)
    estimated = sum(1 for v in values if v.get("source") == "estimate")
    flagged = min(len(issues), filled - estimated)
    verified = filled - estimated - flagged
    open_gaps = [g for g in gaps if g["status"] == "open"]

    def pct(n: int) -> int:
        return round(n / filled * 100) if filled else 0

    return {
        "values": filled,
        "verified": verified,
        "estimated": estimated,
        "flagged": flagged,
        "verified_pct": pct(verified),
        "estimated_pct": pct(estimated),
        "flagged_pct": pct(flagged),
        "open_gaps": len(open_gaps),
        "gaps_due": sum(1 for g in open_gaps if g["phase"] in ("now", "collecting")),
    }


def hotspots(result: dict[str, Any], products: list[Product], limit: int = 4) -> list[dict[str, Any]]:
    """The components carrying the most fee, each with its largest recommendation."""
    recs: dict[str, dict[str, Any]] = {}
    for r in insights.recommendations(result, products):
        best = recs.get(r["component_id"])
        if best is None or (r["impact_value"] or 0) > (best["impact_value"] or 0):
            recs[r["component_id"]] = r
    out = []
    for c in insights.hotspots(result)["components"][:limit]:
        r = recs.get(c["component_id"])
        out.append(
            {
                "sku": c["sku"],
                "product_name": c["product_name"],
                "component_id": c["component_id"],
                "name": c["name"],
                "material": c["material"],
                "fee": c["fee"],
                "share_pct": c["share_pct"],
                "recommendation": r["title"] if r else None,
                "impact_value": r["impact_value"] if r else None,
                "impact_label": r["impact_label"] if r else None,
            }
        )
    return out
