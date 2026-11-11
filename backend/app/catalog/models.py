"""Tables for the data point dictionary and for products, components and sales lines.

Values are stored as field maps, ``{"weight_g": {"dp": "DP09", "value": "26"}}``: each value
keeps the data point it answers, so gaps, coverage and later the compliance modules read the
same record. ``data_points`` is platform data; products and their children are tenant data
with row-level security.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import ARRAY, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.audit import JSONType
from app.core.db import Base, Timestamps, UUIDPrimaryKey

FieldMap = dict[str, dict[str, Any]]


class DataPoint(Timestamps, Base):
    __tablename__ = "data_points"

    code: Mapped[str] = mapped_column(String(8), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    system_field: Mapped[str | None] = mapped_column(String(255))
    outputs: Mapped[list[str]] = mapped_column(ARRAY(String(8)), default=list, nullable=False)
    countries: Mapped[list[str]] = mapped_column(ARRAY(String(2)), default=list, nullable=False)
    applies_from: Mapped[str | None] = mapped_column(String(32))


class Product(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("tenant_id", "sku", name="uq_products_tenant_sku"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False
    )
    sku: Mapped[str] = mapped_column(String(64), nullable=False)
    fields: Mapped[FieldMap] = mapped_column(JSONType, default=dict, nullable=False)
    passport: Mapped[FieldMap] = mapped_column(JSONType, default=dict, nullable=False)
    # Where the record last came from: manual, csv, erp or plm.
    source: Mapped[str] = mapped_column(String(16), default="manual", nullable=False)

    components: Mapped[list[Component]] = relationship(
        lazy="selectin", cascade="all, delete-orphan", order_by="Component.position"
    )
    sales: Mapped[list[SalesLine]] = relationship(
        lazy="selectin", cascade="all, delete-orphan", order_by="SalesLine.code"
    )


class Component(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "product_components"
    __table_args__ = (UniqueConstraint("product_id", "code", name="uq_product_components_product_code"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("products.id", ondelete="CASCADE"), index=True, nullable=False
    )
    code: Mapped[str] = mapped_column(String(80), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fields: Mapped[FieldMap] = mapped_column(JSONType, default=dict, nullable=False)


class SalesLine(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "product_sales"
    __table_args__ = (UniqueConstraint("product_id", "code", name="uq_product_sales_product_code"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("products.id", ondelete="CASCADE"), index=True, nullable=False
    )
    code: Mapped[str] = mapped_column(String(80), nullable=False)
    fields: Mapped[FieldMap] = mapped_column(JSONType, default=dict, nullable=False)
