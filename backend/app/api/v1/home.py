"""Home: the workspace's position on one page (fees, PPWR, data health, hotspots, what waits)."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select

from app.catalog import service as catalog
from app.core.auth import Principal, TenantDB, require_permission
from app.core.permissions import Perm
from app.modules import epr, home, ppwr_doc, skus
from app.modules.models import ActionItem
from app.platform.repository import current_tenant
from app.quality import service as quality
from app.quality.validation import issues

router = APIRouter(prefix="/home", tags=["Home"])
Reader = Annotated[Principal, Depends(require_permission(Perm.PRODUCTS_READ))]


class RamShare(BaseModel):
    Green: int
    Amber: int
    Red: int


class FeeCard(BaseModel):
    regime: str
    name: str
    currency: str
    year: str | None
    total_fee: float
    fee_tonnes: float
    rates_status: Literal["published", "placeholder"]
    modulated: bool
    ram_share_pct: RamShare
    fee_on_estimates: float


class PpwrCard(BaseModel):
    declarations_ready: int
    declarations_total: int
    skus_in_eu: int
    fails_2030: int
    recycled_misses: int


class DataHealth(BaseModel):
    values: int
    verified: int
    estimated: int
    flagged: int
    verified_pct: int
    estimated_pct: int
    flagged_pct: int
    open_gaps: int
    gaps_due: int


class Hotspot(BaseModel):
    sku: str
    product_name: str
    component_id: str
    name: str
    material: str
    fee: float
    share_pct: float
    recommendation: str | None
    impact_value: float | None
    impact_label: str | None


class Saving(BaseModel):
    currency: str
    amount: float
    actions: int


class Waiting(BaseModel):
    key: Literal["corrections", "gaps", "declarations", "actions"]
    label: str
    count: int
    link: str


class HomeOut(BaseModel):
    skus: int
    fees: list[FeeCard]
    hotspots_currency: str | None
    hotspots: list[Hotspot]
    ppwr: PpwrCard | None
    data_health: DataHealth
    savings: list[Saving]
    waiting: list[Waiting]


@router.get("", response_model=HomeOut, summary="The workspace on one page")
async def get_home(principal: Reader, db: TenantDB) -> dict[str, object]:
    products = await catalog.all_products(db)
    tenant = await current_tenant(db)
    modules = set(tenant.modules) if tenant and tenant.modules else {"EPR", "PPWR", "DPP", "LCA"}

    results = {
        rid: epr.calculate(rid, products, None)
        for rid, r in epr.regimes().items()
        if r["kind"] == "epr" and "EPR" in modules and epr.in_scope(r, tenant)
    }
    gaps = await quality.gaps(db, products)
    flagged = issues(products)

    ppwr = None
    declarations_ready = 0
    if "PPWR" in modules:
        rows = [ppwr_doc.readiness(p) for p in products]
        declarations_ready = sum(1 for r in rows if r["status"] == "ready")
        assessed = skus.assess(products, tenant, quality.open_by_sku(gaps)).values()
        in_eu = [a for a in assessed if a["ppwr_in_scope"]]
        ppwr = {
            "declarations_ready": declarations_ready,
            "declarations_total": len(rows),
            "skus_in_eu": len(in_eu),
            "fails_2030": sum(1 for a in in_eu if a["grade"] in ("D", "E")),
            "recycled_misses": sum(1 for a in in_eu if a["recycled_target_misses"]),
        }

    actions = (await db.scalars(select(ActionItem).where(ActionItem.status != "done"))).all()
    savings: dict[str, dict[str, float]] = {}
    for a in actions:
        if a.impact_value and a.currency and a.impact_label == "Saving per year":
            s = savings.setdefault(a.currency, {"amount": 0.0, "actions": 0})
            s["amount"] += a.impact_value
            s["actions"] += 1

    health = home.data_health(products, flagged, gaps)
    corrections = sum(1 for i in flagged if i["suggestion"])
    waiting = [
        {"key": "corrections", "label": "Corrections to apply", "count": corrections, "link": "/app/validation"},
        {"key": "gaps", "label": "Data gaps due", "count": health["gaps_due"], "link": "/app/gaps"},
        {
            "key": "declarations",
            "label": "Declarations ready to review",
            "count": declarations_ready,
            "link": "/app/compliance",
        },
        {"key": "actions", "label": "Open actions", "count": len(actions), "link": "/app/actions"},
    ]
    first = next(iter(results.values()), None)
    return {
        "skus": len(products),
        "fees": [home.fee_card(r) for r in results.values()],
        "hotspots_currency": first["currency"] if first else None,
        "hotspots": home.hotspots(first, products) if first else [],
        "ppwr": ppwr,
        "data_health": health,
        "savings": [
            {"currency": c, "amount": round(v["amount"], 2), "actions": int(v["actions"])} for c, v in savings.items()
        ],
        "waiting": [w for w in waiting if w["count"]],
    }
