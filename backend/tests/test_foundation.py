"""Step 0 foundation: errors, request IDs, permissions, RLS tenant isolation, audit, jobs."""

from __future__ import annotations

import time
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError

from app.core.audit import AuditEvent, record_audit
from app.core.auth import create_platform_token, load_principal
from app.core.jobs import Job, JobStatus, enqueue
from app.core.permissions import PLATFORM_ADMIN_PERMISSIONS, Perm, permissions_for
from app.core.security import create_access_token
from app.core.tenancy import tenant_session
from app.platform import repository as repo
from app.platform.models import TenantRole, TenantStatus

# --- No database needed ------------------------------------------------------------


def test_problem_details_for_unauthenticated(client: TestClient) -> None:
    res = client.get(f"/api/v1/jobs/{uuid.uuid4()}")
    assert res.status_code == 401
    assert res.headers["content-type"].startswith("application/problem+json")
    body = res.json()
    assert body["status"] == 401 and body["title"] == "Unauthorized"
    assert body["request_id"] == res.headers["X-Request-ID"]
    assert res.headers["WWW-Authenticate"] == "Bearer"


def test_request_id_is_echoed_when_safe(client: TestClient) -> None:
    assert client.get("/health", headers={"X-Request-ID": "abc-123"}).headers["X-Request-ID"] == "abc-123"
    unsafe = client.get("/health", headers={"X-Request-ID": "bad id\n"}).headers["X-Request-ID"]
    assert unsafe != "bad id\n" and len(unsafe) == 32


def test_prototype_tokens_are_refused(client: TestClient) -> None:
    legacy = create_access_token({"sub": "a@b.test", "role": "superadmin"})
    res = client.get(f"/api/v1/jobs/{uuid.uuid4()}", headers={"Authorization": f"Bearer {legacy}"})
    assert res.status_code == 401


def test_permissions_by_role() -> None:
    org = permissions_for(is_platform_admin=False, tenant_role=TenantRole.ORG_ADMIN, has_tenant=True)
    assert Perm.JOBS_READ in org and not org & PLATFORM_ADMIN_PERMISSIONS
    platform_only = permissions_for(is_platform_admin=True, tenant_role=None, has_tenant=False)
    assert platform_only == PLATFORM_ADMIN_PERMISSIONS
    assert permissions_for(is_platform_admin=False, tenant_role=None, has_tenant=True) == frozenset()


# --- PostgreSQL with RLS -----------------------------------------------------------


@pytest.fixture(scope="module")
def world(db_client: TestClient) -> dict[str, uuid.UUID]:
    """Two tenants, an org admin in each, a platform admin, and a suspended tenant."""

    async def build() -> dict[str, uuid.UUID]:
        suffix = uuid.uuid4().hex[:6]
        async with tenant_session(None, platform_access=True) as s:
            a = await repo.upsert_tenant(s, slug=f"a-{suffix}", name="Tenant A", status=TenantStatus.ACTIVE)
            b = await repo.upsert_tenant(s, slug=f"b-{suffix}", name="Tenant B", status=TenantStatus.ACTIVE)
            c = await repo.upsert_tenant(s, slug=f"c-{suffix}", name="Tenant C", status=TenantStatus.SUSPENDED)
            ua = await repo.upsert_user(s, email=f"A-{suffix}@x.test", full_name="A Admin")
            ub = await repo.upsert_user(s, email=f"b-{suffix}@x.test", full_name="B Admin")
            uc = await repo.upsert_user(s, email=f"c-{suffix}@x.test", full_name="C Admin")
            sa = await repo.upsert_user(s, email=f"sa-{suffix}@x.test", full_name="SA", is_platform_admin=True)
            for tenant, user in ((a, ua), (b, ub), (c, uc)):
                await repo.ensure_membership(s, tenant_id=tenant.id, user_id=user.id, role=TenantRole.ORG_ADMIN)
            return {"a": a.id, "b": b.id, "c": c.id, "ua": ua.id, "ub": ub.id, "uc": uc.id, "sa": sa.id}

    return db_client.portal.call(build)


def _auth(user_id: uuid.UUID, tenant_id: uuid.UUID | None) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_platform_token(user_id, tenant_id)}"}


def test_app_role_is_subject_to_rls(db_client: TestClient) -> None:
    """Every transaction runs as the restricted role, whatever the login role may do."""

    async def check() -> tuple[str, bool, bool]:
        async with tenant_session(None) as s:
            row = (
                await s.execute(
                    text("SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user")
                )
            ).one()
            return row[0], row[1], row[2]

    assert db_client.portal.call(check) == ("compliance_rls", False, False)


def test_emails_are_stored_lower_case(db_client: TestClient, world: dict[str, uuid.UUID]) -> None:
    async def email() -> str:
        return (await load_principal(world["ua"], world["a"])).email

    stored = db_client.portal.call(email)
    assert stored.startswith("a-") and stored == stored.lower()


