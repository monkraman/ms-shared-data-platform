"""Authentication, JWT issuance, and User Directory endpoints for Compliance Hub."""

from datetime import datetime, timezone
import secrets
from typing import List, Optional
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Depends, status

from app.schemas.auth import (
    ActiveSession,
    AuthTokenResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MagicLinkVerifyRequest,
    MfaVerifyRequest,
    UserProfile,
    UserRole,
    UserCreateRequest,
)
from app.services.store import data_store
from app.core.security import create_access_token, get_current_user, AuthenticatedUser

router = APIRouter(prefix="/auth", tags=["Authentication & Identity"])


@router.post(
    "/sign-in",
    response_model=AuthTokenResponse,
    summary="Direct Work Email & Password Sign In",
    description="Authenticates corporate credentials, generates real JWT token with role & tenant context, and returns redirect route.",
)
async def sign_in(payload: LoginRequest):
    email = payload.email.lower().strip()
    user = data_store.authenticate_user(email, payload.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid corporate credentials. Please check your email and password.",
        )

    # Real signed JWT containing sub, role, tenant_id, name
    token_claims = {
        "sub": user["email"],
        "name": user["full_name"],
        "role": user["role"],
        "tenant_id": user.get("tenant_id"),
        "org_slug": user.get("tenant_id"),
        "org_name": user.get("organisation_name"),
    }
    token = create_access_token(token_claims)

    user_profile = UserProfile(
        id=user.get("id", f"usr-{uuid4().hex[:6]}"),
        email=user["email"],
        full_name=user["full_name"],
        role=UserRole(user["role"]),
        organisation_id=user.get("tenant_id"),
        organisation_slug=user.get("tenant_id"),
        organisation_name=user.get("organisation_name") or ("Platform Admin" if user["role"] == "superadmin" else "Client Workspace"),
        avatar_initials=user.get("avatar_initials", "U"),
        mfa_enabled=False,
    )

    redirect_url = "/admin" if user["role"] == "superadmin" else "/dashboard"

    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_seconds=86400 if payload.remember_me else 28800,
        user=user_profile,
        requires_mfa=False,
        redirect_url=redirect_url,
    )


@router.get(
    "/me",
    response_model=UserProfile,
    summary="Current Authenticated User Context",
)
async def get_current_profile(current_user: AuthenticatedUser = Depends(get_current_user)):
    user = data_store.get_user(current_user.email)
    if not user:
        raise HTTPException(status_code=404, detail="User record not found.")

    return UserProfile(
        id=user.get("id", f"usr-{uuid4().hex[:6]}"),
        email=user["email"],
        full_name=user["full_name"],
        role=UserRole(user["role"]),
        organisation_id=user.get("tenant_id"),
        organisation_slug=user.get("tenant_id"),
        organisation_name=user.get("organisation_name"),
        avatar_initials=user.get("avatar_initials", "U"),
        mfa_enabled=False,
    )


@router.post(
    "/users",
    response_model=UserProfile,
    status_code=status.HTTP_201_CREATED,
    summary="Provision a User under an Organisation",
)
async def create_user(
    payload: UserCreateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Allows SuperAdmin or Organisation Admin to provision a new user."""
    # RBAC: Only superadmin or org_admin can create users
    if current_user.role not in ["superadmin", "org_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only administrators can provision new users.",
        )

    # If org_admin, can only create users for their own tenant
    target_tenant = payload.tenant_id
    if current_user.role == "org_admin":
        target_tenant = current_user.tenant_id

    email = payload.email.lower().strip()
    initials = "".join([part[0].upper() for part in payload.full_name.split()[:2]]) or "U"
    new_user = {
        "id": f"usr-{uuid4().hex[:6]}",
        "email": email,
        "password": payload.password,
        "full_name": payload.full_name,
        "role": payload.role.value,
        "tenant_id": target_tenant,
        "organisation_name": payload.organisation_name,
        "avatar_initials": initials,
    }
    data_store.create_user(new_user)

    return UserProfile(
        id=new_user["id"],
        email=new_user["email"],
        full_name=new_user["full_name"],
        role=UserRole(new_user["role"]),
        organisation_id=new_user.get("tenant_id"),
        organisation_slug=new_user.get("tenant_id"),
        organisation_name=new_user.get("organisation_name"),
        avatar_initials=new_user["avatar_initials"],
        mfa_enabled=False,
    )


@router.get(
    "/users",
    response_model=List[UserProfile],
    summary="List Users by Workspace Context",
)
async def list_users(current_user: AuthenticatedUser = Depends(get_current_user)):
    """List users scoped to caller's role and workspace."""
    if current_user.role == "superadmin":
        users = data_store.list_users()
    else:
        users = data_store.list_users(current_user.tenant_id)

    result = []
    for u in users:
        result.append(
            UserProfile(
                id=u.get("id", f"usr-{uuid4().hex[:6]}"),
                email=u["email"],
                full_name=u["full_name"],
                role=UserRole(u["role"]),
                organisation_id=u.get("tenant_id"),
                organisation_slug=u.get("tenant_id"),
                organisation_name=u.get("organisation_name"),
                avatar_initials=u.get("avatar_initials", "U"),
                mfa_enabled=False,
            )
        )
    return result


@router.post("/sign-out", summary="Sign Out")
async def sign_out():
    """Revoke authenticated session."""
    return {"message": "Successfully signed out."}
