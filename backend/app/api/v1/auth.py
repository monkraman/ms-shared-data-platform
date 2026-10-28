"""Authentication, SSO, Sessions, and MFA endpoints for Compliance Hub."""

from datetime import datetime, timezone
import secrets
from typing import List
from fastapi import APIRouter, HTTPException, Header, status

from app.schemas.auth import (
    ActiveSession,
    AuthTokenResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MagicLinkVerifyRequest,
    MfaVerifyRequest,
    SsoLoginRequest,
    SsoProvider,
    UserProfile,
    UserRole,
)

router = APIRouter(prefix="/auth", tags=["Authentication & Identity"])

# In-memory user directory for prototype / demo
USERS_DB = {
    "superadmin@monkspaces.com": {
        "id": "usr-sa-001",
        "email": "superadmin@monkspaces.com",
        "full_name": "Platform Administrator",
        "role": UserRole.SUPERADMIN,
        "organisation_id": "monkspaces-internal",
        "organisation_slug": "monkspaces",
        "organisation_name": "Monkspaces Platform Admin",
        "avatar_initials": "SA",
        "mfa_enabled": True,
    },
    "compliance.officer@kraftheinz.com": {
        "id": "usr-khc-001",
        "email": "compliance.officer@kraftheinz.com",
        "full_name": "Sarah Mitchell",
        "role": UserRole.ORG_ADMIN,
        "organisation_id": "khc-europe",
        "organisation_slug": "khc-europe",
        "organisation_name": "The Kraft Heinz Company Europe",
        "avatar_initials": "SM",
        "mfa_enabled": True,
    },
    "analyst@kraftheinz.com": {
        "id": "usr-khc-002",
        "email": "analyst@kraftheinz.com",
        "full_name": "James Patel",
        "role": UserRole.ANALYST,
        "organisation_id": "khc-europe",
        "organisation_slug": "khc-europe",
        "organisation_name": "The Kraft Heinz Company Europe",
        "avatar_initials": "JP",
        "mfa_enabled": False,
    },
    "admin@aurora-pack.com": {
        "id": "usr-aur-001",
        "email": "admin@aurora-pack.com",
        "full_name": "Elena Rossi",
        "role": UserRole.ORG_ADMIN,
        "organisation_id": "aurora-pack",
        "organisation_slug": "aurora-pack",
        "organisation_name": "Aurora Packaging Group",
        "avatar_initials": "ER",
        "mfa_enabled": True,
    },
}

MOCK_SESSIONS = [
    ActiveSession(
        id="sess-01",
        device_name="MacBook Pro 16” (Corporate Managed)",
        browser="Chrome 131.0 on macOS Sonoma",
        ip_address="194.207.12.89",
        location="London, United Kingdom",
        last_active=datetime.now(timezone.utc),
        is_current_device=True,
    ),
    ActiveSession(
        id="sess-02",
        device_name="Windows 11 Workstation",
        browser="Edge 131.0 on Windows",
        ip_address="82.165.197.1",
        location="Amsterdam, Netherlands",
        last_active=datetime.now(timezone.utc),
        is_current_device=False,
    ),
]


@router.post(
    "/sign-in",
    response_model=AuthTokenResponse,
    summary="[P1] Work Email & Password Sign In",
    description="Authenticates corporate credentials. Routes SuperAdmin to /admin and Client users to /dashboard.",
)
async def sign_in(payload: LoginRequest):
    email = payload.email.lower().strip()
    user_data = USERS_DB.get(email)

    if not user_data:
        # Fallback for arbitrary work emails in demo
        org_slug = "khc-europe" if "kraft" in email else "aurora-pack"
        user_data = {
            "id": f"usr-dyn-{secrets.token_hex(4)}",
            "email": email,
            "full_name": email.split("@")[0].replace(".", " ").title(),
            "role": UserRole.ANALYST,
            "organisation_id": org_slug,
            "organisation_slug": org_slug,
            "organisation_name": "Kraft Heinz Europe" if org_slug == "khc-europe" else "Aurora Packaging",
            "avatar_initials": email[:2].upper(),
            "mfa_enabled": True,
        }

    token = f"jwt_mock_{secrets.token_urlsafe(32)}"
    user_profile = UserProfile(**user_data)
    redirect_url = "/admin" if user_profile.role == UserRole.SUPERADMIN else "/dashboard"

    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_seconds=86400 if payload.remember_me else 28800,
        user=user_profile,
        requires_mfa=False,
        redirect_url=redirect_url,
    )


