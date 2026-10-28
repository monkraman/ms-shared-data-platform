"""Pydantic schemas for Authentication, SSO, Sessions, and MFA."""

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


class UserRole(str, Enum):
    SUPERADMIN = "superadmin"
    ORG_ADMIN = "org_admin"
    ANALYST = "analyst"
    VIEWER = "viewer"
    SUPPLIER_CONTACT = "supplier_contact"


class SsoProvider(str, Enum):
    MICROSOFT = "microsoft"
    GOOGLE = "google"
    SAML = "saml"


# [P1] Login request
class LoginRequest(BaseModel):
    email: str = Field(..., description="Enterprise work email address", example="compliance.officer@kraftheinz.com")
    password: str = Field(..., min_length=6, description="Account password", example="password123")
    remember_me: bool = Field(default=True, description="Keep session alive across browser restarts")


# [P1] SSO request
class SsoLoginRequest(BaseModel):
    provider: SsoProvider = Field(..., description="Identity Provider: microsoft, google, or saml")
    organisation_slug: Optional[str] = Field(default="khc-europe", description="Target workspace domain / slug")
    id_token: Optional[str] = Field(default=None, description="OIDC ID Token from provider (mocked in demo)")


# [P2] MFA Verification
class MfaVerifyRequest(BaseModel):
    email: str = Field(..., description="Email for pending MFA challenge")
    code: str = Field(..., min_length=6, max_length=6, description="6-digit TOTP / SMS code", example="123456")
    trust_device: bool = Field(default=True, description="Bypass MFA on this device for 30 days")


# [P2] Password Reset / Magic Link
class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., description="Work email to receive reset instructions or magic link")


class MagicLinkVerifyRequest(BaseModel):
    token: str = Field(..., description="One-time secure authentication token")


# User profile info
class UserProfile(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole
    organisation_id: str
    organisation_slug: str
    organisation_name: str
    avatar_initials: str
    mfa_enabled: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# Auth token response
class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int = 86400
    user: UserProfile
    requires_mfa: bool = False
    redirect_url: str = "/dashboard"


# [P3] Active Session representation
class ActiveSession(BaseModel):
    id: str
    device_name: str
    browser: str
    ip_address: str
    location: str
    last_active: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_current_device: bool = False

