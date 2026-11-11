"""Data access for tenants, users and memberships. Callers own the transaction."""

from __future__ import annotations

import uuid

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenancy import TENANT_SETTING
from app.platform.models import Membership, Tenant, TenantRole, TenantStatus, User, UserStatus


async def get_tenant_by_slug(session: AsyncSession, slug: str) -> Tenant | None:
    return await session.scalar(select(Tenant).where(Tenant.slug == slug))


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    return await session.scalar(select(User).where(User.email == email.strip().lower()))


async def upsert_tenant(session: AsyncSession, *, slug: str, name: str, status: TenantStatus) -> Tenant:
    tenant = await get_tenant_by_slug(session, slug)
    if tenant is None:
        tenant = Tenant(slug=slug, name=name, status=status)
        session.add(tenant)
    else:
        tenant.name, tenant.status = name, status
    await session.flush()
    return tenant


async def upsert_user(
    session: AsyncSession,
    *,
    email: str,
    full_name: str,
    is_platform_admin: bool = False,
    password_hash: str | None = None,
    status: UserStatus = UserStatus.ACTIVE,
) -> User:
    user = await get_user_by_email(session, email)
    if user is None:
        user = User(email=email.strip().lower(), full_name=full_name)
        session.add(user)
    user.full_name, user.is_platform_admin, user.status = full_name, is_platform_admin, status
    if password_hash is not None:
        user.password_hash = password_hash
    await session.flush()
    return user


async def ensure_membership(
    session: AsyncSession, *, tenant_id: uuid.UUID, user_id: uuid.UUID, role: TenantRole
) -> Membership:
    membership = await session.scalar(
        select(Membership).where(Membership.tenant_id == tenant_id, Membership.user_id == user_id)
    )
    if membership is None:
        membership = Membership(tenant_id=tenant_id, user_id=user_id, role=role)
        session.add(membership)
    else:
        membership.role = role
    await session.flush()
    return membership


async def current_tenant(session: AsyncSession) -> Tenant | None:
    """The workspace this session is bound to (its RLS setting), if any."""
    raw = await session.scalar(text(f"SELECT current_setting('{TENANT_SETTING}', true)"))
    return await session.get(Tenant, uuid.UUID(raw)) if raw else None
