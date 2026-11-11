"""Screen 14 (first part): hotspots, recommendations, scenarios and action items.

* ``GET /modules/epr/{regime}/insights``: hotspots with their "why" and recommendations with
  their impact (and the action item each has become, if any).
* ``POST /modules/epr/{regime}/scenario``: the fee with changed weights or materials, next to
  today's; nothing is saved.
* ``/actions``: action items with owner, due date and status.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.catalog import service as catalog
from app.core.audit import record_audit
from app.core.auth import Principal, TenantDB, require_permission
from app.core.errors import ProblemError
from app.core.permissions import Perm
from app.modules import epr, insights
from app.modules.models import ActionItem

router = APIRouter(tags=["Insights"])

Reader = Annotated[Principal, Depends(require_permission(Perm.COMPLIANCE_READ))]
EprModule = Annotated[Principal, Depends(require_permission(Perm.MODULE_EPR))]
Actor = Annotated[Principal, Depends(require_permission(Perm.ACTIONS_MANAGE))]
EprRegime = Literal["epr_uk", "epr_dk", "sb54_ca"]
ActionStatus = Literal["open", "in_progress", "done"]
RecKind = Literal["lightweight", "recyclability", "recycled_content", "measure"]


class MaterialHotspot(BaseModel):
    code: str
    name: str
    fee: float
    share_pct: float
    why: str


class ProductHotspot(BaseModel):
    sku: str
    name: str
    fee: float
    share_pct: float
    main_material: str | None


class ComponentHotspot(BaseModel):
    sku: str
    product_name: str
    component_id: str
    name: str
    material: str
    fee: float
    share_pct: float
    estimated: bool
    why: str


class Hotspots(BaseModel):
    materials: list[MaterialHotspot]
    products: list[ProductHotspot]
    components: list[ComponentHotspot]
    top3_share_pct: float


class ScenarioChange(BaseModel):
    component_id: str = Field(max_length=80)
    weight_g: str | None = Field(default=None, max_length=16)
    material: str | None = Field(default=None, max_length=64)


class Recommendation(BaseModel):
    id: str
    kind: RecKind
    title: str
    detail: str
    impact_value: float | None
    impact_label: str | None
    effort: Literal["low", "medium", "high"]
    sku: str
    component_id: str
    scenario: ScenarioChange | None
    action_id: uuid.UUID | None


class Insights(BaseModel):
    regime: str
    name: str
    currency: str
    year: str | None
    total_fee: float
    hotspots: Hotspots
    recommendations: list[Recommendation]


class ScenarioRequest(BaseModel):
    year: str | None = None
    changes: list[ScenarioChange] = Field(max_length=200)


class ScenarioLine(BaseModel):
    component_id: str
    name: str
    product_name: str
    before: str
    after: str
    fee_before: float
    fee_after: float


class ScenarioResult(BaseModel):
    currency: str
    year: str | None
    baseline_fee: float
    scenario_fee: float
    delta: float
    delta_pct: float
    lines: list[ScenarioLine]


class ActionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    detail: str = Field(default="", max_length=4000)
    recommendation_id: str | None = Field(default=None, max_length=160)
    kind: str = Field(default="manual", max_length=32)
    regime: str | None = Field(default=None, max_length=16)
    sku: str | None = Field(default=None, max_length=64)
    impact_value: float | None = None
    impact_label: str | None = Field(default=None, max_length=64)
    currency: str | None = Field(default=None, max_length=3)
    owner: str = Field(default="", max_length=255)
    due_date: date | None = None


class ActionPatch(BaseModel):
    status: ActionStatus | None = None
    owner: str | None = Field(default=None, max_length=255)
    due_date: date | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)


class ActionOut(BaseModel):
    id: uuid.UUID
    title: str
    detail: str
    recommendation_id: str | None
    kind: str
    regime: str | None
    sku: str | None
    impact_value: float | None
    impact_label: str | None
    currency: str | None
    owner: str
    due_date: date | None
    status: ActionStatus
    created_at: datetime


def _action_out(a: ActionItem) -> ActionOut:
    return ActionOut.model_validate(a, from_attributes=True)


@router.get("/modules/epr/{regime}/insights", response_model=Insights, summary="Hotspots and recommendations")
async def get_insights(
    regime: EprRegime, _: EprModule, db: TenantDB, year: Annotated[str | None, Query(max_length=8)] = None
) -> dict[str, Any]:
    products = await catalog.all_products(db)
    result = epr.calculate(regime, products, year)
    actions = {
        a.recommendation_id: a.id
        for a in (await db.scalars(select(ActionItem).where(ActionItem.recommendation_id.is_not(None)))).all()
    }
    recs = [{**r, "action_id": actions.get(r["id"])} for r in insights.recommendations(result, products)]
    return {
        "regime": regime,
        "name": result["name"],
        "currency": result["currency"],
        "year": result["year"],
        "total_fee": result["total_fee"],
        "hotspots": insights.hotspots(result),
        "recommendations": recs,
    }


@router.post("/modules/epr/{regime}/scenario", response_model=ScenarioResult, summary="What-if fee (not saved)")
async def run_scenario(regime: EprRegime, payload: ScenarioRequest, _: EprModule, db: TenantDB) -> ScenarioResult:
    products = await catalog.all_products(db)
    overrides = {
        c.component_id: {k: v for k, v in (("weight_g", c.weight_g), ("material", c.material)) if v}
        for c in payload.changes
    }
    base = epr.calculate(regime, products, payload.year)
    new = epr.calculate(regime, products, payload.year, overrides)
    before = {c["component_id"]: c for c in base["by_component"]}
    after = {c["component_id"]: c for c in new["by_component"]}
    lines = []
    for cid in overrides:
        if cid not in before and cid not in after:
            continue
        b, a = before.get(cid), after.get(cid)
        ref = a or b
        assert ref is not None
        lines.append(
            ScenarioLine(
                component_id=cid,
                name=ref["name"],
                product_name=ref["product_name"],
                before=f"{b['weight_g']:g} g {b['material']}" if b else "—",
                after=f"{a['weight_g']:g} g {a['material']}" if a else "—",
                fee_before=round(b["fee"], 2) if b else 0,
                fee_after=round(a["fee"], 2) if a else 0,
            )
        )
    delta = new["total_fee"] - base["total_fee"]
    return ScenarioResult(
        currency=base["currency"],
        year=base["year"],
        baseline_fee=base["total_fee"],
        scenario_fee=new["total_fee"],
        delta=round(delta, 2),
        delta_pct=round(delta / base["total_fee"] * 100, 1) if base["total_fee"] else 0,
        lines=lines,
    )


@router.get("/actions", response_model=list[ActionOut], summary="Action items")
async def list_actions(_: Reader, db: TenantDB) -> list[ActionOut]:
    rows = await db.scalars(select(ActionItem).order_by(ActionItem.status, ActionItem.created_at.desc()))
    return [_action_out(a) for a in rows]


@router.post("/actions", response_model=ActionOut, status_code=status.HTTP_201_CREATED, summary="Add an action item")
async def create_action(payload: ActionCreate, principal: Actor, db: TenantDB) -> ActionOut:
    if payload.recommendation_id:
        existing = await db.scalar(select(ActionItem).where(ActionItem.recommendation_id == payload.recommendation_id))
        if existing:
            return _action_out(existing)
    assert principal.tenant_id is not None
    item = ActionItem(tenant_id=principal.tenant_id, created_by=principal.user_id, **payload.model_dump())
    db.add(item)
    await db.flush()
    await db.refresh(item)
    await record_audit(
        db,
        principal=principal,
        action="action.created",
        entity_type="action_item",
        entity_id=item.id,
        after={"title": item.title, "recommendation": item.recommendation_id},
    )
    return _action_out(item)


@router.patch("/actions/{action_id}", response_model=ActionOut, summary="Update owner, due date or status")
async def update_action(action_id: uuid.UUID, payload: ActionPatch, principal: Actor, db: TenantDB) -> ActionOut:
    item = await db.get(ActionItem, action_id)
    if item is None:
        raise ProblemError(404, "Action not found.")
    before = {"status": item.status, "owner": item.owner, "due_date": item.due_date}
    for key, value in payload.model_dump(exclude_unset=True).items():
        if value is not None or key == "due_date":
            setattr(item, key, value)
    await db.flush()
    await db.refresh(item)
    await record_audit(
        db,
        principal=principal,
        action="action.updated",
        entity_type="action_item",
        entity_id=item.id,
        before=before,
        after={"status": item.status, "owner": item.owner, "due_date": item.due_date},
    )
    return _action_out(item)