def test_tenant_isolation_on_jobs(db_client: TestClient, world: dict[str, uuid.UUID]) -> None:
    async def create_job() -> uuid.UUID:
        principal = await load_principal(world["ua"], world["a"])
        async with tenant_session(world["a"]) as s:
            job = await enqueue(s, principal, "system.echo", {"hello": "a"})
            return job.id

    job_id = db_client.portal.call(create_job)

    # The owner sees it finish (inline runner, no Redis).
    deadline = time.time() + 10
    while True:
        res = db_client.get(f"/api/v1/jobs/{job_id}", headers=_auth(world["ua"], world["a"]))
        assert res.status_code == 200, res.text
        if res.json()["status"] in ("succeeded", "failed") or time.time() > deadline:
            break
        time.sleep(0.05)
    assert res.json()["status"] == "succeeded"
    assert res.json()["result"] == {"echo": {"hello": "a"}}

    # Tenant B's admin cannot see it, whether asking in their own tenant...
    res = db_client.get(f"/api/v1/jobs/{job_id}", headers=_auth(world["ub"], world["b"]))
    assert res.status_code == 404
    # ...or by putting tenant A into a token for themselves.
    res = db_client.get(f"/api/v1/jobs/{job_id}", headers=_auth(world["ub"], world["a"]))
    assert res.status_code == 403

    async def counts() -> tuple[int, int, int]:
        async with tenant_session(world["b"]) as s:
            in_b = await s.scalar(select(func.count()).select_from(Job).where(Job.id == job_id))
        async with tenant_session(None) as s:
            no_tenant = await s.scalar(select(func.count()).select_from(Job).where(Job.id == job_id))
        async with tenant_session(None, platform_access=True) as s:
            platform = await s.scalar(select(func.count()).select_from(Job).where(Job.id == job_id))
        return in_b, no_tenant, platform

    assert db_client.portal.call(counts) == (0, 0, 1)


def test_rls_blocks_writes_into_another_tenant(db_client: TestClient, world: dict[str, uuid.UUID]) -> None:
    async def write_into_a_from_b() -> None:
        async with tenant_session(world["b"]) as s:
            s.add(Job(tenant_id=world["a"], kind="system.echo", status=JobStatus.QUEUED))

    with pytest.raises(DBAPIError, match="row-level security"):
        db_client.portal.call(write_into_a_from_b)


def test_audit_events_are_tenant_scoped(db_client: TestClient, world: dict[str, uuid.UUID]) -> None:
    marker = uuid.uuid4().hex

    async def write_and_read() -> tuple[int, int]:
        principal = await load_principal(world["ua"], world["a"])
        async with tenant_session(world["a"]) as s:
            await record_audit(
                s,
                principal=principal,
                action="test.changed",
                entity_type="test",
                entity_id=marker,
                before={"v": 1},
                after={"v": 2},
            )
        async with tenant_session(world["a"]) as s:
            own = await s.scalar(select(func.count()).select_from(AuditEvent).where(AuditEvent.entity_id == marker))
        async with tenant_session(world["b"]) as s:
            other = await s.scalar(select(func.count()).select_from(AuditEvent).where(AuditEvent.entity_id == marker))
        return own, other

    assert db_client.portal.call(write_and_read) == (1, 0)


def test_suspended_workspace_is_blocked(db_client: TestClient, world: dict[str, uuid.UUID]) -> None:
    res = db_client.get(f"/api/v1/jobs/{uuid.uuid4()}", headers=_auth(world["uc"], world["c"]))
    assert res.status_code == 403
    assert res.json()["detail"] == "This workspace is suspended."


def test_permission_is_required(db_client: TestClient, world: dict[str, uuid.UUID]) -> None:
    # A platform admin without a workspace has no tenant permissions.
    res = db_client.get(f"/api/v1/jobs/{uuid.uuid4()}", headers=_auth(world["sa"], None))
    assert res.status_code == 403
    assert res.json()["permission"] == Perm.JOBS_READ


def test_unknown_user_is_unauthorised(db_client: TestClient, world: dict[str, uuid.UUID]) -> None:
    res = db_client.get(f"/api/v1/jobs/{uuid.uuid4()}", headers=_auth(uuid.uuid4(), world["a"]))
    assert res.status_code == 401


def test_readiness_checks_database(db_client: TestClient) -> None:
    assert db_client.get("/health/ready").json() == {"status": "ready", "database": "ok"}


def test_validation_errors_use_problem_details(db_client: TestClient, world: dict[str, uuid.UUID]) -> None:
    res = db_client.get("/api/v1/jobs/not-a-uuid", headers=_auth(world["ua"], world["a"]))
    assert res.status_code == 422
    body = res.json()
    assert body["title"] == "Validation failed"
    assert body["errors"][0]["loc"] == ["path", "job_id"]


def test_me_returns_session_from_token(db_client: TestClient, world: dict[str, uuid.UUID]) -> None:
    res = db_client.get("/api/v1/auth/me", headers=_auth(world["ua"], world["a"]))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["active_tenant"]["id"] == str(world["a"])
    assert Perm.JOBS_READ in body["permissions"]
    assert [m["tenant"]["id"] for m in body["memberships"]] == [str(world["a"])]
    assert not body["user"]["is_platform_admin"]


def test_me_for_platform_admin_without_workspace(db_client: TestClient, world: dict[str, uuid.UUID]) -> None:
    body = db_client.get("/api/v1/auth/me", headers=_auth(world["sa"], None)).json()
    assert body["active_tenant"] is None
    assert set(body["permissions"]) == PLATFORM_ADMIN_PERMISSIONS
