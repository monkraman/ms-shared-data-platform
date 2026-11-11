"""Sign-in, session and user directory endpoints.

The paths and response shapes are the prototype's, so the existing sign-in page and IAM
directory keep working; behind them users live in the database with Argon2 passwords.

Session: a 15-minute access token in the response body, and an 8-hour refresh token in
an httpOnly cookie (``ch_refresh``, path ``/api/v1/auth``) for ``POST /auth/refresh``.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Cookie, Response, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.audit import record_audit
from app.core.auth import CurrentPrincipal, Principal
from app.core.config import get_settings
from app.core.errors import ProblemError
from app.core.permissions import Perm
from app.core.tenancy import tenant_session
from app.platform import repository as repo
from app.platform import sign_in as auth
from app.platform.models import Membership, Tenant, TenantRole, TenantStatus, User, UserStatus
from app.platform.passwords import hash_password
from app.schemas.auth import AuthTokenResponse, LoginRequest, UserCreateRequest, UserProfile, UserRole

router = APIRouter(prefix="/auth", tags=["Authentication & Identity"])

REFRESH_COOKIE = "ch_refresh"
COOKIE_PATH = "/api/v1/auth"


# --- Session -----------------------------------------------------------------------


def _initials(name: str) -> str:
    parts = name.split()
    return ("".join(p[0] for p in parts[:1] + parts[1:][-1:]) or "U").upper()


def _profile(user: User, tenant: Tenant | None, role: TenantRole | None) -> UserProfile:
    return UserProfile(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=UserRole(auth.legacy_role(user, role)),
        organisation_id=tenant.slug if tenant else None,
        organisation_slug=tenant.slug if tenant else None,
        organisation_name=tenant.name if tenant else "Compliance Hub Platform",
        avatar_initials=_initials(user.full_name),
        status=user.status.value,
    )


def _session_response(response: Response, session: auth.Session) -> AuthTokenResponse:
    settings = get_settings()
    response.set_cookie(
        REFRESH_COOKIE,
        session.refresh_token,
        max_age=auth.REFRESH_HOURS * 3600,
        path=COOKIE_PATH,
        httponly=True,
        secure=settings.app_env not in ("development", "test"),
        samesite="lax",
    )
    profile = _profile(session.user, session.tenant, session.role)
    return AuthTokenResponse(
        access_token=session.access_token,
        expires_in_seconds=settings.access_token_minutes * 60,
        user=profile,
        redirect_url="/admin" if profile.role == UserRole.SUPERADMIN else "/dashboard",
    )


@router.post(
    "/sign-in",
    response_model=AuthTokenResponse,
    summary="Sign in with work email and password",
    responses={401: {"description": "Wrong email or password"}, 429: {"description": "Locked for 15 minutes"}},
)
async def sign_in(payload: LoginRequest, response: Response) -> AuthTokenResponse:
    return _session_response(response, await auth.sign_in(payload.email, payload.password))


@router.post("/refresh", response_model=AuthTokenResponse, summary="Renew the session from the refresh cookie")
async def refresh(response: Response, ch_refresh: str | None = Cookie(default=None)) -> AuthTokenResponse:
    return _session_response(response, await auth.refresh(ch_refresh))


class SwitchTenantRequest(BaseModel):
    tenant_id: uuid.UUID


@router.post("/switch-tenant", response_model=AuthTokenResponse, summary="Switch to another workspace")
async def switch_tenant(
    payload: SwitchTenantRequest,
    principal: CurrentPrincipal,
    response: Response,
    ch_refresh: str | None = Cookie(default=None),
) -> AuthTokenResponse:
    return _session_response(response, await auth.switch_tenant(principal.user_id, payload.tenant_id, ch_refresh))


@router.post("/sign-out", status_code=status.HTTP_204_NO_CONTENT, summary="Sign out")
async def sign_out(response: Response, ch_refresh: str | None = Cookie(default=None)) -> Response:
    await auth.sign_out(ch_refresh)
    response.status_code = status.HTTP_204_NO_CONTENT
    response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH)
    return response


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
    brand_color: str
    logo_url: str | None


class MeMembership(BaseModel):
    tenant: MeTenant
    role: TenantRole


class MeResponse(BaseModel):
    user: MeUser
    active_tenant: MeTenant | None
    permissions: list[str]
    memberships: list[MeMembership]


def _tenant(t: Tenant) -> MeTenant:
    return MeTenant(id=t.id, slug=t.slug, name=t.name, status=t.status, brand_color=t.brand_color, logo_url=t.logo_url)


@router.get("/me", response_model=MeResponse, summary="Current session")
async def get_me(principal: CurrentPrincipal) -> MeResponse:
    async with tenant_session(None) as db:
        rows = (
            await db.scalars(
                select(Membership).where(Membership.user_id == principal.user_id).order_by(Membership.created_at)
            )
        ).all()
        active = await db.get(Tenant, principal.tenant_id) if principal.tenant_id else None
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


# --- User directory (prototype IAM page; screen 9 replaces it) ----------------------


_TENANT_ROLES = {r.value for r in TenantRole}


def _directory_scope(principal: Principal) -> uuid.UUID | None:
    """Platform admins see everyone; org admins only their workspace; others nothing."""
    if principal.is_platform_admin:
        return None
    if principal.tenant_id is None or not principal.has(Perm.USERS_MANAGE):
        raise ProblemError(403, "You do not have permission to do this.", extra={"permission": Perm.USERS_MANAGE})
    return principal.tenant_id


@router.post("/users", response_model=UserProfile, status_code=status.HTTP_201_CREATED, summary="Add a user")
async def create_user(payload: UserCreateRequest, principal: CurrentPrincipal) -> UserProfile:
    own_tenant = _directory_scope(principal)
    is_admin = payload.role == UserRole.SUPERADMIN
    if is_admin and not principal.is_platform_admin:
        raise ProblemError(403, "You do not have permission to do this.")

    async with tenant_session(None, platform_access=True) as db:
        existing = await repo.get_user_by_email(db, payload.email)
        # Platform admins activate an invited user (for example a workspace's first org admin)
        # with this password until invitation emails exist; anyone else already has an account.
        if existing and (existing.status != UserStatus.INVITED or not principal.is_platform_admin):
            raise ProblemError(
                409,
                "A user with this email already exists.",
                extra={"errors": [{"loc": ["body", "email"], "msg": "Already in use", "type": "conflict"}]},
            )
        tenant = None
        if not is_admin:
            if own_tenant:
                tenant = await db.get(Tenant, own_tenant)
            elif payload.tenant_id:
                tenant = await repo.get_tenant_by_slug(db, payload.tenant_id)
            if tenant is None:
                raise ProblemError(422, "Choose a workspace for this user.")
        user = await repo.upsert_user(
            db,
            email=payload.email,
            full_name=payload.full_name,
            is_platform_admin=is_admin,
            password_hash=hash_password(payload.password),
            status=UserStatus.ACTIVE,
        )
        role = None
        if tenant:
            role = TenantRole(payload.role.value) if payload.role.value in _TENANT_ROLES else TenantRole.VIEWER
            await repo.ensure_membership(db, tenant_id=tenant.id, user_id=user.id, role=role)
        await record_audit(
            db,
            principal=principal,
            tenant_id=tenant.id if tenant else None,
            action="user.activated" if existing else "user.created",
            entity_type="user",
            entity_id=user.id,
            after={"email": user.email, "role": payload.role.value, "tenant": tenant.slug if tenant else None},
        )
        return _profile(user, tenant, role)


@router.get("/users", response_model=list[UserProfile], summary="List users")
async def list_users(principal: CurrentPrincipal) -> list[UserProfile]:
    own_tenant = _directory_scope(principal)
    async with tenant_session(None) as db:
        query = select(User).order_by(User.created_at)
        if own_tenant:
            query = query.join(Membership).where(Membership.tenant_id == own_tenant)
        users = (await db.scalars(query)).all()
        result = []
        for user in users:
            memberships = [m for m in user.memberships if own_tenant is None or m.tenant_id == own_tenant]
            if not memberships:
                result.append(_profile(user, None, None))
            for m in memberships:
                result.append(_profile(user, m.tenant, m.role))
        return result
