"""Sign-in, session refresh, workspace switch and sign-out.

* Passwords are checked against Argon2 hashes; 5 failures lock the account for 15 minutes.
* The access token lives 15 minutes. The refresh token (8 hours) is a random secret sent as
  an httpOnly cookie; only its SHA-256 hash is stored, and it is replaced on every refresh.
* Every sign-in, failure, switch and sign-out is audited.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import record_audit
from app.core.auth import create_platform_token
from app.core.db import utcnow
from app.core.errors import ProblemError
from app.core.tenancy import tenant_session
from app.platform import bootstrap
from app.platform.models import Membership, RefreshToken, Tenant, TenantRole, TenantStatus, User, UserStatus
from app.platform.passwords import hash_password, verify_password

LOCK_AFTER_FAILURES = 5
LOCK_MINUTES = 15
REFRESH_HOURS = 8

_INVALID = "Incorrect email or password."
# Verifying against a real hash for unknown emails keeps response times alike.
_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


@dataclass(frozen=True)
class Session:
    user: User
    tenant: Tenant | None
    role: TenantRole | None
    access_token: str
    refresh_token: str


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def legacy_role(user: User, role: TenantRole | None) -> str:
    """Role name the prototype's pages understand."""
    if user.is_platform_admin and role is None:
        return "superadmin"
    return (role or TenantRole.VIEWER).value


async def sign_in(email: str, password: str) -> Session:
    email = email.strip().lower()
    # Failures are recorded (audit, lockout counter) and committed before the error is raised.
    failure: ProblemError | None = None
    async with tenant_session(None, platform_access=True) as db:
        user = await db.scalar(select(User).where(User.email == email))
        if user is None:
            user = await bootstrap.import_user(db, email)

        now = utcnow()
        if user is None:
            verify_password(_DUMMY_HASH, password)
            await record_audit(db, action="auth.sign_in_failed", entity_type="user", actor_email=email)
            failure = ProblemError(401, _INVALID)
        elif user.locked_until and user.locked_until > now:
            failure = ProblemError(429, "Too many attempts. Try again in 15 minutes.")
        elif not verify_password(user.password_hash, password):
            user.failed_login_count += 1
            if user.failed_login_count >= LOCK_AFTER_FAILURES:
                user.failed_login_count = 0
                user.locked_until = now + timedelta(minutes=LOCK_MINUTES)
                await record_audit(db, action="auth.locked", entity_type="user", entity_id=user.id, actor_email=email)
            await record_audit(
                db, action="auth.sign_in_failed", entity_type="user", entity_id=user.id, actor_email=email
            )
            failure = ProblemError(401, _INVALID)
        elif user.status != UserStatus.ACTIVE:
            failure = ProblemError(403, "Your account is not active.")
        else:
            user.failed_login_count, user.locked_until, user.last_sign_in_at = 0, None, now
            session = await _issue(db, user, _default_membership(user))
            await record_audit(
                db,
                action="auth.signed_in",
                entity_type="user",
                entity_id=user.id,
                tenant_id=session.tenant.id if session.tenant else None,
                actor_email=email,
            )

    if failure:
        raise failure
    return session


async def refresh(raw_refresh: str | None) -> Session:
    """Exchange a refresh token for a new access token and a new refresh token."""
    if not raw_refresh:
        raise ProblemError(401, "Sign in to continue.")
    async with tenant_session(None, platform_access=True) as db:
        token = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == _hash(raw_refresh)))
        now = utcnow()
        if token is None or token.revoked_at or token.expires_at <= now:
            raise ProblemError(401, "Your session has expired. Please sign in again.")
        token.revoked_at = now
        user = await db.get(User, token.user_id)
        if user is None or user.status != UserStatus.ACTIVE:
            raise ProblemError(401, "Your account is not active.")
        membership = _membership_for(user, token.tenant_id)
        if token.tenant_id and membership is None and not user.is_platform_admin:
            raise ProblemError(401, "You no longer have access to this workspace.")
        tenant = await db.get(Tenant, token.tenant_id) if token.tenant_id else None
        return await _issue(db, user, membership, tenant=tenant, expires_at=token.expires_at)


async def switch_tenant(user_id: uuid.UUID, tenant_id: uuid.UUID, raw_refresh: str | None) -> Session:
    """Move the signed-in user to another workspace they belong to."""
    async with tenant_session(None, platform_access=True) as db:
        user = await db.get(User, user_id)
        if user is None or user.status != UserStatus.ACTIVE:
            raise ProblemError(401, "Your account is not active.")
        tenant = await db.get(Tenant, tenant_id)
        membership = _membership_for(user, tenant_id)
        if tenant is None or (membership is None and not user.is_platform_admin):
            raise ProblemError(403, "You do not have access to this workspace.")
        if tenant.status == TenantStatus.SUSPENDED and not user.is_platform_admin:
            raise ProblemError(403, "This workspace is suspended.")
        await _revoke(db, raw_refresh)
        session = await _issue(db, user, membership, tenant=tenant)
        await record_audit(
            db,
            action="auth.switched_workspace",
            entity_type="tenant",
            entity_id=tenant.id,
            tenant_id=tenant.id,
            actor_email=user.email,
        )
        return session


async def sign_out(raw_refresh: str | None, user_email: str | None = None) -> None:
    async with tenant_session(None, platform_access=True) as db:
        if await _revoke(db, raw_refresh):
            await record_audit(db, action="auth.signed_out", entity_type="user", actor_email=user_email)


# --- helpers -----------------------------------------------------------------------


def _default_membership(user: User) -> Membership | None:
    """First active workspace; platform admins without one start in the admin console."""
    active = [m for m in user.memberships if m.tenant.status != TenantStatus.SUSPENDED]
    return sorted(active, key=lambda m: m.created_at)[0] if active else None


def _membership_for(user: User, tenant_id: uuid.UUID | None) -> Membership | None:
    return next((m for m in user.memberships if m.tenant_id == tenant_id), None)


async def _issue(
    db: AsyncSession,
    user: User,
    membership: Membership | None,
    *,
    tenant: Tenant | None = None,
    expires_at=None,
) -> Session:
    tenant = tenant or (membership.tenant if membership else None)
    role = membership.role if membership else None
    raw = secrets.token_urlsafe(48)
    db.add(
        RefreshToken(
            user_id=user.id,
            tenant_id=tenant.id if tenant else None,
            token_hash=_hash(raw),
            # A refresh never extends the session beyond 8 hours from sign-in.
            expires_at=expires_at or utcnow() + timedelta(hours=REFRESH_HOURS),
        )
    )
    access = create_platform_token(user.id, tenant.id if tenant else None)
    return Session(user=user, tenant=tenant, role=role, access_token=access, refresh_token=raw)


async def _revoke(db: AsyncSession, raw_refresh: str | None) -> bool:
    if not raw_refresh:
        return False
    result = await db.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == _hash(raw_refresh), RefreshToken.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )
    return bool(result.rowcount)
