"""Horizon scanning: upcoming requirements for this workspace, when collection starts, and how
ready its data is. The lead time is a workspace setting (org admins)."""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.catalog.models import DataPoint, Product
from app.core.audit import record_audit
from app.core.auth import Principal, TenantDB, require_permission
from app.core.errors import ProblemError
from app.core.permissions import Perm
from app.modules import horizon
from app.quality import service as quality

router = APIRouter(prefix="/modules/horizon", tags=["Horizon scanning"])

Reader = Annotated[Principal, Depends(require_permission(Perm.COMPLIANCE_READ))]
Admin = Annotated[Principal, Depends(require_permission(Perm.SETTINGS_MANAGE))]


class PointReadiness(BaseModel):
    code: str
    name: str
    source: str
    filled: int
    total: int
    coverage_pct: int


class Milestone(BaseModel):
    id: str
    date: date
    title: str
    regulation: str
    note: str
    status: Literal["now", "collecting", "upcoming"]
    collect_from: date
    days_until: int
    coverage_pct: int
    open_gaps: int
    data_points: list[PointReadiness]


class Horizon(BaseModel):
    today: date
    lead_months: int
    milestones: list[Milestone]


class HorizonSettings(BaseModel):
    lead_months: int = Field(ge=0, le=24)


def _coverage(products: list[Product], codes: set[str]) -> dict[str, tuple[int, int]]:
    counts: dict[str, list[int]] = {c: [0, 0] for c in codes}
    for p in products:
        maps = [p.fields, p.passport, *(c.fields for c in p.components)]
        for fields in maps:
            for v in fields.values():
                dp = v.get("dp")
                if dp in counts:
                    counts[dp][1] += 1
                    if str(v.get("value", "")).strip():
                        counts[dp][0] += 1
    return {k: (f, t) for k, (f, t) in counts.items()}


async def _build(db: TenantDB) -> Horizon:
    tenant = await quality.current_tenant(db)
    if tenant is None:
        raise ProblemError(403, "Choose a workspace first.")
    lead = tenant.horizon_lead_months
    today = date.today()
    points = [
        {"code": d.code, "name": d.name, "source": d.source, "applies_from": d.applies_from}
        for d in (await db.scalars(select(DataPoint).order_by(DataPoint.code))).all()
    ]
    products = list((await db.scalars(select(Product))).all())
    gaps = [g for g in await quality.gaps(db, products) if g["status"] != "resolved"]
    modules, countries = set(tenant.modules), set(tenant.countries)

    out = []
    for m in horizon.reference()["milestones"]:
        if not horizon.in_scope(m, modules, countries):
            continue
        applies = horizon.parse_date(m["date"])
        assert applies is not None
        mine = horizon.milestone_points(m, points)
        codes = {p["code"] for p in mine}
        cov = _coverage(products, codes)
        filled = sum(cov[c][0] for c in codes)
        total = sum(cov[c][1] for c in codes)
        out.append(
            Milestone(
                id=m["id"],
                date=applies,
                title=m["title"],
                regulation=m["regulation"],
                note=m["note"],
                status=horizon.phase(applies, lead, today),
                collect_from=horizon.collect_from(applies, lead),
                days_until=(applies - today).days,
                coverage_pct=round(filled / total * 100) if total else 0,
                open_gaps=sum(1 for g in gaps if g["data_point"] in codes),
                data_points=[
                    PointReadiness(
                        code=p["code"],
                        name=p["name"],
                        source=p["source"],
                        filled=cov[p["code"]][0],
                        total=cov[p["code"]][1],
                        coverage_pct=round(cov[p["code"]][0] / cov[p["code"]][1] * 100) if cov[p["code"]][1] else 0,
                    )
                    for p in mine
                ],
            )
        )
    return Horizon(today=today, lead_months=lead, milestones=sorted(out, key=lambda x: x.date))


@router.get("", response_model=Horizon, summary="Upcoming requirements and data readiness")
async def get_horizon(_: Reader, db: TenantDB) -> Horizon:
    return await _build(db)


@router.put("/settings", response_model=Horizon, summary="Set the lead time for data collection")
async def set_lead_time(payload: HorizonSettings, principal: Admin, db: TenantDB) -> Horizon:
    tenant = await quality.current_tenant(db)
    if tenant is None:
        raise ProblemError(403, "Choose a workspace first.")
    before = tenant.horizon_lead_months
    tenant.horizon_lead_months = payload.lead_months
    await db.flush()
    await record_audit(
        db,
        principal=principal,
        action="workspace.horizon_lead_changed",
        entity_type="tenant",
        entity_id=tenant.id,
        before={"lead_months": before},
        after={"lead_months": payload.lead_months},
    )
    return await _build(db)
