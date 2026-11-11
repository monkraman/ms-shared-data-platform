"""Celery worker entry point: ``celery -A app.worker worker --loglevel=info``.

Only used when REDIS_URL is set; otherwise jobs run inside the API process.
"""

from __future__ import annotations

import asyncio
import uuid

from celery import Celery

import app.models  # noqa: F401 - register every table and job handler
from app.core.config import get_settings
from app.core.db import dispose_engine
from app.core.jobs import run_job
from app.core.request_context import configure_logging

settings = get_settings()
if not settings.redis_url:
    raise RuntimeError("REDIS_URL must be set to run a Celery worker.")

configure_logging()
celery_app = Celery("compliance_hub", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.update(task_acks_late=True, worker_prefetch_multiplier=1, task_track_started=True)


@celery_app.task(name="compliance_hub.run_job", autoretry_for=(ConnectionError,), retry_backoff=True, max_retries=5)
def run_job_task(job_id: str, tenant_id: str | None) -> None:
    async def _run() -> None:
        try:
            await run_job(uuid.UUID(job_id), uuid.UUID(tenant_id) if tenant_id else None)
        finally:
            await dispose_engine()

    asyncio.run(_run())
