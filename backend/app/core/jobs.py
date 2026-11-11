"""Background jobs behind one small interface.

Imports, syncs, rule runs, calculations and exports leave the request path:

1. Register a handler: ``@job_handler("ingestion.import")`` on
   ``async def run(session, job) -> dict``. It runs inside the job's tenant (RLS on).
2. In an endpoint, ``job = await enqueue(session, principal, "ingestion.import", {...})``
   and return ``202`` with ``job.id``. The job starts once the transaction commits.
3. The UI polls ``GET /api/v1/jobs/{id}`` for status and progress.

With ``REDIS_URL`` set, jobs go to Celery workers (``celery -A app.worker worker``).
Without it they run in the API process, which suits local work and the free tier.
"""

from __future__ import annotations

import asyncio
import enum
import logging
import uuid
from collections.abc import Awaitable, Callable
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, Uuid, event
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.core.audit import JSONType
from app.core.config import get_settings
from app.core.db import Base, Timestamps, UUIDPrimaryKey, utcnow
from app.core.tenancy import tenant_session

if TYPE_CHECKING:
    from app.core.auth import Principal

logger = logging.getLogger(__name__)


class JobStatus(enum.StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class Job(UUIDPrimaryKey, Timestamps, Base):
    """Tenant-scoped (RLS). Rows without a tenant are platform jobs."""

    __tablename__ = "jobs"

    tenant_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[JobStatus] = mapped_column(
        Enum(
            JobStatus, name="job_status", native_enum=False, length=16, values_callable=lambda e: [m.value for m in e]
        ),
        default=JobStatus.QUEUED,
        nullable=False,
    )
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONType)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSONType)
    error: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


JobHandler = Callable[[AsyncSession, Job], Awaitable[dict[str, Any] | None]]
_HANDLERS: dict[str, JobHandler] = {}
_INLINE_TASKS: set[asyncio.Task[None]] = set()


def job_handler(kind: str) -> Callable[[JobHandler], JobHandler]:
    def register(fn: JobHandler) -> JobHandler:
        if kind in _HANDLERS:
            raise ValueError(f"Job handler already registered for {kind!r}")
        _HANDLERS[kind] = fn
        return fn

    return register


async def enqueue(
    session: AsyncSession, principal: Principal | None, kind: str, payload: dict[str, Any] | None = None
) -> Job:
    """Create a queued job in the caller's tenant; it is dispatched after commit."""
    if kind not in _HANDLERS:
        raise ValueError(f"No job handler registered for {kind!r}")
    job = Job(
        tenant_id=principal.tenant_id if principal else None,
        kind=kind,
        payload=payload,
        created_by=principal.user_id if principal else None,
    )
    session.add(job)
    await session.flush()

    job_id, tenant_id = job.id, job.tenant_id
    loop = asyncio.get_running_loop()

    def _after_commit(_sync_session: Any) -> None:
        loop.call_soon(dispatch, job_id, tenant_id)

    event.listen(session.sync_session, "after_commit", _after_commit, once=True)
    return job


def dispatch(job_id: uuid.UUID, tenant_id: uuid.UUID | None) -> None:
    if get_settings().redis_url:
        from app.worker import celery_app

        celery_app.send_task("compliance_hub.run_job", args=[str(job_id), str(tenant_id) if tenant_id else None])
        return
    task = asyncio.get_running_loop().create_task(run_job(job_id, tenant_id))
    _INLINE_TASKS.add(task)
    task.add_done_callback(_INLINE_TASKS.discard)


async def run_job(job_id: uuid.UUID, tenant_id: uuid.UUID | None) -> None:
    """Run one job to completion, recording status, result or error."""
    platform = tenant_id is None
    async with tenant_session(tenant_id, platform_access=platform) as session:
        job = await session.get(Job, job_id)
        if job is None or job.status != JobStatus.QUEUED:
            return
        job.status, job.started_at = JobStatus.RUNNING, utcnow()

    try:
        async with tenant_session(tenant_id, platform_access=platform) as session:
            job = await session.get(Job, job_id)
            assert job is not None
            result = await _HANDLERS[job.kind](session, job)
            job.status, job.progress, job.result, job.finished_at = JobStatus.SUCCEEDED, 100, result, utcnow()
    except Exception as exc:
        logger.exception("Job %s failed", job_id)
        async with tenant_session(tenant_id, platform_access=platform) as session:
            job = await session.get(Job, job_id)
            if job is not None:
                job.status, job.error, job.finished_at = JobStatus.FAILED, str(exc)[:2000], utcnow()


async def wait_for_inline_jobs() -> None:
    """Tests and shutdown: wait until in-process jobs finish."""
    while _INLINE_TASKS:
        await asyncio.gather(*list(_INLINE_TASKS), return_exceptions=True)


@job_handler("system.echo")
async def _echo(session: AsyncSession, job: Job) -> dict[str, Any]:
    """Smoke-test job: returns its payload."""
    return {"echo": job.payload or {}}
