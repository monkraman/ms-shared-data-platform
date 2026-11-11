"""Screen 2: client workspaces (platform admins) and the reference lists the wizard uses.

Shapes match ``frontend/src/app/core/api/contracts.ts`` (Workspace, WorkspaceCreate,
WorkspacePatch). Every change is audited against the workspace it touches.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import AuditEvent, record_audit
from app.core.auth import CurrentPrincipal, PlatformDB, Principal, require_permission
from app.core.errors import ProblemError, invalid_field
from app.core.permissions import Perm
from app.platform import repository as repo
from app.platform.models import LegalEntity, Membership, Tenant, TenantRole, TenantStatus, UserStatus
from app.platform.reference import COUNTRIES, COUNTRY_CODES, EU_COUNTRIES, EU_ONLY_MODULES, MODULES, ModuleId

router = APIRouter(tags=["Client workspaces"])

SLUG = re.compile(r"^[a-z0-9-]{3,40}$")
COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
# A logo is an https URL, or a small inline image until object storage is added.
MAX_LOGO_CHARS = 400_000
LOGO = re.compile(r"^(https://\S+|data:image/(png|jpeg|svg\+xml|webp);base64,[A-Za-z0-9+/=]+)$")


# --- Schemas ------------------------------------------------------------------------


class Country(BaseModel):
    code: str
    name: str
    eu: bool


class ModuleInfo(BaseModel):
    id: ModuleId
    name: str


class LegalEntityIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    country: str
    registration_number: str = Field(default="", max_length=64)


class LegalEntityOut(LegalEntityIn):
    model_config = ConfigDict(from_attributes=True)


class Workspace(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    sector: str
    status: TenantStatus
    brand_color: str
    logo_url: str | None
    countries: list[str]
    modules: list[ModuleId]
    legal_entities: list[LegalEntityOut]
    user_count: int
    last_activity_at: datetime | None
    created_at: datetime


class AdminInvite(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: str = Field(max_length=320)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL.match(v):
            raise ValueError("Enter a valid email")
        return v


class _Branding(BaseModel):
    @field_validator("brand_color", check_fields=False)
    @classmethod
    def _color(cls, v: str | None) -> str | None:
        if v is not None and not COLOR.match(v):
            raise ValueError("Use a colour like #1b3c6d")
        return v

    @field_validator("logo_url", check_fields=False)
    @classmethod
    def _logo(cls, v: str | None) -> str | None:
        if not v:
            return None
        if len(v) > MAX_LOGO_CHARS or not LOGO.match(v):
            raise ValueError("Use an https link or a PNG, JPEG, SVG or WebP image under 300 KB")
        return v


class WorkspaceCreate(_Branding):
    name: str = Field(min_length=1, max_length=255)
    slug: str
    sector: str = Field(default="Other", max_length=64)
    brand_color: str = "#1b3c6d"
    logo_url: str | None = None
    legal_entities: list[LegalEntityIn]
    countries: list[str]
    modules: list[ModuleId]
    admin: AdminInvite


class WorkspacePatch(_Branding):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    sector: str | None = Field(default=None, max_length=64)
    status: TenantStatus | None = None
    brand_color: str | None = None
    logo_url: str | None = None
    countries: list[str] | None = None
    modules: list[ModuleId] | None = None
    legal_entities: list[LegalEntityIn] | None = None


# --- Rules --------------------------------------------------------------------------


def _check_scope(countries: list[str], modules: list[str], entities: list[LegalEntityIn]) -> None:
    """At least one legal entity, country and module; known countries; EU modules need an EU country."""
    if not entities:
        raise invalid_field("legal_entities", "Add at least one legal entity")
    if any(e.country not in COUNTRY_CODES for e in entities):
        raise invalid_field("legal_entities", "Choose a supported country")
    if not countries:
        raise invalid_field("countries", "Choose at least one country")
    if any(c not in COUNTRY_CODES for c in countries):
        raise invalid_field("countries", "Choose a supported country")
    if not modules:
        raise invalid_field("modules", "Choose at least one module")
    if EU_ONLY_MODULES & set(modules) and not EU_COUNTRIES & set(countries):
        raise invalid_field("modules", "PPWR and DPP need an EU country")


def _unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(values))


async def _to_out(db: AsyncSession, tenants: list[Tenant]) -> list[Workspace]:
    ids = [t.id for t in tenants]
    users = dict(
        (
            await db.execute(
                select(Membership.tenant_id, func.count())
                .where(Membership.tenant_id.in_(ids))
                .group_by(Membership.tenant_id)
            )
        ).all()
    )
    activity = dict(
        (
            await db.execute(
                select(AuditEvent.tenant_id, func.max(AuditEvent.created_at))
                .where(AuditEvent.tenant_id.in_(ids))
                .group_by(AuditEvent.tenant_id)
            )
        ).all()
    )
    return [
        Workspace(
            id=t.id,
            slug=t.slug,
            name=t.name,
            sector=t.sector,
            status=t.status,
            brand_color=t.brand_color,
            logo_url=t.logo_url,
            countries=list(t.countries),
            modules=list(t.modules),
            legal_entities=[LegalEntityOut.model_validate(e) for e in t.legal_entities],
            user_count=users.get(t.id, 0),
            last_activity_at=activity.get(t.id),
            created_at=t.created_at,
        )
        for t in tenants
    ]


def _snapshot(t: Tenant) -> dict[str, object]:
    return {
        "name": t.name,
        "sector": t.sector,
        "status": t.status.value,
        "brand_color": t.brand_color,
        "logo": "set" if t.logo_url else None,
        "countries": list(t.countries),
        "modules": list(t.modules),
        "legal_entities": [e.name for e in t.legal_entities],
    }


async def _get(db: AsyncSession, tenant_id: uuid.UUID) -> Tenant:
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise ProblemError(404, "Workspace not found.")
    return tenant


# --- Endpoints ----------------------------------------------------------------------

Reader = Annotated[Principal, Depends(require_permission(Perm.PLATFORM_TENANTS_READ))]
Manager = Annotated[Principal, Depends(require_permission(Perm.PLATFORM_TENANTS_MANAGE))]


@router.get("/reference/countries", response_model=list[Country], summary="Supported countries")
async def list_countries(_: CurrentPrincipal) -> list[dict[str, str | bool]]:
    return COUNTRIES


@router.get("/reference/modules", response_model=list[ModuleInfo], summary="Compliance modules")
async def list_modules(_: CurrentPrincipal) -> list[dict[str, str]]:
    return MODULES


@router.get("/admin/tenants", response_model=list[Workspace], summary="List client workspaces")
async def list_workspaces(
    _: Reader,
    db: PlatformDB,
    q: Annotated[str | None, Query(max_length=100)] = None,
    status_: Annotated[Literal["draft", "active", "suspended"] | None, Query(alias="status")] = None,
) -> list[Workspace]:
    query = select(Tenant).order_by(Tenant.created_at.desc())
    if q:
        like = f"%{q.lower()}%"
        query = query.where(func.lower(Tenant.name).like(like) | Tenant.slug.like(like))
    if status_:
        query = query.where(Tenant.status == TenantStatus(status_))
    return await _to_out(db, list((await db.scalars(query)).all()))


@router.get("/admin/tenants/{tenant_id}", response_model=Workspace, summary="Workspace detail")
async def get_workspace(tenant_id: uuid.UUID, _: Reader, db: PlatformDB) -> Workspace:
    return (await _to_out(db, [await _get(db, tenant_id)]))[0]


@router.post(
    "/admin/tenants",
    response_model=Workspace,
    status_code=status.HTTP_201_CREATED,
    summary="Create a workspace and add its first org admin",
)
async def create_workspace(payload: WorkspaceCreate, principal: Manager, db: PlatformDB) -> Workspace:
    if not SLUG.match(payload.slug):
        raise invalid_field("slug", "Use 3–40 lowercase letters, numbers or hyphens")
    if await repo.get_tenant_by_slug(db, payload.slug):
        raise invalid_field("slug", "Already in use")
    countries, modules = _unique(payload.countries), _unique(payload.modules)
    _check_scope(countries, modules, payload.legal_entities)

    tenant = Tenant(
        slug=payload.slug,
        name=payload.name.strip(),
        sector=payload.sector,
        status=TenantStatus.ACTIVE,
        brand_color=payload.brand_color,
        logo_url=payload.logo_url,
        countries=countries,
        modules=modules,
        legal_entities=[LegalEntity(**e.model_dump()) for e in payload.legal_entities],
    )
    db.add(tenant)
    await db.flush()

    # The first org admin. Sign-in links by email follow once the email service is chosen.
    admin = await repo.get_user_by_email(db, payload.admin.email)
    if admin is None:
        admin = await repo.upsert_user(
            db, email=payload.admin.email, full_name=payload.admin.full_name, status=UserStatus.INVITED
        )
    await repo.ensure_membership(db, tenant_id=tenant.id, user_id=admin.id, role=TenantRole.ORG_ADMIN)

    await record_audit(
        db,
        principal=principal,
        tenant_id=tenant.id,
        action="workspace.created",
        entity_type="tenant",
        entity_id=tenant.id,
        after={**_snapshot(tenant), "admin": admin.email},
    )
    await db.refresh(tenant, ["legal_entities"])
    return (await _to_out(db, [tenant]))[0]


@router.patch("/admin/tenants/{tenant_id}", response_model=Workspace, summary="Edit a workspace")
async def update_workspace(
    tenant_id: uuid.UUID, payload: WorkspacePatch, principal: Manager, db: PlatformDB
) -> Workspace:
    tenant = await _get(db, tenant_id)
    before = _snapshot(tenant)
    changes = payload.model_dump(exclude_unset=True)

    for field in ("name", "sector", "status", "brand_color"):
        if changes.get(field) is not None:
            setattr(tenant, field, changes[field].strip() if field == "name" else changes[field])
    if "logo_url" in changes:
        tenant.logo_url = payload.logo_url
    if payload.countries is not None:
        tenant.countries = _unique(payload.countries)
    if payload.modules is not None:
        tenant.modules = _unique(payload.modules)
    if payload.legal_entities is not None:
        tenant.legal_entities = [LegalEntity(**e.model_dump()) for e in payload.legal_entities]
    if {"countries", "modules", "legal_entities"} & changes.keys():
        _check_scope(
            list(tenant.countries),
            list(tenant.modules),
            [LegalEntityIn.model_validate(e, from_attributes=True) for e in tenant.legal_entities],
        )

    action = "workspace.updated"
    if payload.status and payload.status.value != before["status"]:
        action = {TenantStatus.SUSPENDED: "workspace.suspended", TenantStatus.ACTIVE: "workspace.reactivated"}.get(
            payload.status, action
        )
    await db.flush()
    await record_audit(
        db,
        principal=principal,
        tenant_id=tenant.id,
        action=action,
        entity_type="tenant",
        entity_id=tenant.id,
        before=before,
        after=_snapshot(tenant),
    )
    await db.refresh(tenant, ["legal_entities", "updated_at"])
    return (await _to_out(db, [tenant]))[0]
