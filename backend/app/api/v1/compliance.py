"""Screen 12–13 (first part): compliance results on the workspace's own data.

* ``GET /modules/regimes``: the regimes this workspace covers (by its modules and countries).
* ``GET /modules/epr/{regime}``: EPR fees by material and product for a year (UK, DK, SB 54).
* ``GET /modules/ppwr/declarations``: PPWR declaration readiness per product.
* ``GET /modules/ppwr/declarations/{sku}?lang=da``: the declaration itself, in Danish or English.

Paths sit under ``/modules`` because the prototype still owns ``/compliance``.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.catalog import service as catalog
from app.core.auth import Principal, TenantDB, require_permission
from app.core.errors import ProblemError
from app.core.permissions import Perm
from app.modules import epr, ppwr_doc
from app.platform.repository import current_tenant

router = APIRouter(prefix="/modules", tags=["Compliance"])

Reader = Annotated[Principal, Depends(require_permission(Perm.COMPLIANCE_READ))]
EprModule = Annotated[Principal, Depends(require_permission(Perm.MODULE_EPR))]
PpwrModule = Annotated[Principal, Depends(require_permission(Perm.MODULE_PPWR))]
EprRegime = Literal["epr_uk", "epr_dk", "sb54_ca"]
Status = Literal["ok", "warning", "missing"]


class Regime(BaseModel):
    id: str
    name: str
    kind: Literal["epr", "doc"]
    module: str
    country: str
    in_scope: bool
    rates_status: Literal["published", "placeholder"] | None = None


class MaterialFee(BaseModel):
    code: str
    name: str
    tonnes: float
    fee_tonnes: float
    rate: float
    fee: float
    share_pct: float


class ProductFee(BaseModel):
    sku: str
    name: str
    tonnes: float
    fee: float
    main_material: str | None


class DataQuality(BaseModel):
    components: int
    missing_weight_or_material: int
    estimated_weights: int
    products_without_sales: int


class Target(BaseModel):
    label: str
    target: str


class EprResult(BaseModel):
    regime: str
    name: str
    currency: str
    year: str | None
    years: list[str]
    rates_status: Literal["published", "placeholder"]
    rates_note: str
    fee_channels: list[str]
    modulated: bool
    modulation_note: str | None
    total_fee: float
    total_tonnes: float
    fee_tonnes: float
    products: int
    by_material: list[MaterialFee]
    by_product: list[ProductFee]
    data_quality: DataQuality
    targets: list[Target]


class DeclarationRow(BaseModel):
    sku: str
    product_name: str
    status: Literal["ready", "draft"]
    reference: str
    requirements: dict[str, Status]
    missing_fields: list[str]


class Requirement(BaseModel):
    key: str
    label: str
    status: Status
    evidence: list[str]


class DocComponent(BaseModel):
    name: str
    level: str
    material: str
    weight_g: str
    recycled_content_pct: str
    recyclability: str


class Declaration(BaseModel):
    lang: Literal["en", "da"]
    status: Literal["ready", "draft"]
    status_label: str
    text: dict[str, str]
    sku: str
    product_name: str
    gtin: str
    reference: str
    version: str
    manufacturer: str
    signatory: str
    issue_date: str
    retention_until: str
    technical_file_refs: list[str]
    components: list[DocComponent]
    requirements: list[Requirement]
    missing_fields: list[str]


@router.get("/regimes", response_model=list[Regime], summary="Regimes this workspace covers")
async def list_regimes(_: Reader, db: TenantDB) -> list[Regime]:
    tenant = await current_tenant(db)
    out = []
    for rid, r in epr.regimes().items():
        out.append(
            Regime(
                id=rid,
                name=r["name"],
                kind=r["kind"],
                module=r["module"],
                country=r["country"],
                in_scope=epr.in_scope(r, tenant, preview=True),
                rates_status=r.get("rates_status"),
            )
        )
    return out


@router.get("/epr/{regime}", response_model=EprResult, summary="EPR fees by material and product")
async def epr_result(
    regime: EprRegime, _: EprModule, db: TenantDB, year: Annotated[str | None, Query(max_length=8)] = None
) -> dict[str, Any]:
    return epr.calculate(regime, await catalog.all_products(db), year)


@router.get("/ppwr/declarations", response_model=list[DeclarationRow], summary="Declaration readiness per product")
async def list_declarations(_: PpwrModule, db: TenantDB) -> list[dict[str, Any]]:
    return [ppwr_doc.readiness(p) for p in await catalog.all_products(db)]


@router.get(
    "/ppwr/declarations/{sku}", response_model=Declaration, summary="EU Declaration of Conformity for one product"
)
async def get_declaration(sku: str, _: Reader, db: TenantDB, lang: Literal["en", "da"] = "da") -> dict[str, Any]:
    product = await catalog.get_by_sku(db, sku)
    if product is None:
        raise ProblemError(404, "Product not found.")
    tenant = await current_tenant(db)
    fallback = ""
    if tenant:
        dk = next((e for e in tenant.legal_entities if e.country == "DK"), None)
        fallback = dk.name if dk else tenant.name
    return ppwr_doc.declaration(product, lang, fallback)
