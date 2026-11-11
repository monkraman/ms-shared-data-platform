"""Screen 18 (first part): connected systems of a workspace.

Connecting a system is a one-time setup. Each sync reuses the mapping saved at the last
approved import; with auto-approve on, a sync without row errors imports straight away,
otherwise it waits on the Import screen for review.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import func, select

from app.api.v1.imports import ImportDraft, _draft, approve_batch
from app.core.audit import record_audit
from app.core.auth import Principal, TenantDB, require_permission
from app.core.errors import ProblemError
from app.core.permissions import Perm
from app.ingestion import service, sources
from app.ingestion.models import DataSource, ImportBatch

router = APIRouter(prefix="/data-sources", tags=["Data sources"])

Importer = Annotated[Principal, Depends(require_permission(Perm.IMPORTS_MANAGE))]


class DataSourceOut(BaseModel):
    id: uuid.UUID
    system: Literal["erp", "plm"]
    name: str
    auto_approve: bool
    mapped_columns: int
    last_synced_at: datetime | None
    last_status: Literal["running", "succeeded", "failed"] | None
    last_result: dict[str, Any] | None
    syncs: int


class ConnectRequest(BaseModel):
    system: Literal["erp", "plm"]


class DataSourcePatch(BaseModel):
    auto_approve: bool


class SyncStarted(BaseModel):
    """Either the draft to review on the Import screen, or the running import job."""

    draft: ImportDraft
    job_id: uuid.UUID | None


async def _out(db: TenantDB, source: DataSource) -> DataSourceOut:
    syncs = await db.scalar(select(func.count()).where(ImportBatch.data_source_id == source.id)) or 0
    return DataSourceOut(
        id=source.id,
        system=source.system,
        name=source.name,
        auto_approve=source.auto_approve,
        mapped_columns=sum(1 for v in source.mapping.values() if v),
        last_synced_at=source.last_synced_at,
        last_status=source.last_status,
        last_result=source.last_result,
        syncs=syncs,
    )


async def _get(db: TenantDB, source_id: uuid.UUID) -> DataSource:
    source = await db.get(DataSource, source_id)
    if source is None:
        raise ProblemError(404, "Data source not found.")
    return source


@router.get("", response_model=list[DataSourceOut], summary="Connected systems")
async def list_sources(_: Importer, db: TenantDB) -> list[DataSourceOut]:
    rows = (await db.scalars(select(DataSource).order_by(DataSource.created_at))).all()
    return [await _out(db, s) for s in rows]


@router.post("", response_model=DataSourceOut, status_code=status.HTTP_201_CREATED, summary="Connect a system")
async def connect(payload: ConnectRequest, principal: Importer, db: TenantDB) -> DataSourceOut:
    assert principal.tenant_id is not None
    existing = await db.scalar(select(DataSource).where(DataSource.system == payload.system))
    source = existing or await sources.get_or_connect(db, principal.tenant_id, payload.system)
    if existing is None:
        await record_audit(
            db,
            principal=principal,
            action="data_source.connected",
            entity_type="data_source",
            entity_id=source.id,
            after={"system": source.system, "name": source.name},
        )
    return await _out(db, source)


@router.patch("/{source_id}", response_model=DataSourceOut, summary="Turn auto-approve on or off")
async def update_source(
    source_id: uuid.UUID, payload: DataSourcePatch, principal: Importer, db: TenantDB
) -> DataSourceOut:
    source = await _get(db, source_id)
    before = source.auto_approve
    source.auto_approve = payload.auto_approve
    await db.flush()
    await record_audit(
        db,
        principal=principal,
        action="data_source.updated",
        entity_type="data_source",
        entity_id=source.id,
        before={"auto_approve": before},
        after={"auto_approve": source.auto_approve},
    )
    return await _out(db, source)


@router.post("/{source_id}/sync", response_model=SyncStarted, status_code=status.HTTP_201_CREATED, summary="Sync now")
async def sync_now(source_id: uuid.UUID, principal: Importer, db: TenantDB) -> SyncStarted:
    source = await _get(db, source_id)
    batch = await sources.sync_batch(db, source, principal.user_id)
    draft = await _draft(db, principal, batch)
    job_id = None
    clean = service.preview(batch, set())
    if source.auto_approve and source.mapping and clean["invalid_rows"] == 0 and clean["valid_rows"]:
        job_id = await approve_batch(db, principal, batch)
    return SyncStarted(draft=draft, job_id=job_id)
