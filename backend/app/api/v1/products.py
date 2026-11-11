"""Screen 4: products and their packaging (components) and sales, in the caller's workspace."""

from __future__ import annotations

import re
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field

from app.catalog import service as catalog
from app.core.audit import record_audit
from app.core.auth import Principal, TenantDB, require_permission
from app.core.errors import ProblemError, invalid_field
from app.core.permissions import Perm
from app.quality import service as quality

router = APIRouter(prefix="/products", tags=["Products"])

SKU = re.compile(r"^[A-Z0-9-]{3,30}$")
GTIN = re.compile(r"^\d{8,14}$")


class FieldValue(BaseModel):
    dp: str | None
    value: str


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
