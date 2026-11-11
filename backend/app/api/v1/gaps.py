"""Screens 6–8: the gap rule library (platform admins), each workspace's gaps, and data coverage."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.catalog import reference
from app.catalog import service as catalog
from app.catalog.models import DataPoint, Product
from app.core.audit import record_audit
from app.core.auth import PlatformDB, Principal, TenantDB, require_permission
from app.core.errors import ProblemError
from app.core.permissions import Perm
from app.platform.reference import COUNTRY_CODES, ModuleId
from app.quality import service as quality
from app.quality.models import GapRule, GapState

router = APIRouter(tags=["Gaps"])

Severity = Literal["blocker", "warning"]
GapStatus = Literal["open", "requested", "resolved"]
SourceId = Literal["erp", "supplier", "plm", "man"]


# --- Schemas ------------------------------------------------------------------------


class RuleCheck(BaseModel):
    kind: Literal["missing", "in", "certificate_missing", "pfas_missing"]
    values: list[str] | None = None


class GapRuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    data_point: str = Field(max_length=8)
    field: str = Field(max_length=64)
    check: RuleCheck
    severity: Severity
    modules: list[ModuleId]
    countries: list[str] = Field(default_factory=list)


class GapRuleOut(GapRuleCreate):
    id: str
    active: bool


class GapRulePatch(BaseModel):
    active: bool | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    severity: Severity | None = None
    modules: list[ModuleId] | None = None
    countries: list[str] | None = None


class GapOut(BaseModel):
    id: str
    sku: str
    product_name: str
    component_id: str | None
    component_name: str | None
    data_point: str
    field: str
    field_label: str
    current_value: str
    rule_id: str
    rule_name: str
    severity: Severity
    modules: list[ModuleId]
    status: GapStatus


class GapResolve(BaseModel):
    action: Literal["set_value", "request_supplier", "accept_estimate"]
    value: str | None = Field(default=None, max_length=1000)
    note: str | None = Field(default=None, max_length=2000)


class DataPointCoverage(BaseModel):
    code: str
    name: str
    source: SourceId
    filled: int
    estimated: int
    missing: int
    total: int


class SourceCoverage(BaseModel):
    source: SourceId
    name: str
    coverage_pct: int


class DataOverview(BaseModel):
    products: int
    components: int
    readiness_pct: int
    open_blockers: int
    open_warnings: int
    by_source: list[SourceCoverage]
    data_points: list[DataPointCoverage]


def _invalid(field: str, msg: str) -> ProblemError:
    return ProblemError(
        422, "The request has invalid fields.", extra={"errors": [{"loc": ["body", field], "msg": msg}]}
    )


def _rule_out(r: GapRule) -> GapRuleOut:
    return GapRuleOut(
        id=r.id,
        name=r.name,
        data_point=r.data_point,
        field=r.field,
        check=RuleCheck(**r.check),
        severity=r.severity,
        modules=list(r.modules),
        countries=list(r.countries),
        active=r.active,
    )


# --- Screen 6: gap rules ------------------------------------------------------------

RuleManager = Annotated[Principal, Depends(require_permission(Perm.PLATFORM_RULES_MANAGE))]


@router.get("/admin/gap-rules", response_model=list[GapRuleOut], summary="Gap rule library")
async def list_rules(_: RuleManager, db: PlatformDB) -> list[GapRuleOut]:
    return [_rule_out(r) for r in (await db.scalars(select(GapRule).order_by(GapRule.id))).all()]


@router.post(
    "/admin/gap-rules", response_model=GapRuleOut, status_code=status.HTTP_201_CREATED, summary="Add a gap rule"
)
async def create_rule(payload: GapRuleCreate, principal: RuleManager, db: PlatformDB) -> GapRuleOut:
    if payload.field not in reference.fields():
        raise _invalid("field", "Choose a field")
    if await db.get(DataPoint, payload.data_point) is None:
        raise _invalid("data_point", "Choose a data point")
    if payload.check.kind == "in" and not payload.check.values:
        raise _invalid("check", "List the values that count as a gap")
    if not payload.modules:
        raise _invalid("modules", "Choose at least one module")
    if any(c not in COUNTRY_CODES for c in payload.countries):
        raise _invalid("countries", "Choose a supported country")
    last = await db.scalar(select(func.max(GapRule.id)))
    next_number = int(last.split("-")[1]) + 1 if last else 1
    rule = GapRule(
        id=f"GR-{next_number:03d}",
        name=payload.name.strip(),
        data_point=payload.data_point,
        field=payload.field,
        check=payload.check.model_dump(exclude_none=True),
        severity=payload.severity,
        modules=payload.modules,
        countries=payload.countries,
        active=True,
    )
    db.add(rule)
    await db.flush()
    await record_audit(
        db,
        principal=principal,
        action="gap_rule.created",
        entity_type="gap_rule",
        entity_id=rule.id,
        after=payload.model_dump(),
    )
    return _rule_out(rule)


@router.patch("/admin/gap-rules/{rule_id}", response_model=GapRuleOut, summary="Edit or switch a gap rule")
async def update_rule(rule_id: str, payload: GapRulePatch, principal: RuleManager, db: PlatformDB) -> GapRuleOut:
    rule = await db.get(GapRule, rule_id)
    if rule is None:
        raise ProblemError(404, "Rule not found.")
    before = _rule_out(rule).model_dump()
    for key, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(rule, key, value)
    await db.flush()
    await record_audit(
        db,
        principal=principal,
        action="gap_rule.updated",
        entity_type="gap_rule",
        entity_id=rule.id,
        before=before,
        after=_rule_out(rule).model_dump(),
    )
    return _rule_out(rule)


# --- Screen 7: gaps -----------------------------------------------------------------


@router.get("/gaps", response_model=list[GapOut], summary="Gaps in this workspace")
async def list_gaps(
    _: Annotated[Principal, Depends(require_permission(Perm.GAPS_READ))],
    db: TenantDB,
    status_: Annotated[GapStatus | None, Query(alias="status")] = None,
    severity: Severity | None = None,
) -> list[dict[str, object]]:
    return [
        g
        for g in await quality.gaps(db)
        if (not status_ or g["status"] == status_) and (not severity or g["severity"] == severity)
    ]


@router.post("/gaps/{gap_id}/resolve", response_model=GapOut, summary="Fix a gap, ask a supplier or accept it")
async def resolve_gap(
    gap_id: str,
    payload: GapResolve,
    principal: Annotated[Principal, Depends(require_permission(Perm.GAPS_RESOLVE))],
    db: TenantDB,
) -> dict[str, object]:
    gap = next((g for g in await quality.gaps(db) if g["id"] == gap_id), None)
    if gap is None:
        raise ProblemError(404, "Gap not found.")

    if payload.action == "set_value":
        value = (payload.value or "").strip()
        if not value:
            raise _invalid("value", "Enter a value")
        product = await catalog.get_by_sku(db, gap["sku"])
        assert product is not None
        if gap["component_id"]:
            component = next(c for c in product.components if c.code == gap["component_id"])
            component.fields = catalog.merge(component.fields, {gap["field"]: value})
        elif reference.field_level(gap["field"]) == "Passport":
            product.passport = catalog.merge(product.passport, {gap["field"]: value})
        else:
            product.fields = catalog.merge(product.fields, {gap["field"]: value})
        new_status = "resolved"
    else:
        new_status = "requested" if payload.action == "request_supplier" else "resolved"

    assert principal.tenant_id is not None
    state = await db.scalar(select(GapState).where(GapState.gap_id == gap_id))
    if state is None:
        state = GapState(tenant_id=principal.tenant_id, gap_id=gap_id, status=new_status)
        db.add(state)
    state.status, state.note, state.updated_by = new_status, payload.note, principal.user_id
    await db.flush()
    await record_audit(
        db,
        principal=principal,
        action=f"gap.{payload.action}",
        entity_type="gap",
        entity_id=gap_id,
        before={"value": gap["current_value"], "status": gap["status"]},
        after={"value": payload.value, "status": new_status, "note": payload.note},
    )
    return {**gap, "status": new_status, "current_value": (payload.value or gap["current_value"])}


# --- Screen 8: data overview ----------------------------------------------------------


@router.get("/data-overview", response_model=DataOverview, summary="How complete the workspace's data is")
async def data_overview(
    _: Annotated[Principal, Depends(require_permission(Perm.DATA_READ))], db: TenantDB
) -> DataOverview:
    products = list((await db.scalars(select(Product))).all())
    points = list((await db.scalars(select(DataPoint).order_by(DataPoint.code))).all())

    values: list[tuple[str, str, bool]] = []  # (dp, value, estimated)
    for p in products:
        for v in [*p.fields.values(), *p.passport.values()]:
            if v.get("dp"):
                values.append((v["dp"], str(v.get("value", "")), False))
        for c in p.components:
            source = (c.fields.get("weight_source") or {}).get("value")
            for key, v in c.fields.items():
                if v.get("dp"):
                    estimated = key == "weight_g" and source in ("Spec", "Estimated")
                    values.append((v["dp"], str(v.get("value", "")), estimated))

    coverage = []
    for d in points:
        mine = [(val, est) for dp, val, est in values if dp == d.code]
        filled = [(val, est) for val, est in mine if val.strip()]
        estimated = sum(1 for _, est in filled if est)
        coverage.append(
            DataPointCoverage(
                code=d.code,
                name=d.name,
                source=d.source,
                filled=len(filled) - estimated,
                estimated=estimated,
                missing=len(mine) - len(filled),
                total=len(mine),
            )
        )

    def pct(items: list[DataPointCoverage]) -> int:
        total = sum(c.total for c in items)
        return round(sum(c.filled for c in items) / total * 100) if total else 0

    tracked = [c for c in coverage if c.total]
    open_gaps = [g for g in await quality.gaps(db, products) if g["status"] != "resolved"]
    sources = reference.dictionary()["sources"]
    return DataOverview(
        products=len(products),
        components=sum(len(p.components) for p in products),
        readiness_pct=pct(tracked),
        open_blockers=sum(1 for g in open_gaps if g["severity"] == "blocker"),
        open_warnings=sum(1 for g in open_gaps if g["severity"] == "warning"),
        by_source=[
            SourceCoverage(source=s, name=name, coverage_pct=pct([c for c in tracked if c.source == s]))
            for s, name in sources.items()
        ],
        data_points=coverage,
    )
