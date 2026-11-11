"""Who is calling, which tenant they act in, and what they may do.

New endpoints use exactly one of these dependencies:

* ``require_permission("x.y")``: returns the :class:`Principal`, or raises 401/403.
* ``TenantDB`` / ``PlatformDB``: a database session bound to the principal's tenant
  (or to platform-wide access for platform admins), committed after the endpoint.

The tenant always comes from the signed token and is re-checked against the user's
membership on every request. There is no default tenant and no tenant header.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import ProblemError
from app.core.permissions import permissions_for
from app.core.request_context import tenant_id_var
from app.core.security import ALGORITHM, SECRET_KEY
from app.core.tenancy import tenant_session
from app.platform.models import Membership, Tenant, TenantStatus, User, UserStatus

TOKEN_VERSION = 2  # Tokens from the prototype login have no "ver" and are refused here.
TOKEN_AUDIENCE = "compliance-hub-api"


@dataclass(frozen=True)
class Principal:
    user_id: uuid.UUID
    email: str
    full_name: str
    is_platform_admin: bool
    tenant_id: uuid.UUID | None
    permissions: frozenset[str] = field(default_factory=frozenset)

    def has(self, permission: str) -> bool:
        return permission in self.permissions


def create_platform_token(
    user_id: uuid.UUID,
    tenant_id: uuid.UUID | None,
    *,
    minutes: int | None = None,
) -> str:
    """Signed access token; every request re-checks the user and workspace in the database."""
    now = datetime.now(UTC)
    lifetime = timedelta(minutes=minutes or get_settings().access_token_minutes)
    claims = {
        "sub": str(user_id),
        "tid": str(tenant_id) if tenant_id else None,
        "ver": TOKEN_VERSION,
        "aud": TOKEN_AUDIENCE,
        "iat": now,
        "exp": now + lifetime,
    }
    return jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)


def _unauthorised(detail: str) -> ProblemError:
    return ProblemError(401, detail, headers={"WWW-Authenticate": "Bearer"})


def _decode(token: str) -> tuple[uuid.UUID, uuid.UUID | None]:
    try:
        claims = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], audience=TOKEN_AUDIENCE)
    except jwt.ExpiredSignatureError as exc:
        raise _unauthorised("Your session has expired. Please sign in again.") from exc
    except jwt.PyJWTError as exc:
        raise _unauthorised("Invalid access token.") from exc
    if claims.get("ver") != TOKEN_VERSION:
        raise _unauthorised("Invalid access token.")
    try:
        user_id = uuid.UUID(claims["sub"])
        tenant_id = uuid.UUID(claims["tid"]) if claims.get("tid") else None
    except (KeyError, TypeError, ValueError) as exc:
        raise _unauthorised("Invalid access token.") from exc
    return user_id, tenant_id


async def load_principal(user_id: uuid.UUID, tenant_id: uuid.UUID | None) -> Principal:
    """Rebuild the caller from the database, so suspensions and role changes apply at once."""
    async with tenant_session(None) as session:
        user = await session.get(User, user_id)
        if user is None or user.status != UserStatus.ACTIVE:
            raise _unauthorised("Your account is not active.")

        role = None
        modules: list[str] = []
        if tenant_id is not None:
            tenant = await session.get(Tenant, tenant_id)
            if tenant is None:
                raise ProblemError(403, "You do not have access to this workspace.")
            if tenant.status == TenantStatus.SUSPENDED and not user.is_platform_admin:
                raise ProblemError(403, "This workspace is suspended.")
            membership = await session.scalar(
                select(Membership).where(Membership.user_id == user_id, Membership.tenant_id == tenant_id)
            )
            if membership is None and not user.is_platform_admin:
                raise ProblemError(403, "You do not have access to this workspace.")
            role = membership.role if membership else None
            modules = list(tenant.modules)

        return Principal(
            user_id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_platform_admin=user.is_platform_admin,
            tenant_id=tenant_id,
            permissions=permissions_for(
                is_platform_admin=user.is_platform_admin,
                tenant_role=role,
                has_tenant=tenant_id is not None,
                modules=modules,
            ),
        )


async def get_principal(
    authorization: Annotated[str | None, Header(description="Bearer <access token>")] = None,
) -> Principal:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise _unauthorised("Sign in to continue.")
    user_id, tenant_id = _decode(authorization.split(" ", 1)[1].strip())
    principal = await load_principal(user_id, tenant_id)
    tenant_id_var.set(str(tenant_id) if tenant_id else None)
    return principal


CurrentPrincipal = Annotated[Principal, Depends(get_principal)]


def require_permission(permission: str) -> Callable[..., object]:
    """Dependency factory: ``principal = Depends(require_permission(Perm.JOBS_READ))``."""

    async def dependency(principal: CurrentPrincipal) -> Principal:
        if not principal.has(permission):
            raise ProblemError(403, "You do not have permission to do this.", extra={"permission": permission})
        return principal

    dependency.__name__ = f"require_{permission.replace('.', '_')}"
    return dependency


async def _tenant_db(principal: CurrentPrincipal) -> AsyncIterator[AsyncSession]:
    if principal.tenant_id is None:
        raise ProblemError(403, "Choose a workspace first.")
    async with tenant_session(principal.tenant_id) as session:
        yield session


async def _platform_db(principal: CurrentPrincipal) -> AsyncIterator[AsyncSession]:
    if not principal.is_platform_admin:
        raise ProblemError(403, "You do not have permission to do this.")
    async with tenant_session(principal.tenant_id, platform_access=True) as session:
        yield session


TenantDB = Annotated[AsyncSession, Depends(_tenant_db)]
PlatformDB = Annotated[AsyncSession, Depends(_platform_db)]
