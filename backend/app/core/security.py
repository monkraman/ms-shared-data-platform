"""Multi-tenant security context, JWT token handling, and role-based request authorization."""

from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Header, Query, HTTPException, Depends, status
import jwt
from pydantic import BaseModel

SECRET_KEY = "monkspaces-compliance-hub-enterprise-secret-key-2026"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24


class AuthenticatedUser(BaseModel):
    email: str
    full_name: str
    role: str  # "superadmin" | "org_admin" | "analyst"
    tenant_id: Optional[str] = None  # None for superadmin


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generate a signed HS256 JWT access token carrying user identity, role, and tenant context."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    )
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate signature of an incoming JWT token."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        return None


def get_current_user_optional(
    authorization: Optional[str] = Header(None, description="Bearer <JWT> authorization header"),
) -> Optional[AuthenticatedUser]:
    """Extract authenticated user profile from Authorization header if present."""
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.split("Bearer ", 1)[1].strip()
    payload = decode_access_token(token)
    if not payload:
        return None

    email = payload.get("sub")
    if not email:
        return None

    return AuthenticatedUser(
        email=email,
        full_name=payload.get("name", "Enterprise User"),
        role=payload.get("role", "org_admin"),
        tenant_id=payload.get("tenant_id") or payload.get("org_slug"),
    )


def get_current_user(
    current_user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
) -> AuthenticatedUser:
    """Require an authenticated user token."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in with work credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user


def get_current_tenant_id(
    x_tenant_id: Optional[str] = Header(None, description="Active tenant context header"),
    tenant_id: Optional[str] = Query(None, description="Optional tenant query override"),
    current_user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
) -> str:
    """Extract and validate the active tenant context with strict RBAC enforcement.
    
    Rules:
    1. If user is SUPERADMIN:
       - Free to operate on any tenant.
       - Uses x_tenant_id / query param, or defaults to 'khc-europe'.
    2. If user is ORG_ADMIN / ANALYST:
       - Locked strictly to their assigned organization tenant_id!
       - If they try to request another tenant, HTTP 403 Forbidden is raised.
    3. If unauthenticated (demo / test calls):
       - Fallback to x_tenant_id or 'khc-europe'.
    """
    requested_tenant = x_tenant_id or tenant_id

    if current_user:
        if current_user.role == "superadmin":
            resolved = requested_tenant or "khc-europe"
            return resolved.strip()
        
        # Org user: MUST only access their assigned tenant
        user_tenant = current_user.tenant_id
        if not user_tenant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account has no assigned organization workspace.",
            )
        
        # If client passed a different tenant, block cross-tenant leakage!
        if requested_tenant and requested_tenant != user_tenant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: You do not have permissions to access workspace '{requested_tenant}'.",
            )
        return user_tenant

    # Unauthenticated fallback (for tests / backward compatibility)
    resolved_tenant = requested_tenant or "khc-europe"
    return resolved_tenant.strip()
