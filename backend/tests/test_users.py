"""Screen 9: users and access (needs PostgreSQL; see conftest)."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.auth import create_platform_token
from app.core.tenancy import tenant_session
from app.platform import repository as repo
from app.platform.models import TenantRole, TenantStatus
from app.platform.passwords import hash_password

PASSWORD = "start-here-123"


def _auth(user_id: uuid.UUID, tenant_id: uuid.UUID | None = None) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_platform_token(user_id, tenant_id)}"}


@pytest.fixture(scope="module")
def org(db_client: TestClient) -> dict[str, object]:
    async def build() -> dict[str, object]:
        s = uuid.uuid4().hex[:6]
        async with tenant_session(None, platform_access=True) as db:
            a = await repo.upsert_tenant(db, slug=f"us-a-{s}", name="Alpha", status=TenantStatus.ACTIVE)
            b = await repo.upsert_tenant(db, slug=f"us-b-{s}", name="Beta", status=TenantStatus.ACTIVE)
            pa = await repo.upsert_user(db, email=f"us-pa-{s}@x.test", full_name="Platform", is_platform_admin=True)
            admin_a = await repo.upsert_user(db, email=f"us-oa-{s}@x.test", full_name="Org Admin A")
            await repo.ensure_membership(db, tenant_id=a.id, user_id=admin_a.id, role=TenantRole.ORG_ADMIN)
            shared = await repo.upsert_user(
                db, email=f"us-shared-{s}@x.test", full_name="In A and B", password_hash=hash_password(PASSWORD)
            )
            await repo.ensure_membership(db, tenant_id=a.id, user_id=shared.id, role=TenantRole.VIEWER)
            await repo.ensure_membership(db, tenant_id=b.id, user_id=shared.id, role=TenantRole.VIEWER)
            return {"s": s, "a": a.id, "b": b.id, "pa": pa.id, "oa": admin_a.id, "shared": shared.id}

    return db_client.portal.call(build)


def test_platform_admin_adds_a_consultant_who_sees_only_assigned_workspaces(
    db_client: TestClient, org: dict[str, object]
) -> None:
    h = _auth(org["pa"])
    email = f"consultant-{org['s']}@monkspaces.test"
    res = db_client.post(
        "/api/v1/admin/users",
        json={
            "email": email,
            "full_name": "Cara Consultant",
            "memberships": [{"tenant_id": str(org["a"]), "role": "consultant"}],
            "password": PASSWORD,
        },
        headers=h,
    )
    assert res.status_code == 201, res.text
    user = res.json()
    assert user["status"] == "active" and user["memberships"][0]["role"] == "consultant"

    signed = db_client.post("/api/v1/auth/sign-in", json={"email": email, "password": PASSWORD})
    assert signed.status_code == 200
    token = {"Authorization": f"Bearer {signed.json()['access_token']}"}
    me = db_client.get("/api/v1/auth/me", headers=token).json()
    assert [m["tenant"]["id"] for m in me["memberships"]] == [str(org["a"])]
    assert "products.read" in me["permissions"] and "users.manage" not in me["permissions"]
    assert (
        db_client.post("/api/v1/auth/switch-tenant", json={"tenant_id": str(org["b"])}, headers=token).status_code
        == 403
    )


def test_rules_for_creating_users(db_client: TestClient, org: dict[str, object]) -> None:
    h = _auth(org["pa"])
    base = {"full_name": "X", "memberships": [{"tenant_id": str(org["a"]), "role": "viewer"}]}
    assert db_client.post("/api/v1/admin/users", json={**base, "email": "nope"}, headers=h).status_code == 422
    short = {**base, "email": f"short-{org['s']}@x.test", "password": "short"}
    assert db_client.post("/api/v1/admin/users", json=short, headers=h).status_code == 422
    nowhere = {"email": f"nowhere-{org['s']}@x.test", "full_name": "X", "memberships": []}
    assert db_client.post("/api/v1/admin/users", json=nowhere, headers=h).status_code == 422
    invited = db_client.post("/api/v1/admin/users", json={**base, "email": f"inv-{org['s']}@x.test"}, headers=h)
    assert invited.json()["status"] == "invited"
    taken = db_client.post("/api/v1/admin/users", json={**base, "email": f"us-oa-{org['s']}@x.test"}, headers=h)
    assert taken.status_code == 422


def test_disable_ends_access_and_memberships_can_change(db_client: TestClient, org: dict[str, object]) -> None:
    h = _auth(org["pa"])
    shared = str(org["shared"])
    signed = db_client.post(
        "/api/v1/auth/sign-in", json={"email": f"us-shared-{org['s']}@x.test", "password": PASSWORD}
    )
    token = {"Authorization": f"Bearer {signed.json()['access_token']}"}
    assert db_client.patch(f"/api/v1/admin/users/{shared}", json={"status": "disabled"}, headers=h).status_code == 200
    assert db_client.get("/api/v1/auth/me", headers=token).status_code == 401
    assert db_client.post("/api/v1/auth/refresh").status_code == 401

    db_client.patch(f"/api/v1/admin/users/{shared}", json={"status": "active"}, headers=h)
    moved = db_client.put(
        f"/api/v1/admin/users/{shared}/memberships",
        json=[{"tenant_id": str(org["b"]), "role": "analyst"}],
        headers=h,
    ).json()
    assert [(m["tenant_id"], m["role"]) for m in moved["memberships"]] == [(str(org["b"]), "analyst")]
    me_disable = db_client.patch(f"/api/v1/admin/users/{org['pa']}", json={"status": "disabled"}, headers=h)
    assert me_disable.status_code == 409


def test_org_admin_manages_only_their_team(db_client: TestClient, org: dict[str, object]) -> None:
    oa = _auth(org["oa"], org["a"])
    team = db_client.get("/api/v1/team", headers=oa).json()
    assert {m["full_name"] for m in team} >= {"Org Admin A", "Cara Consultant"}

    new = db_client.post(
        "/api/v1/team",
        json={"email": f"member-{org['s']}@x.test", "full_name": "New Member", "role": "viewer", "password": PASSWORD},
        headers=oa,
    )
    assert new.status_code == 201, new.text
    member = new.json()["id"]
    assert db_client.patch(f"/api/v1/team/{member}", json={"role": "analyst"}, headers=oa).json()["role"] == "analyst"
    assert (
        db_client.post(f"/api/v1/team/{member}/password", json={"password": PASSWORD + "x"}, headers=oa).status_code
        == 204
    )

    consultant = next(m for m in team if m["role"] == "consultant")["id"]
    assert db_client.delete(f"/api/v1/team/{consultant}", headers=oa).status_code == 409
    assert db_client.patch(f"/api/v1/team/{org['oa']}", json={"role": "viewer"}, headers=oa).status_code == 409
    assert db_client.delete(f"/api/v1/team/{member}", headers=oa).status_code == 204
    assert db_client.get("/api/v1/admin/users", headers=oa).status_code == 403

    viewer_token = _auth(org["shared"], org["b"])
    assert db_client.get("/api/v1/team", headers=viewer_token).status_code == 403
