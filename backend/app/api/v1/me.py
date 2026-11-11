"""The signed-in user's session: who they are, the active workspace, what they may do.

The app shell builds its navigation from ``permissions``; nothing here comes from
client-side storage.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from app.core.auth import CurrentPrincipal
from app.core.tenancy import tenant_session
from app.platform.models import Membership, Tenant, TenantRole, TenantStatus

router = APIRouter(prefix="/auth", tags=["Session"])


class MeUser(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    is_platform_admin: bool


class MeTenant(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    status: TenantStatus


class MeMembership(BaseModel):
    tenant: MeTenant
    role: TenantRole


class MeResponse(BaseModel):
    user: MeUser
    active_tenant: MeTenant | None
    permissions: list[str]
    memberships: list[MeMembership]


def _tenant(t: Tenant) -> MeTenant:
    return MeTenant(id=t.id, slug=t.slug, name=t.name, status=t.status)


@router.get("/me", response_model=MeResponse, summary="Current session")
async def get_me(principal: CurrentPrincipal) -> MeResponse:
    async with tenant_session(None) as session:
        rows = (
            await session.scalars(
                select(Membership).where(Membership.user_id == principal.user_id).order_by(Membership.created_at)
            )
        ).all()
        active = await session.get(Tenant, principal.tenant_id) if principal.tenant_id else None
        return MeResponse(
            user=MeUser(
                id=principal.user_id,
                email=principal.email,
                full_name=principal.full_name,
                is_platform_admin=principal.is_platform_admin,
            ),
            active_tenant=_tenant(active) if active else None,
            permissions=sorted(principal.permissions),
            memberships=[MeMembership(tenant=_tenant(m.tenant), role=m.role) for m in rows],
        )
