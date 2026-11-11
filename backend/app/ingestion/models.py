"""Import batches (screen 5) and data sources (screen 18): where client data comes from.

A data source is a connected system (ERP, PLM) of one workspace. It keeps the column
mapping from its last approved import, so later syncs map themselves, and can approve
clean syncs automatically. Every sync or file is an import batch (the sync history).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.audit import JSONType
from app.core.db import Base, Timestamps, UUIDPrimaryKey


class DataSource(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "data_sources"
    __table_args__ = (UniqueConstraint("tenant_id", "system", name="uq_data_sources_tenant_system"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False
    )
    system: Mapped[str] = mapped_column(String(16), nullable=False)  # erp | plm
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    mapping: Mapped[dict[str, str | None]] = mapped_column(JSONType, default=dict, nullable=False)
    auto_approve: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_status: Mapped[str | None] = mapped_column(String(16))  # running | succeeded | failed
    last_result: Mapped[dict[str, Any] | None] = mapped_column(JSONType)


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
    data_source_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("data_sources.id", ondelete="SET NULL"), index=True
    )
