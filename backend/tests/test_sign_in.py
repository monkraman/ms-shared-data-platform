"""Screen 1: sign-in and session (needs PostgreSQL; see conftest)."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.tenancy import tenant_session
from app.platform import repository as repo
from app.platform.models import TenantRole, TenantStatus, User
from app.platform.passwords import hash_password

PASSWORD = "correct-horse-1"


@pytest.fixture()
def api(db_client: TestClient) -> TestClient:
    db_client.cookies.clear()
    return db_client


@pytest.fixture(scope="module")
def people(db_client: TestClient) -> dict[str, str]:
    """A user in two workspaces, and the slugs and IDs needed by the tests."""

    async def build() -> dict[str, str]:
        s = uuid.uuid4().hex[:6]
        async with tenant_session(None, platform_access=True) as db:
            one = await repo.upsert_tenant(db, slug=f"one-{s}", name="One", status=TenantStatus.ACTIVE)
            two = await repo.upsert_tenant(db, slug=f"two-{s}", name="Two", status=TenantStatus.ACTIVE)
            other = await repo.upsert_tenant(db, slug=f"other-{s}", name="Other", status=TenantStatus.ACTIVE)
            user = await repo.upsert_user(
                db, email=f"multi-{s}@x.test", full_name="Multi User", password_hash=hash_password(PASSWORD)
            )
            await repo.ensure_membership(db, tenant_id=one.id, user_id=user.id, role=TenantRole.ORG_ADMIN)
            await repo.ensure_membership(db, tenant_id=two.id, user_id=user.id, role=TenantRole.VIEWER)
            locked = await repo.upsert_user(
                db, email=f"lock-{s}@x.test", full_name="Lock Me", password_hash=hash_password(PASSWORD)
            )
            await repo.ensure_membership(db, tenant_id=one.id, user_id=locked.id, role=TenantRole.VIEWER)
            return {
                "email": user.email,
                "locked": locked.email,
                "one": str(one.id),
                "two": str(two.id),
                "other": str(other.id),
                "one_slug": one.slug,
            }

    return db_client.portal.call(build)


def sign_in(api: TestClient, email: str, password: str):
    return api.post("/api/v1/auth/sign-in", json={"email": email, "password": password})


def bearer(res) -> dict[str, str]:
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_prototype_user_moves_to_database_on_first_sign_in(api: TestClient) -> None:
    res = sign_in(api, "Compliance.Officer@kraftheinz.com", "password123")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["user"]["role"] == "org_admin"
    assert body["user"]["organisation_slug"] == "khc-europe"
    assert body["redirect_url"] == "/dashboard"
    assert body["expires_in_seconds"] == 15 * 60
    assert "ch_refresh" in res.cookies

    async def stored_hash() -> str:
        async with tenant_session(None) as db:
            user = await db.scalar(select(User).where(User.email == "compliance.officer@kraftheinz.com"))
            return user.password_hash

    assert db_client_hash_is_argon2(api.portal.call(stored_hash))

    me = api.get("/api/v1/auth/me", headers=bearer(res)).json()
    assert me["active_tenant"]["slug"] == "khc-europe"

    # From now on the database decides.
    assert sign_in(api, "compliance.officer@kraftheinz.com", "wrong-password").status_code == 401


def db_client_hash_is_argon2(value: str) -> bool:
    return value.startswith("$argon2")


def test_superadmin_lands_in_admin_console(api: TestClient) -> None:
    res = sign_in(api, "superadmin@monkspaces.com", "password123")
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "superadmin"
    assert res.json()["redirect_url"] == "/admin"


def test_wrong_password_and_unknown_email_look_the_same(api: TestClient, people: dict[str, str]) -> None:
    wrong = sign_in(api, people["email"], "nope-nope-nope")
    unknown = sign_in(api, "nobody@x.test", "nope-nope-nope")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["detail"] == unknown.json()["detail"] == "Incorrect email or password."


def test_five_failures_lock_the_account(api: TestClient, people: dict[str, str]) -> None:
    for _ in range(5):
        assert sign_in(api, people["locked"], "bad-password").status_code == 401
    res = sign_in(api, people["locked"], PASSWORD)
    assert res.status_code == 429


def test_refresh_rotates_and_sign_out_revokes(api: TestClient, people: dict[str, str]) -> None:
    sign_in(api, people["email"], PASSWORD)
    first = api.cookies.get("ch_refresh")

    refreshed = api.post("/api/v1/auth/refresh")
    assert refreshed.status_code == 200
    assert api.get("/api/v1/auth/me", headers=bearer(refreshed)).status_code == 200

    # The old refresh token is spent.
    api.cookies.clear()
    assert api.post("/api/v1/auth/refresh", cookies={"ch_refresh": first}).status_code == 401

    sign_in(api, people["email"], PASSWORD)
    assert api.post("/api/v1/auth/sign-out").status_code == 204
    assert api.post("/api/v1/auth/refresh").status_code == 401


def test_switch_between_own_workspaces_only(api: TestClient, people: dict[str, str]) -> None:
    res = sign_in(api, people["email"], PASSWORD)
    me = api.get("/api/v1/auth/me", headers=bearer(res)).json()
    assert me["active_tenant"]["id"] == people["one"]
    assert {m["tenant"]["id"] for m in me["memberships"]} == {people["one"], people["two"]}

    switched = api.post("/api/v1/auth/switch-tenant", json={"tenant_id": people["two"]}, headers=bearer(res))
    assert switched.status_code == 200
    me = api.get("/api/v1/auth/me", headers=bearer(switched)).json()
    assert me["active_tenant"]["id"] == people["two"]
    assert "users.manage" not in me["permissions"]  # viewer there

    denied = api.post("/api/v1/auth/switch-tenant", json={"tenant_id": people["other"]}, headers=bearer(res))
    assert denied.status_code == 403


def test_client_data_needs_a_session_and_ignores_tenant_headers(api: TestClient, people: dict[str, str]) -> None:
    assert api.get("/api/v1/products").status_code == 401

    res = sign_in(api, people["email"], PASSWORD)
    # The workspace comes from the token only; a header naming another workspace changes nothing.
    other = api.get("/api/v1/products", headers={**bearer(res), "X-Tenant-ID": people["other"]})
    assert other.status_code == 200
    assert other.json() == api.get("/api/v1/products", headers=bearer(res)).json()
