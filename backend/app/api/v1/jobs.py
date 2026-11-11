"""Background job status, polled by the UI while imports, runs and exports work."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from app.core.auth import Principal, TenantDB, require_permission
from app.core.errors import ProblemError
from app.core.jobs import Job, JobStatus
from app.core.permissions import Perm

router = APIRouter(prefix="/jobs", tags=["Jobs"])


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: str
    status: JobStatus
    progress: int
    result: dict[str, Any] | None
    error: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


@router.get(
    "/{job_id}",
    response_model=JobOut,
    summary="Get job status",
    responses={404: {"description": "No such job in your workspace"}},
)
async def get_job(
    job_id: uuid.UUID,
    _: Annotated[Principal, Depends(require_permission(Perm.JOBS_READ))],
    session: TenantDB,
) -> JobOut:
    job = await session.get(Job, job_id)
    if job is None:  # Jobs of other tenants are invisible through RLS.
        raise ProblemError(404, "Job not found.")
    return JobOut.model_validate(job)
