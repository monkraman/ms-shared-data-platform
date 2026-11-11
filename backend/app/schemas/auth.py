"""Sign-in request and response, and the signed-in user's profile."""

from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class UserRole(StrEnum):
    SUPERADMIN = "superadmin"
    ORG_ADMIN = "org_admin"
    ANALYST = "analyst"
    VIEWER = "viewer"
    SUPPLIER_CONTACT = "supplier_contact"


# [P1] Login request
class LoginRequest(BaseModel):
    email: str = Field(..., description="Enterprise work email address", example="compliance.officer@kraftheinz.com")
    password: str = Field(..., min_length=6, description="Account password", example="password123")
    remember_me: bool = Field(default=True, description="Keep session alive across browser restarts")


# User profile info
class UserProfile(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole
    organisation_id: str | None = None
    organisation_slug: str | None = None
    organisation_name: str | None = None
    avatar_initials: str = "U"
    status: str = "active"
    mfa_enabled: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class UserCreateRequest(BaseModel):
    email: str = Field(..., description="User corporate email")
    password: str = Field(..., min_length=8, description="Initial password")
    full_name: str = Field(..., description="Full name of user")
    role: UserRole = Field(default=UserRole.ORG_ADMIN, description="Role: superadmin, org_admin, analyst")
    tenant_id: str | None = Field(default=None, description="Assigned tenant workspace slug")
    organisation_name: str | None = Field(default=None, description="Organisation display name")


# Auth token response
class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int = 86400
    user: UserProfile
    redirect_url: str = "/dashboard"
