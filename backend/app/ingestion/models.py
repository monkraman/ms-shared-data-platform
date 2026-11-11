"""Import batches (screen 5): a file or a system sync waiting for mapping, review and approval."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.audit import JSONType
from app.core.db import Base, Timestamps, UUIDPrimaryKey


class ImportBatch(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "import_batches"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(String(16), default="csv", nullable=False)  # csv | erp | plm
    status: Mapped[str] = mapped_column(String(16), default="draft", nullable=False)  # draft | approved | imported
    columns: Mapped[list[str]] = mapped_column(JSONType, nullable=False)
    rows: Mapped[list[list[str]]] = mapped_column(JSONType, nullable=False)
    mapping: Mapped[dict[str, str | None]] = mapped_column(JSONType, default=dict, nullable=False)
    # Sync batches carry sales lines by SKU, applied with the rows on approval.
    extras: Mapped[dict[str, Any] | None] = mapped_column(JSONType)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSONType)
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"))
    job_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("jobs.id", ondelete="SET NULL"))
