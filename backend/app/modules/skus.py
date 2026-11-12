"""The SKU library's calculated columns: fee per regime, RAM rating, PPWR grade, markets, status.

Fees come from the same engine as the Compliance screen (``epr.calculate``), for each EPR regime
the workspace covers, in the regime's currency (fees in different currencies are not added up).
"""

from __future__ import annotations

from collections import Counter
from typing import Any

from app.catalog.models import Product
from app.modules import assessment, epr
from app.platform.models import Tenant


def assess(
    products: list[Product], tenant: Tenant | None, open_gaps: Counter[str], year: str | None = None
) -> dict[str, dict[str, Any]]:
    """SKU → its assessment (see ``assessment.product``)."""
    modules = set(tenant.modules) if tenant else set()
    ppwr = not modules or "PPWR" in modules
    countries = list(tenant.countries) if tenant else []
    fees: dict[str, list[dict[str, Any]]] = {p.sku: [] for p in products}
    for rid, regime in epr.regimes().items():
        if regime["kind"] != "epr" or not epr.in_scope(regime, tenant):
            continue
        result = epr.calculate(rid, products, year)
        for row in result["by_product"]:
            fees[row["sku"]].append(
                {
                    "regime": rid,
                    "name": regime["name"],
                    "currency": regime["currency"],
                    "year": result["year"],
                    "fee": row["fee"],
                    "tonnes": row["tonnes"],
                }
            )
    return {
        p.sku: assessment.product(
            p, workspace_countries=countries, ppwr=ppwr, fees=fees[p.sku], open_gaps=open_gaps[p.sku]
        )
        for p in products
    }
