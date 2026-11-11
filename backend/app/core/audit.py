"""Audit trail: who changed what, with the values before and after.

Call :func:`record_audit` in the same transaction as the change, so the change and its
audit event are saved together or not at all.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from fastapi.encoders import jsonable_encoder
from sqlalchemy import JSON, DateTime, ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, UUIDPrimaryKey, utcnow
from app.core.request_context import request_id_var

if TYPE_CHECKING:
    from app.core.auth import Principal

JSONType = JSON().with_variant(JSONB(), "postgresql")


class AuditEvent(UUIDPrimaryKey, Base):
    """Tenant-scoped (RLS). Rows without a tenant are platform events."""

    __tablename__ = "audit_events"

    tenant_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"))
    actor_email: Mapped[str | None] = mapped_column(String(320))
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(100))
    before: Mapped[dict[str, Any] | None] = mapped_column(JSONType)
    after: Mapped[dict[str, Any] | None] = mapped_column(JSONType)
    request_id: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)


async def record_audit(
    session: AsyncSession,
    *,
    action: str,
    entity_type: str,
    entity_id: Any = None,
    principal: Principal | None = None,
    tenant_id: uuid.UUID | None = None,
    actor_email: str | None = None,
    before: Any = None,
    after: Any = None,
) -> AuditEvent:
    """Add an audit event to the session; it is saved when the transaction commits.

    ``tenant_id`` defaults to the principal's active tenant.
    """
    event = AuditEvent(
        tenant_id=tenant_id if tenant_id is not None else (principal.tenant_id if principal else None),
        actor_user_id=principal.user_id if principal else None,
        actor_email=principal.email if principal else actor_email,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        before=jsonable_encoder(before) if before is not None else None,
        after=jsonable_encoder(after) if after is not None else None,
        request_id=request_id_var.get(),
    )
    session.add(event)
    return event
