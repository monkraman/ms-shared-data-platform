"""Platform tables: tenants, users and memberships.

These are identity tables, read before a tenant is chosen (for example at sign-in),
so they are not under tenant RLS. Only platform repositories touch them.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, Timestamps, UUIDPrimaryKey


def _enum(cls: type[enum.Enum], name: str) -> Enum:
    # Store the value ("org_admin"), not the member name, as a plain checked string.
    return Enum(cls, name=name, native_enum=False, length=32, values_callable=lambda e: [m.value for m in e])


class TenantStatus(enum.StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    SUSPENDED = "suspended"


class UserStatus(enum.StrEnum):
    INVITED = "invited"
    ACTIVE = "active"
    DISABLED = "disabled"


class TenantRole(enum.StrEnum):
    """Roles inside one client workspace. More roles arrive with screen 9."""

    ORG_ADMIN = "org_admin"


class Tenant(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "tenants"

    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[TenantStatus] = mapped_column(
        _enum(TenantStatus, "tenant_status"), default=TenantStatus.DRAFT, nullable=False
    )


class User(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "users"

    # Stored lower-case; uniqueness is case-insensitive because of that.
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    is_platform_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[UserStatus] = mapped_column(
        _enum(UserStatus, "user_status"), default=UserStatus.INVITED, nullable=False
    )
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    memberships: Mapped[list[Membership]] = relationship(back_populates="user", lazy="selectin")


class Membership(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("tenant_id", "user_id", name="uq_memberships_tenant_user"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    role: Mapped[TenantRole] = mapped_column(_enum(TenantRole, "tenant_role"), nullable=False)

    user: Mapped[User] = relationship(back_populates="memberships")
    tenant: Mapped[Tenant] = relationship(lazy="joined")
