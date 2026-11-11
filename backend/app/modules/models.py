"""Action items: recommendations a client decides to act on, or tasks they add themselves."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import Date, Float, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Timestamps, UUIDPrimaryKey


class ActionItem(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "action_items"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    detail: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # The recommendation it came from (for example "lightweight:HLA-KET-460-04"), if any.
    recommendation_id: Mapped[str | None] = mapped_column(String(160), index=True)
    kind: Mapped[str] = mapped_column(String(32), default="manual", nullable=False)
    regime: Mapped[str | None] = mapped_column(String(16))
    sku: Mapped[str | None] = mapped_column(String(64))
    impact_value: Mapped[float | None] = mapped_column(Float)
    impact_label: Mapped[str | None] = mapped_column(String(64))
    currency: Mapped[str | None] = mapped_column(String(3))
    owner: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(16), default="open", nullable=False)  # open | in_progress | done
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"))
