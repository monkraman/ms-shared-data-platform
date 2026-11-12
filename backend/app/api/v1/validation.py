"""Demo step 4: data validation. Flags values the field catalogue does not accept, suggests the
correction, applies corrections, and lists them per source system so they can be fixed there
too (one source of truth).

* ``GET /validation``: every invalid stored value in the workspace, with its suggestion.
* ``POST /validation/apply``: write the suggested values (all, or the chosen ones).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.catalog import reference
from app.catalog import service as catalog
from app.catalog.fields import value
from app.catalog.models import FieldMap, Product
from app.core.audit import record_audit
from app.core.auth import Principal, TenantDB, require_permission
from app.core.permissions import Perm
from app.quality.validation import check

router = APIRouter(prefix="/validation", tags=["Validation"])

SOURCE_NAMES = {"csv": "File import", "erp": "ERP", "plm": "PLM", "manual": "Manual", "estimate": "Estimate"}


class Issue(BaseModel):
    id: str
    sku: str
    product_name: str
    component_id: str | None
    component_name: str | None
    field: str
    field_label: str
    data_point: str | None
    value: str
    message: str
    suggestion: str | None
    source: str | None
    source_name: str


class ApplyIn(BaseModel):
    ids: list[str] | None = Field(default=None, description="Only these issues; all with a suggestion if absent")


class ApplyResult(BaseModel):
    applied: int
    skipped: int


def _issues(products: list[Product]) -> list[dict[str, object]]:
    labels = reference.fields()
    out: list[dict[str, object]] = []

    def scan(p: Product, fields: FieldMap, component: str | None, component_name: str | None) -> None:
        for key, stored in fields.items():
            problem = check(key, stored.get("value"))
            if problem is None:
                continue
            source = stored.get("source")
            out.append(
                {
                    "id": f"{p.sku}|{component or ''}|{key}",
                    "sku": p.sku,
                    "product_name": value(p.fields, "product_name") or p.sku,
                    "component_id": component,
                    "component_name": component_name,
                    "field": key,
                    "field_label": labels.get(key, {}).get("label", key),
                    "data_point": stored.get("dp"),
                    "value": str(stored.get("value", "")),
                    "message": problem["message"],
                    "suggestion": problem["suggestion"],
                    "source": source,
                    "source_name": SOURCE_NAMES.get(source or "", "Unknown"),
                }
            )

    for p in products:
        scan(p, {**p.fields, **p.passport}, None, None)
        for c in p.components:
            scan(p, c.fields, c.code, value(c.fields, "component_name"))
    return out


@router.get("", response_model=list[Issue], summary="Invalid values with suggested corrections")
async def list_issues(
    _: Annotated[Principal, Depends(require_permission(Perm.PRODUCTS_READ))], db: TenantDB
) -> list[dict[str, object]]:
    return _issues(await catalog.all_products(db))


@router.post("/apply", response_model=ApplyResult, summary="Apply suggested corrections")
async def apply_suggestions(
    payload: ApplyIn,
    principal: Annotated[Principal, Depends(require_permission(Perm.PRODUCTS_MANAGE))],
    db: TenantDB,
) -> ApplyResult:
    products = await catalog.all_products(db)
    by_sku = {p.sku: p for p in products}
    wanted = set(payload.ids) if payload.ids is not None else None
    applied = []
    for issue in _issues(products):
        if issue["suggestion"] is None or (wanted is not None and issue["id"] not in wanted):
            continue
        product = by_sku[str(issue["sku"])]
        component = issue["component_id"]
        catalog.assign(
            product,
            str(issue["field"]),
            issue["suggestion"],
            component=str(component) if component else None,
            source="correction",
        )
        applied.append({k: issue[k] for k in ("sku", "component_id", "field", "value", "suggestion", "source")})
    await db.flush()
    if applied:
        await record_audit(
            db,
            principal=principal,
            action="validation.corrected",
            entity_type="product",
            entity_id=f"{len(applied)} values",
            after={"corrections": applied},
        )
    skipped = len(wanted) - len(applied) if wanted is not None else 0
    return ApplyResult(applied=len(applied), skipped=max(skipped, 0))
