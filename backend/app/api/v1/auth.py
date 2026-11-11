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

from app.core.auth import CurrentPrincipal
from app.core.config import get_settings
from app.core.tenancy import tenant_session
from app.platform import sign_in as auth
from app.platform.models import Membership, Tenant, TenantRole, TenantStatus, User
from app.schemas.auth import AuthTokenResponse, LoginRequest, UserProfile, UserRole

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