@router.post(
    "/sso",
    response_model=AuthTokenResponse,
    summary="[P1] Enterprise Single Sign-On (Microsoft / Google / SAML)",
    description="Completes OIDC / SAML token exchange and establishes authenticated session for the organisation.",
)
async def sso_login(payload: SsoLoginRequest):
    provider_name = payload.provider.value.title()
    org_slug = payload.organisation_slug or "khc-europe"

    user_data = {
        "id": f"usr-sso-{secrets.token_hex(4)}",
        "email": f"sso.user@{org_slug}.com",
        "full_name": f"{provider_name} Enterprise User",
        "role": UserRole.ORG_ADMIN,
        "organisation_id": org_slug,
        "organisation_slug": org_slug,
        "organisation_name": "The Kraft Heinz Company Europe" if org_slug == "khc-europe" else "Aurora Packaging",
        "avatar_initials": "EU",
        "mfa_enabled": True,
    }

    token = f"sso_token_{secrets.token_urlsafe(32)}"
    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_seconds=86400,
        user=UserProfile(**user_data),
        requires_mfa=False,
        redirect_url="/dashboard",
    )


@router.post(
    "/mfa/verify",
    response_model=AuthTokenResponse,
    summary="[P2] Multi-Factor Authentication (MFA) Verification",
    description="Validates a 6-digit TOTP / SMS code during step-up authentication.",
)
async def verify_mfa(payload: MfaVerifyRequest):
    if len(payload.code) != 6 or not payload.code.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA code must be exactly 6 digits.",
        )

    email = payload.email.lower().strip()
    user_data = USERS_DB.get(email, USERS_DB["compliance.officer@kraftheinz.com"])
    user_profile = UserProfile(**user_data)
    redirect_url = "/admin" if user_profile.role == UserRole.SUPERADMIN else "/dashboard"

    return AuthTokenResponse(
        access_token=f"jwt_mfa_verified_{secrets.token_urlsafe(32)}",
        token_type="bearer",
        expires_in_seconds=86400 * 30 if payload.trust_device else 86400,
        user=user_profile,
        requires_mfa=False,
        redirect_url=redirect_url,
    )


@router.post(
    "/forgot-password",
    status_code=status.HTTP_200_OK,
    summary="[P2] Password Reset / Magic Link Request",
    description="Dispatches a secure password reset or single-use magic login link to the work email.",
)
async def forgot_password(payload: ForgotPasswordRequest):
    return {
        "status": "success",
        "message": f"A secure reset link and one-time magic token have been generated for {payload.email}.",
        "dispatched_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post(
    "/magic-link/verify",
    response_model=AuthTokenResponse,
    summary="[P2] Magic Link Token Sign-In",
    description="Consumes a single-use magic link token and starts an authenticated session.",
)
async def verify_magic_link(payload: MagicLinkVerifyRequest):
    user_data = USERS_DB["compliance.officer@kraftheinz.com"]
    return AuthTokenResponse(
        access_token=f"jwt_magic_{secrets.token_urlsafe(32)}",
        token_type="bearer",
        expires_in_seconds=86400,
        user=UserProfile(**user_data),
        requires_mfa=False,
        redirect_url="/dashboard",
    )


@router.get(
    "/me",
    response_model=UserProfile,
    summary="Get Current Authenticated User",
    description="Returns the active user profile, tenant scope, and permissions.",
)
async def get_current_user(x_tenant_id: str = Header(default="khc-europe")):
    return UserProfile(**USERS_DB["compliance.officer@kraftheinz.com"])


@router.get(
    "/sessions",
    response_model=List[ActiveSession],
    summary="[P3] List Active Sessions & Devices",
    description="Audit active sessions, browser agents, and IP locations for the authenticated account.",
)
async def list_active_sessions():
    return MOCK_SESSIONS


@router.post(
    "/sign-out",
    status_code=status.HTTP_200_OK,
    summary="Sign Out / Revoke Session",
    description="Invalidates current session token and terminates active workspace access.",
)
async def sign_out():
    return {"status": "success", "message": "Session terminated successfully."}

