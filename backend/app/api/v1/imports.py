"""Screen 5: import products from a CSV file or a (simulated) ERP/PLM sync.

Both go through the same steps: draft (columns and rows) → mapping (preview with checks)
→ approve (a background job writes the products; the UI polls ``GET /jobs/{id}``).
"""

from __future__ import annotations

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import select

import app.ingestion.jobs  # noqa: F401  (registers the import job handler)
from app.catalog.models import Product
from app.core.audit import record_audit
from app.core.auth import Principal, TenantDB, require_permission
from app.core.errors import ProblemError
from app.core.jobs import enqueue
from app.core.permissions import Perm
from app.ingestion import service, sync
from app.ingestion.models import ImportBatch

router = APIRouter(prefix="/imports", tags=["Import"])

MAX_ROWS = 20_000


class ImportCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    columns: list[str] = Field(max_length=200)
    rows: list[list[str]] = Field(max_length=MAX_ROWS)


class SyncRequest(BaseModel):
    system: Literal["erp", "plm"]


class Target(BaseModel):
    key: str
    label: str
    dp: str | None
    required: bool


class ImportDraft(BaseModel):
    id: uuid.UUID
    filename: str
    source: Literal["csv", "erp", "plm"]
    columns: list[str]
    row_count: int
    suggested_mapping: dict[str, str | None]
    targets: list[Target]


class MappingIn(BaseModel):
    mapping: dict[str, str | None]


class ImportIssue(BaseModel):
    row: int
    column: str
    message: str


class ImportPreview(BaseModel):
    id: uuid.UUID
    valid_rows: int
    invalid_rows: int
    new_products: int
    updated_products: int
    issues: list[ImportIssue]


class JobStarted(BaseModel):
    job_id: uuid.UUID


Importer = Annotated[Principal, Depends(require_permission(Perm.IMPORTS_MANAGE))]


def _invalid(field: str, msg: str) -> ProblemError:
    return ProblemError(
        422, "The request has invalid fields.", extra={"errors": [{"loc": ["body", field], "msg": msg}]}
    )


async def _draft(db: TenantDB, principal: Principal, batch: ImportBatch) -> ImportDraft:
    db.add(batch)
    await db.flush()
    await record_audit(
        db,
        principal=principal,
        action="import.started",
        entity_type="import_batch",
        entity_id=batch.id,
        after={"source": batch.source, "filename": batch.filename, "rows": len(batch.rows)},
    )
    return ImportDraft(
        id=batch.id,
        filename=batch.filename,
        source=batch.source,
        columns=batch.columns,
        row_count=len(batch.rows),
        suggested_mapping=batch.mapping,
        targets=service.targets(),
    )


async def _batch(db: TenantDB, batch_id: uuid.UUID) -> ImportBatch:
    batch = await db.get(ImportBatch, batch_id)
    if batch is None:
        raise ProblemError(404, "Import not found.")
    return batch


@router.post("", response_model=ImportDraft, status_code=status.HTTP_201_CREATED, summary="Start a CSV import")
async def start_import(payload: ImportCreate, principal: Importer, db: TenantDB) -> ImportDraft:
    if not payload.columns or not payload.rows:
        raise _invalid("file", "The file has no rows")
    if len(set(payload.columns)) != len(payload.columns):
        raise _invalid("file", "Column names must be different")
    assert principal.tenant_id is not None
    batch = ImportBatch(
        tenant_id=principal.tenant_id,
        filename=payload.filename,
        source="csv",
        columns=payload.columns,
        rows=payload.rows,
        mapping=service.suggest_mapping(payload.columns),
        created_by=principal.user_id,
    )
    return await _draft(db, principal, batch)


@router.post(
    "/sync", response_model=ImportDraft, status_code=status.HTTP_201_CREATED, summary="Sync from ERP or PLM (simulated)"
)
async def start_sync(payload: SyncRequest, principal: Importer, db: TenantDB) -> ImportDraft:
    columns, rows, extras = sync.sync_rows(payload.system)
    assert principal.tenant_id is not None
    batch = ImportBatch(
        tenant_id=principal.tenant_id,
        filename=f"{sync.SYSTEM_NAMES[payload.system]} sync",
        source=payload.system,
        columns=columns,
        rows=rows,
        mapping=service.suggest_mapping(columns),
        extras=extras,
        created_by=principal.user_id,
    )
    return await _draft(db, principal, batch)


@router.put("/{batch_id}/mapping", response_model=ImportPreview, summary="Set the column mapping and preview")
async def set_mapping(batch_id: uuid.UUID, payload: MappingIn, _: Importer, db: TenantDB) -> dict[str, object]:
    batch = await _batch(db, batch_id)
    if batch.status != "draft":
        raise ProblemError(409, "This import has already been approved.")
    keys = {t["key"] for t in service.targets()}
    unknown = [v for v in payload.mapping.values() if v and v not in keys]
    if unknown:
        raise _invalid("mapping", f"Unknown field: {unknown[0]}")
    batch.mapping = {col: payload.mapping.get(col) for col in batch.columns}
    existing = set((await db.scalars(select(Product.sku))).all())
    return service.preview(batch, existing)


@router.post(
    "/{batch_id}/approve",
    response_model=JobStarted,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Approve: import the valid rows in the background",
)
async def approve(batch_id: uuid.UUID, principal: Importer, db: TenantDB) -> JobStarted:
    batch = await _batch(db, batch_id)
    if batch.status != "draft":
        raise ProblemError(409, "This import has already been approved.")
    if not service.preview(batch, set())["valid_rows"]:
        raise ProblemError(422, "There are no valid rows to import.")
    job = await enqueue(db, principal, "ingestion.import", {"batch_id": str(batch.id)})
    batch.status, batch.job_id = "approved", job.id
    await record_audit(
        db, principal=principal, action="import.approved", entity_type="import_batch", entity_id=batch.id
    )
    return JobStarted(job_id=job.id)
