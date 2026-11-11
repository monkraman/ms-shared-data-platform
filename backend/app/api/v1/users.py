"""Screen 9: users and access.

* ``/admin/users`` (platform admins): every user, their workspaces and roles; add, edit,
  disable, set workspaces, set a temporary password.
* ``/team`` (org admins): the members of their own workspace; add, change role, remove,
  and reset the password of a member who belongs to no other workspace.

Without a password a new user is "invited" (invitation emails come with the email service);
with one they are active at once. Disabling a user or setting a password ends their
sessions. Every change is audited.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.audit import record_audit
from app.core.auth import PlatformDB, Principal, require_permission
from app.core.db import utcnow
from app.core.errors import ProblemError, invalid_field
from app.core.permissions import Perm
from app.core.tenancy import tenant_session
from app.platform import repository as repo
from app.platform.models import Membership, RefreshToken, Tenant, TenantRole, User, UserStatus
from app.platform.passwords import hash_password

router = APIRouter(tags=["Users and access"])

Role = Literal["org_admin", "consultant", "analyst", "viewer"]
TeamRole = Literal["org_admin", "analyst", "viewer"]
EMAIL_HINT = "Enter a valid email"
MIN_PASSWORD = 10


def _email(v: str) -> str:
    v = v.strip().lower()
    if "@" not in v or "." not in v.split("@")[-1] or " " in v:
        raise ValueError(EMAIL_HINT)
    return v


def _password(v: str | None) -> str | None:
    if v is not None and len(v) < MIN_PASSWORD:
        raise ValueError(f"Use at least {MIN_PASSWORD} characters")
    return v


class MembershipIn(BaseModel):
    tenant_id: uuid.UUID
    role: Role


class MembershipOut(BaseModel):
    tenant_id: uuid.UUID
    tenant_name: str
    tenant_slug: str
    role: Role


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    status: Literal["invited", "active", "disabled"]
    is_platform_admin: bool
    last_sign_in_at: datetime | None
    created_at: datetime
    memberships: list[MembershipOut]


class UserCreate(BaseModel):
    email: str = Field(max_length=320)
    full_name: str = Field(min_length=1, max_length=255)
    is_platform_admin: bool = False
    memberships: list[MembershipIn] = Field(default_factory=list)
    password: str | None = Field(default=None, max_length=200)

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        return _email(v)

    @field_validator("password")
    @classmethod
    def _valid_password(cls, v: str | None) -> str | None:
        return _password(v)


class UserPatch(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    is_platform_admin: bool | None = None
    status: Literal["active", "disabled"] | None = None


class PasswordIn(BaseModel):
    password: str = Field(max_length=200)

    @field_validator("password")
    @classmethod
    def _valid_password(cls, v: str | None) -> str | None:
        return _password(v)


class MemberOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    status: Literal["invited", "active", "disabled"]
    role: Role
    last_sign_in_at: datetime | None
    other_workspaces: int


class MemberCreate(BaseModel):
    email: str = Field(max_length=320)
    full_name: str = Field(min_length=1, max_length=255)
    role: TeamRole
    password: str | None = Field(default=None, max_length=200)

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        return _email(v)

    @field_validator("password")
    @classmethod
    def _valid_password(cls, v: str | None) -> str | None:
        return _password(v)


class MemberPatch(BaseModel):
    role: TeamRole


# --- shared ---------------------------------------------------------------------------


def _user_out(u: User) -> UserOut:
    return UserOut(
        id=u.id,
        email=u.email,
        full_name=u.full_name,
        status=u.status.value,
        is_platform_admin=u.is_platform_admin,
        last_sign_in_at=u.last_sign_in_at,
        created_at=u.created_at,
        memberships=[
            MembershipOut(
                tenant_id=m.tenant_id, tenant_name=m.tenant.name, tenant_slug=m.tenant.slug, role=m.role.value
            )
            for m in sorted(u.memberships, key=lambda m: m.tenant.name)
        ],
    )


async def _end_sessions(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )


async def _user(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise ProblemError(404, "User not found.")
    await db.refresh(user, ["memberships"])
    return user


async def _set_password(db: AsyncSession, user: User, password: str) -> None:
    user.password_hash = hash_password(password)
    user.status = UserStatus.ACTIVE
    user.failed_login_count, user.locked_until = 0, None
    await _end_sessions(db, user.id)


# --- Platform admins: every user ----------------------------------------------------------

PlatformAdmin = Annotated[Principal, Depends(require_permission(Perm.PLATFORM_USERS_MANAGE))]


@router.get("/admin/users", response_model=list[UserOut], summary="All users")
async def list_users(_: PlatformAdmin, db: PlatformDB) -> list[UserOut]:
    users = (await db.scalars(select(User).order_by(User.full_name))).all()
    return [_user_out(u) for u in users]


@router.post("/admin/users", response_model=UserOut, status_code=status.HTTP_201_CREATED, summary="Add a user")
async def create_user(payload: UserCreate, principal: PlatformAdmin, db: PlatformDB) -> UserOut:
    existing = await repo.get_user_by_email(db, payload.email)
    if existing and existing.status != UserStatus.INVITED:
        raise invalid_field("email", "A user with this email already exists")
    if not payload.is_platform_admin and not payload.memberships:
        raise invalid_field("memberships", "Choose at least one workspace")
    user = await repo.upsert_user(
        db,
        email=payload.email,
        full_name=payload.full_name.strip(),
        is_platform_admin=payload.is_platform_admin,
        status=UserStatus.INVITED,
    )
    if payload.password:
        await _set_password(db, user, payload.password)
    for m in payload.memberships:
        if await db.get(Tenant, m.tenant_id) is None:
            raise invalid_field("memberships", "Choose an existing workspace")
        await repo.ensure_membership(db, tenant_id=m.tenant_id, user_id=user.id, role=TenantRole(m.role))
    user = await _user(db, user.id)
    await record_audit(
        db,
        principal=principal,
        action="user.created",
        entity_type="user",
        entity_id=user.id,
        after={
            "email": user.email,
            "status": user.status.value,
            "platform_admin": user.is_platform_admin,
            "workspaces": [m.tenant.slug for m in user.memberships],
        },
    )
    return _user_out(user)


@router.patch("/admin/users/{user_id}", response_model=UserOut, summary="Edit, disable or enable a user")
async def update_user(user_id: uuid.UUID, payload: UserPatch, principal: PlatformAdmin, db: PlatformDB) -> UserOut:
    user = await _user(db, user_id)
    if user.id == principal.user_id and (payload.status == "disabled" or payload.is_platform_admin is False):
        raise ProblemError(409, "You cannot disable yourself or remove your own platform access.")
    before = {"full_name": user.full_name, "status": user.status.value, "platform_admin": user.is_platform_admin}
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.is_platform_admin is not None:
        user.is_platform_admin = payload.is_platform_admin
    if payload.status == "disabled":
        user.status = UserStatus.DISABLED
        await _end_sessions(db, user.id)
    elif payload.status == "active" and user.status == UserStatus.DISABLED:
        user.status = UserStatus.ACTIVE if user.password_hash else UserStatus.INVITED
    await db.flush()
    await record_audit(
        db,
        principal=principal,
        action="user.updated",
        entity_type="user",
        entity_id=user.id,
        before=before,
        after={"full_name": user.full_name, "status": user.status.value, "platform_admin": user.is_platform_admin},
    )
    return _user_out(user)


@router.put("/admin/users/{user_id}/memberships", response_model=UserOut, summary="Set a user's workspaces")
async def set_memberships(
    user_id: uuid.UUID, payload: list[MembershipIn], principal: PlatformAdmin, db: PlatformDB
) -> UserOut:
    user = await _user(db, user_id)
    if not payload and not user.is_platform_admin:
        raise invalid_field("memberships", "Choose at least one workspace")
    before = {m.tenant.slug: m.role.value for m in user.memberships}
    wanted = {m.tenant_id: m.role for m in payload}
    for m in list(user.memberships):
        if m.tenant_id not in wanted:
            await db.delete(m)
    for tenant_id, role in wanted.items():
        if await db.get(Tenant, tenant_id) is None:
            raise invalid_field("memberships", "Choose an existing workspace")
        await repo.ensure_membership(db, tenant_id=tenant_id, user_id=user.id, role=TenantRole(role))
    await db.flush()
    await _end_sessions(db, user.id)  # their token may name a workspace they just lost
    user = await _user(db, user.id)
    await record_audit(
        db,
        principal=principal,
        action="user.workspaces_changed",
        entity_type="user",
        entity_id=user.id,
        before=before,
        after={m.tenant.slug: m.role.value for m in user.memberships},
    )
    return _user_out(user)


@router.post("/admin/users/{user_id}/password", status_code=204, summary="Set a temporary password")
async def set_password(user_id: uuid.UUID, payload: PasswordIn, principal: PlatformAdmin, db: PlatformDB) -> Response:
    user = await _user(db, user_id)
    await _set_password(db, user, payload.password)
    await record_audit(db, principal=principal, action="user.password_set", entity_type="user", entity_id=user.id)
    return Response(status_code=204)


# --- Org admins: their workspace's team ---------------------------------------------------

TeamAdmin = Annotated[Principal, Depends(require_permission(Perm.USERS_MANAGE))]


async def _member(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID) -> Membership:
    m = await db.scalar(
        select(Membership)
        .where(Membership.tenant_id == tenant_id, Membership.user_id == user_id)
        .options(selectinload(Membership.user))
    )
    if m is None:
        raise ProblemError(404, "Not a member of this workspace.")
    return m


async def _member_out(db: AsyncSession, m: Membership, user: User) -> MemberOut:
    """A member row; counts their other workspaces with a query (no lazy loading)."""
    others = await db.scalar(
        select(func.count()).where(Membership.user_id == user.id, Membership.tenant_id != m.tenant_id)
    )
    return MemberOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        status=user.status.value,
        role=m.role.value,
        last_sign_in_at=user.last_sign_in_at,
        other_workspaces=others or 0,
    )


def _workspace(principal: Principal) -> uuid.UUID:
    if principal.tenant_id is None:
        raise ProblemError(403, "Choose a workspace first.")
    return principal.tenant_id


@router.get("/team", response_model=list[MemberOut], summary="Members of this workspace")
async def list_team(principal: TeamAdmin) -> list[MemberOut]:
    tenant_id = _workspace(principal)
    async with tenant_session(tenant_id, platform_access=True) as db:
        rows = (
            await db.scalars(
                select(Membership).where(Membership.tenant_id == tenant_id).options(selectinload(Membership.user))
            )
        ).all()
        return sorted([await _member_out(db, m, m.user) for m in rows], key=lambda x: x.full_name)


@router.post("/team", response_model=MemberOut, status_code=status.HTTP_201_CREATED, summary="Add a member")
async def add_member(payload: MemberCreate, principal: TeamAdmin) -> MemberOut:
    tenant_id = _workspace(principal)
    async with tenant_session(tenant_id, platform_access=True) as db:
        user = await repo.get_user_by_email(db, payload.email)
        if user and await db.scalar(
            select(Membership).where(Membership.tenant_id == tenant_id, Membership.user_id == user.id)
        ):
            raise invalid_field("email", "Already a member of this workspace")
        if user is None:
            user = await repo.upsert_user(
                db, email=payload.email, full_name=payload.full_name.strip(), status=UserStatus.INVITED
            )
            if payload.password:
                await _set_password(db, user, payload.password)
        # An existing account keeps its own password: the team admin only adds the membership.
        m = await repo.ensure_membership(db, tenant_id=tenant_id, user_id=user.id, role=TenantRole(payload.role))
        await db.refresh(user, ["memberships"])
        await record_audit(
            db,
            principal=principal,
            action="team.member_added",
            entity_type="user",
            entity_id=user.id,
            after={"email": user.email, "role": payload.role},
        )
        return await _member_out(db, m, user)


@router.patch("/team/{user_id}", response_model=MemberOut, summary="Change a member's role")
async def change_role(user_id: uuid.UUID, payload: MemberPatch, principal: TeamAdmin) -> MemberOut:
    tenant_id = _workspace(principal)
    if user_id == principal.user_id:
        raise ProblemError(409, "You cannot change your own role.")
    async with tenant_session(tenant_id, platform_access=True) as db:
        m = await _member(db, tenant_id, user_id)
        if m.role == TenantRole.CONSULTANT:
            raise ProblemError(409, "Consultants are assigned by Monk Spaces.")
        before = m.role.value
        m.role = TenantRole(payload.role)
        await db.flush()
        await record_audit(
            db,
            principal=principal,
            action="team.role_changed",
            entity_type="user",
            entity_id=user_id,
            before={"role": before},
            after={"role": payload.role},
        )
        return await _member_out(db, m, m.user)


@router.delete("/team/{user_id}", status_code=204, summary="Remove a member from this workspace")
async def remove_member(user_id: uuid.UUID, principal: TeamAdmin) -> Response:
    tenant_id = _workspace(principal)
    if user_id == principal.user_id:
        raise ProblemError(409, "You cannot remove yourself.")
    async with tenant_session(tenant_id, platform_access=True) as db:
        m = await _member(db, tenant_id, user_id)
        if m.role == TenantRole.CONSULTANT:
            raise ProblemError(409, "Consultants are assigned by Monk Spaces.")
        await db.delete(m)
        await _end_sessions(db, user_id)
        await record_audit(db, principal=principal, action="team.member_removed", entity_type="user", entity_id=user_id)
    return Response(status_code=204)


@router.post("/team/{user_id}/password", status_code=204, summary="Set a member's temporary password")
async def reset_member_password(user_id: uuid.UUID, payload: PasswordIn, principal: TeamAdmin) -> Response:
    tenant_id = _workspace(principal)
    async with tenant_session(tenant_id, platform_access=True) as db:
        m = await _member(db, tenant_id, user_id)
        user = m.user
        elsewhere = await db.scalar(
            select(func.count()).where(Membership.user_id == user.id, Membership.tenant_id != tenant_id)
        )
        if user.is_platform_admin or elsewhere:
            raise ProblemError(403, "This person also works in other workspaces; ask Monk Spaces to reset it.")
        await _set_password(db, user, payload.password)
        await record_audit(db, principal=principal, action="team.password_set", entity_type="user", entity_id=user_id)
    return Response(status_code=204)
