"""Screen 4: products and their packaging (components) and sales, in the caller's workspace."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.catalog import reference
from app.catalog import service as catalog
from app.catalog.fields import value as field_value
from app.core.audit import AuditEvent, record_audit
from app.core.auth import Principal, TenantDB, require_permission
from app.core.errors import ProblemError, invalid_field, invalid_fields
from app.core.permissions import Perm
from app.quality import service as quality
from app.quality.validation import check_all

router = APIRouter(prefix="/products", tags=["Products"])

SKU = re.compile(r"^[A-Z0-9-]{3,30}$")
GTIN = re.compile(r"^\d{8,14}$")


class FieldValue(BaseModel):
    dp: str | None
    value: str
    # Where the value came from: csv, erp, plm, manual, estimate or correction.
    source: str | None = None


class ComponentOut(BaseModel):
    id: str
    name: str
    level: str
    units_per_pack: float
    material: str
    polymer: str
    weight_g: float | None
    weight_source: str
    recycled_content_pct: float | None
    recyclability: str
    supplier_id: str
    fields: dict[str, FieldValue]


class SalesLineOut(BaseModel):
    id: str
    period: str
    channel: str
    units_placed: float
    units_exported: float


class ProductSummary(BaseModel):
    sku: str
    name: str
    brand: str
    gtin: str
    component_count: int
    packaging_g_per_unit: float
    materials: list[str]
    completeness_pct: int
    open_gaps: int


class ProductOut(ProductSummary):
    fields: dict[str, FieldValue]
    passport: dict[str, FieldValue]
    components: list[ComponentOut]
    sales: list[SalesLineOut]


class ComponentIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    level: Literal["Primary", "Secondary", "Transit"]
    units_per_pack: float = Field(gt=0)
    material: str = Field(min_length=1, max_length=64)
    polymer: str = Field(default="", max_length=64)
    weight_g: float = Field(ge=0)
    recycled_content_pct: float = Field(default=0, ge=0, le=100)


class ProductCreate(BaseModel):
    sku: str
    name: str = Field(min_length=1, max_length=255)
    brand: str = Field(default="", max_length=255)
    gtin: str = ""
    components: list[ComponentIn]


Reader = Annotated[Principal, Depends(require_permission(Perm.PRODUCTS_READ))]
Manager = Annotated[Principal, Depends(require_permission(Perm.PRODUCTS_MANAGE))]


@router.get("", response_model=list[ProductSummary], summary="List products")
async def list_products(
    _: Reader, db: TenantDB, q: Annotated[str | None, Query(max_length=100)] = None
) -> list[dict[str, object]]:
    products = await catalog.all_products(db)
    open_gaps = quality.open_by_sku(await quality.gaps(db, products))
    rows = [catalog.summary(p, open_gaps[p.sku]) for p in products]
    if q:
        needle = q.lower()
        rows = [r for r in rows if any(needle in str(r[k]).lower() for k in ("sku", "name", "brand", "gtin"))]
    return rows


@router.get("/{sku}", response_model=ProductOut, summary="Product with packaging and sales")
async def get_product(sku: str, _: Reader, db: TenantDB) -> dict[str, object]:
    product = await catalog.get_by_sku(db, sku)
    if product is None:
        raise ProblemError(404, "Product not found.")
    open_gaps = quality.open_by_sku(await quality.gaps(db, [product]))
    return catalog.detail(product, open_gaps[sku])


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED, summary="Add a product by hand")
async def create_product(payload: ProductCreate, principal: Manager, db: TenantDB) -> dict[str, object]:
    if not SKU.match(payload.sku):
        raise invalid_field("sku", "Use 3–30 capital letters, numbers or hyphens")
    if await catalog.get_by_sku(db, payload.sku):
        raise invalid_field("sku", "Already exists")
    if payload.gtin and not GTIN.match(payload.gtin):
        raise invalid_field("gtin", "Use 8–14 digits")
    if not payload.components:
        raise invalid_field("components", "Add at least one component")
    assert principal.tenant_id is not None  # TenantDB guarantees a workspace
    product, _ = await catalog.upsert(
        db,
        principal.tenant_id,
        payload.sku,
        product_fields={"product_name": payload.name.strip(), "brand": payload.brand.strip(), "gtin": payload.gtin},
        passport_fields={},
        components=[
            {
                "component_name": c.name,
                "packaging_level": c.level,
                "units_per_pack": _plain(c.units_per_pack),
                "material": c.material,
                "polymer": c.polymer or "n/a",
                "weight_g": _plain(c.weight_g),
                "weight_source": "Manual",
                "recycled_content_pct": _plain(c.recycled_content_pct),
            }
            for c in payload.components
        ],
        source="manual",
    )
    await record_audit(
        db,
        principal=principal,
        action="product.created",
        entity_type="product",
        entity_id=product.sku,
        after={"sku": product.sku, "components": len(product.components)},
    )
    open_gaps = quality.open_by_sku(await quality.gaps(db, [product]))
    return catalog.detail(product, open_gaps[product.sku])


def _plain(n: float) -> str:
    """2.0 → "2", 2.5 → "2.5"."""
    return str(int(n)) if float(n).is_integer() else str(n)


# --- Editing ----------------------------------------------------------------------------


class ValuesIn(BaseModel):
    """Field key -> new value; an empty value clears the field."""

    values: dict[str, str | None] = Field(max_length=200)


class Change(BaseModel):
    field: str
    label: str
    component: str | None
    before: str
    after: str


class HistoryEntry(BaseModel):
    at: datetime
    by: str | None
    action: str
    changes: list[Change]


EDITABLE_LEVELS = {"product": ("Product", "Passport"), "component": ("Component",)}


def _check(values: dict[str, str | None], scope: str) -> None:
    """Known fields of the right level only, and values the catalogue accepts."""
    fields = reference.fields()
    for key in values:
        if key not in fields or fields[key]["level"] not in EDITABLE_LEVELS[scope]:
            raise invalid_field(key, "Not a field you can edit here")
    problems = check_all(values)
    if problems:
        raise invalid_fields(
            {
                k: str(p["message"]) + (f". Did you mean {p['suggestion']}?" if p["suggestion"] else "")
                for k, p in problems.items()
            }
        )


def _diff(before: dict[str, Any], values: dict[str, str | None], component: str | None) -> list[dict[str, Any]]:
    labels = reference.fields()
    return [
        {
            "field": k,
            "label": labels.get(k, {}).get("label", k),
            "component": component,
            "before": field_value(before, k),
            "after": (v or "").strip(),
        }
        for k, v in values.items()
        if field_value(before, k) != (v or "").strip()
    ]


async def _load(db: TenantDB, sku: str) -> Any:
    product = await catalog.get_by_sku(db, sku)
    if product is None:
        raise ProblemError(404, "Product not found.")
    return product


async def _saved(db: TenantDB, product: Any, principal: Principal, changes: list[dict[str, Any]], action: str) -> Any:
    await db.flush()
    if changes:
        await record_audit(
            db,
            principal=principal,
            action=action,
            entity_type="product",
            entity_id=product.sku,
            after={"changes": changes},
        )
    open_gaps = quality.open_by_sku(await quality.gaps(db, [product]))
    return catalog.detail(product, open_gaps[product.sku])


@router.patch("/{sku}", response_model=ProductOut, summary="Edit product and passport values")
async def edit_product(sku: str, payload: ValuesIn, principal: Manager, db: TenantDB) -> Any:
    _check(payload.values, "product")
    product = await _load(db, sku)
    if "product_name" in payload.values and not (payload.values["product_name"] or "").strip():
        raise invalid_field("product_name", "Enter a name")
    changes = _diff({**product.fields, **product.passport}, payload.values, None)
    for key, raw in payload.values.items():
        catalog.assign(product, key, raw, source="manual")
    return await _saved(db, product, principal, changes, "product.edited")


@router.patch("/{sku}/components/{code}", response_model=ProductOut, summary="Edit a packaging component")
async def edit_component(sku: str, code: str, payload: ValuesIn, principal: Manager, db: TenantDB) -> Any:
    _check(payload.values, "component")
    product = await _load(db, sku)
    component = next((c for c in product.components if c.code == code), None)
    if component is None:
        raise ProblemError(404, "Component not found.")
    if "component_name" in payload.values and not (payload.values["component_name"] or "").strip():
        raise invalid_field("component_name", "Enter a name")
    changes = _diff(component.fields, payload.values, code)
    for key, raw in payload.values.items():
        catalog.assign(product, key, raw, component=code, source="manual")
    return await _saved(db, product, principal, changes, "product.component_edited")


@router.post(
    "/{sku}/components", response_model=ProductOut, status_code=status.HTTP_201_CREATED, summary="Add a component"
)
async def add_component(sku: str, payload: ValuesIn, principal: Manager, db: TenantDB) -> Any:
    _check(payload.values, "component")
    name = (payload.values.get("component_name") or "").strip()
    if not name:
        raise invalid_field("component_name", "Enter a name")
    product = await _load(db, sku)
    if any(field_value(c.fields, "component_name") == name for c in product.components):
        raise invalid_field("component_name", "This product already has a component with this name")
    assert principal.tenant_id is not None
    await catalog.upsert(
        db,
        principal.tenant_id,
        sku,
        product_fields={},
        passport_fields={},
        components=[{k: v for k, v in payload.values.items() if v}],
        source="manual",
    )
    changes = [{"field": "component_name", "label": "Component", "component": None, "before": "", "after": name}]
    return await _saved(db, product, principal, changes, "product.component_added")


@router.delete("/{sku}/components/{code}", response_model=ProductOut, summary="Remove a component")
async def remove_component(sku: str, code: str, principal: Manager, db: TenantDB) -> Any:
    product = await _load(db, sku)
    component = next((c for c in product.components if c.code == code), None)
    if component is None:
        raise ProblemError(404, "Component not found.")
    name = field_value(component.fields, "component_name")
    product.components.remove(component)
    changes = [{"field": "component_name", "label": "Component", "component": code, "before": name, "after": ""}]
    return await _saved(db, product, principal, changes, "product.component_removed")


@router.get("/{sku}/history", response_model=list[HistoryEntry], summary="Who changed what, newest first")
async def product_history(sku: str, _: Reader, db: TenantDB) -> list[HistoryEntry]:
    await _load(db, sku)
    events = await db.scalars(
        select(AuditEvent)
        .where(AuditEvent.entity_type == "product", AuditEvent.entity_id == sku)
        .order_by(AuditEvent.created_at.desc())
        .limit(100)
    )
    return [
        HistoryEntry(
            at=e.created_at,
            by=e.actor_email,
            action=e.action,
            changes=[Change(**c) for c in (e.after or {}).get("changes", [])],
        )
        for e in events
    ]
