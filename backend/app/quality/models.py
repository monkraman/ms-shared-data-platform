"""Gap rules (platform library, screen 6) and each workspace's gap status (screen 7).

Gaps themselves are computed from the products and the active rules (``engine.py``), so they
always match the data; only what people decided about a gap is stored.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import ARRAY, Boolean, ForeignKey, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.audit import JSONType
from app.core.db import Base, Timestamps, UUIDPrimaryKey


class GapRule(Timestamps, Base):
    __tablename__ = "gap_rules"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)  # GR-001
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    data_point: Mapped[str] = mapped_column(String(8), nullable=False)
    field: Mapped[str] = mapped_column(String(64), nullable=False)
    check: Mapped[dict[str, Any]] = mapped_column(JSONType, nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    modules: Mapped[list[str]] = mapped_column(ARRAY(String(8)), default=list, nullable=False)
    # Empty = every country. A workspace sees a rule only if it has one of the rule's
    # modules and (when set) one of its countries.
    countries: Mapped[list[str]] = mapped_column(ARRAY(String(2)), default=list, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # How a gap may be filled without real data: {"method": "similar_average"} or
    # {"method": "fixed", "value": "0"}. None = the gap needs real data.
    estimate: Mapped[dict[str, Any] | None] = mapped_column(JSONType)


class GapState(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "gap_states"
    __table_args__ = (UniqueConstraint("tenant_id", "gap_id", name="uq_gap_states_tenant_gap"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False
    )
    gap_id: Mapped[str] = mapped_column(String(160), nullable=False)  # GR-003:HLA-KET-460-01
    status: Mapped[str] = mapped_column(String(16), nullable=False)  # requested | resolved
    note: Mapped[str | None] = mapped_column(Text)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"))
