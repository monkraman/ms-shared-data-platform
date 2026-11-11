"""Connected systems of a workspace and the sync batches they produce."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ingestion import service, sync
from app.ingestion.models import DataSource, ImportBatch


async def get_or_connect(db: AsyncSession, tenant_id: uuid.UUID, system: sync.System) -> DataSource:
    """The workspace's source for this system, connected on first use."""
    source = await db.scalar(select(DataSource).where(DataSource.system == system))
    if source is None:
        source = DataSource(tenant_id=tenant_id, system=system, name=sync.SYSTEM_NAMES[system], mapping={})
        db.add(source)
        await db.flush()
    return source


def mapping_for(columns: list[str], saved: dict[str, str | None]) -> dict[str, str | None]:
    """Saved choices first (including "skip"), suggestions for columns never mapped before."""
    suggested = service.suggest_mapping(columns)
    return {col: saved[col] if col in saved else suggested[col] for col in columns}


async def sync_batch(db: AsyncSession, source: DataSource, user_id: uuid.UUID | None) -> ImportBatch:
    """Pull the system's records into a draft batch, mapped with the source's saved mapping."""
    columns, rows, extras = sync.sync_rows(source.system)  # type: ignore[arg-type]
    batch = ImportBatch(
        tenant_id=source.tenant_id,
        filename=f"{source.name} sync",
        source=source.system,
        columns=columns,
        rows=rows,
        mapping=mapping_for(columns, source.mapping),
        extras=extras,
        created_by=user_id,
        data_source_id=source.id,
    )
    db.add(batch)
    await db.flush()
    return batch


async def last_csv_mapping(db: AsyncSession, columns: list[str]) -> dict[str, str | None]:
    """A file with the same columns as an earlier imported file reuses that file's mapping."""
    previous = await db.scalars(
        select(ImportBatch)
        .where(ImportBatch.source == "csv", ImportBatch.status == "imported")
        .order_by(ImportBatch.created_at.desc())
        .limit(20)
    )
    for batch in previous:
        if batch.columns == columns:
            return dict(batch.mapping)
    return {}
