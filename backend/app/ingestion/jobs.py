"""Background job that writes an approved import batch into the workspace's products."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import record_audit
from app.core.jobs import Job, job_handler
from app.ingestion import service
from app.ingestion.models import ImportBatch


@job_handler("ingestion.import")
async def run_import(session: AsyncSession, job: Job) -> dict[str, Any]:
    batch = await session.get(ImportBatch, uuid.UUID(str((job.payload or {})["batch_id"])))
    if batch is None:  # Another workspace's batch is invisible through RLS.
        raise ValueError("Import not found.")
    preview = service.preview(batch, set())
    result = await service.apply(session, batch.tenant_id, batch)
    result = {**result, "valid_rows": preview["valid_rows"], "invalid_rows": preview["invalid_rows"]}
    batch.status, batch.result = "imported", result
    await record_audit(
        session,
        tenant_id=batch.tenant_id,
        actor_email=None,
        action="import.completed",
        entity_type="import_batch",
        entity_id=batch.id,
        after={"source": batch.source, "filename": batch.filename, **result},
    )
    return result
