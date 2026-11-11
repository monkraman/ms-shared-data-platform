"""Screen 2: client workspaces (needs PostgreSQL; see conftest)."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.audit import AuditEvent
from app.core.auth import create_platform_token
from app.core.tenancy import tenant_session
from app.platform import repository as repo
from app.platform.models import LegalEntity, Membership, TenantRole, TenantStatus, User, UserStatus

URL = "/api/v1/admin/tenants"


def _auth(user_id: uuid.UUID, tenant_id: uuid.UUID | None = None) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_platform_token(user_id, tenant_id)}"}


@pytest.fixture(scope="module")
def people(db_client: TestClient) -> dict[str, object]:
    """A platform admin, and an org admin of an existing workspace."""

    async def build() -> dict[str, object]:
        s = uuid.uuid4().hex[:6]
        async with tenant_session(None, platform_access=True) as db:
            admin = await repo.upsert_user(db, email=f"pa-{s}@x.test", full_name="Platform", is_platform_admin=True)
            home = await repo.upsert_tenant(db, slug=f"home-{s}", name="Home Foods", status=TenantStatus.ACTIVE)
            org = await repo.upsert_user(db, email=f"oa-{s}@x.test", full_name="Org Admin")
            await repo.ensure_membership(db, tenant_id=home.id, user_id=org.id, role=TenantRole.ORG_ADMIN)
            return {"s": s, "admin": admin.id, "org": org.id, "home": home.id}

    return db_client.portal.call(build)


def body(slug: str, **over: object) -> dict[str, object]:
    return {
        "name": "Acme Foods",
        "slug": slug,
        "sector": "Food",
        "brand_color": "#c0211f",
        "logo_url": "https://example.test/logo.png",
        "legal_entities": [{"name": "Acme Foods A/S", "country": "DK", "registration_number": "DK-1"}],
        "countries": ["DK", "UK"],
        "modules": ["EPR", "PPWR"],
        "admin": {"full_name": "Ana Lima", "email": f"Ana.{slug.replace(' ', '-')}@Acme.test"},
        **over,
    }


def errors(res) -> dict[str, str]:
    return {e["loc"][-1]: e["msg"] for e in res.json().get("errors", [])}


def test_platform_admin_creates_a_workspace(db_client: TestClient, people: dict[str, object]) -> None:
    slug = f"acme-{people['s']}"
    res = db_client.post(URL, json=body(slug), headers=_auth(people["admin"]))
    assert res.status_code == 201, res.text
    ws = res.json()
    assert ws["slug"] == slug
    assert ws["status"] == "active"
    assert ws["countries"] == ["DK", "UK"]
    assert ws["modules"] == ["EPR", "PPWR"]
    assert ws["logo_url"] == "https://example.test/logo.png"
    assert ws["legal_entities"][0]["name"] == "Acme Foods A/S"
    assert ws["user_count"] == 1
    assert ws["last_activity_at"] is not None  # the creation itself

    async def check() -> tuple[str, str, str]:
        async with tenant_session(None, platform_access=True) as db:
            user = await db.scalar(select(User).where(User.email == f"ana.{slug}@acme.test"))
            m = await db.scalar(select(Membership).where(Membership.user_id == user.id))
            event = await db.scalar(select(AuditEvent).where(AuditEvent.entity_id == ws["id"]))
            return user.status, m.role, event.action

    status, role, action = db_client.portal.call(check)
    assert status == UserStatus.INVITED
    assert role == TenantRole.ORG_ADMIN
    assert action == "workspace.created"


def test_rules_are_enforced(db_client: TestClient, people: dict[str, object]) -> None:
    h = _auth(people["admin"])
    s = people["s"]
    assert errors(db_client.post(URL, json=body("Bad Slug"), headers=h)) == {
        "slug": "Use 3–40 lowercase letters, numbers or hyphens"
    }
    assert "slug" in errors(db_client.post(URL, json=body(f"home-{s}"), headers=h))
    assert "legal_entities" in errors(db_client.post(URL, json=body(f"r1-{s}", legal_entities=[]), headers=h))
    assert "countries" in errors(db_client.post(URL, json=body(f"r2-{s}", countries=["XX"]), headers=h))
    assert "modules" in errors(db_client.post(URL, json=body(f"r3-{s}", modules=[]), headers=h))
    uk_ppwr = db_client.post(URL, json=body(f"r4-{s}", countries=["UK"], modules=["PPWR"]), headers=h)
    assert errors(uk_ppwr) == {"modules": "PPWR and DPP need an EU country"}
    assert db_client.post(URL, json=body(f"r5-{s}", brand_color="red"), headers=h).status_code == 422
    assert db_client.post(URL, json=body(f"r6-{s}", logo_url="http://x.test/a.png"), headers=h).status_code == 422
    bad_email = body(f"r7-{s}", admin={"full_name": "A", "email": "nope"})
    assert errors(db_client.post(URL, json=bad_email, headers=h)) == {"email": "Enter a valid email"}


def test_list_filters_and_detail(db_client: TestClient, people: dict[str, object]) -> None:
    h = _auth(people["admin"])
    s = people["s"]
    db_client.post(URL, json=body(f"filter-{s}", name="Filter Drinks"), headers=h)

    found = db_client.get(URL, params={"q": "filter drinks"}, headers=h).json()
    assert [w["slug"] for w in found] == [f"filter-{s}"]
    assert all(w["status"] == "active" for w in db_client.get(URL, params={"status": "active"}, headers=h).json())

    detail = db_client.get(f"{URL}/{found[0]['id']}", headers=h)
    assert detail.status_code == 200
    assert detail.json()["name"] == "Filter Drinks"
    assert db_client.get(f"{URL}/{uuid.uuid4()}", headers=h).status_code == 404


def test_edit_branding_scope_and_entities(db_client: TestClient, people: dict[str, object]) -> None:
    h = _auth(people["admin"])
    ws = db_client.post(URL, json=body(f"edit-{people['s']}"), headers=h).json()

    res = db_client.patch(
        f"{URL}/{ws['id']}",
        json={
            "name": "Acme Group",
            "brand_color": "#112233",
            "logo_url": None,
            "countries": ["DE"],
            "modules": ["EPR", "DPP"],
            "legal_entities": [{"name": "Acme GmbH", "country": "DE", "registration_number": "HRB 1"}],
        },
        headers=h,
    )
    assert res.status_code == 200, res.text
    out = res.json()
    assert (out["name"], out["brand_color"], out["logo_url"]) == ("Acme Group", "#112233", None)
    assert [e["name"] for e in out["legal_entities"]] == ["Acme GmbH"]

    # Removing the only EU country while PPWR/DPP are on is refused.
    refused = db_client.patch(f"{URL}/{ws['id']}", json={"countries": ["UK"]}, headers=h)
    assert errors(refused) == {"modules": "PPWR and DPP need an EU country"}


def test_suspending_blocks_the_workspace_users(db_client: TestClient, people: dict[str, object]) -> None:
    admin, org_user = _auth(people["admin"]), _auth(people["org"], people["home"])
    assert db_client.get("/api/v1/auth/me", headers=org_user).status_code == 200

    res = db_client.patch(f"{URL}/{people['home']}", json={"status": "suspended"}, headers=admin)
    assert res.status_code == 200
    assert db_client.get("/api/v1/auth/me", headers=org_user).status_code == 403

    db_client.patch(f"{URL}/{people['home']}", json={"status": "active"}, headers=admin)
    me = db_client.get("/api/v1/auth/me", headers=org_user)
    assert me.status_code == 200
    assert {"brand_color", "logo_url"} <= me.json()["active_tenant"].keys()

    async def actions() -> list[str]:
        async with tenant_session(None, platform_access=True) as db:
            rows = await db.scalars(
                select(AuditEvent.action)
                .where(AuditEvent.entity_id == str(people["home"]))
                .order_by(AuditEvent.created_at)
            )
            return list(rows)

    assert db_client.portal.call(actions)[-2:] == ["workspace.suspended", "workspace.reactivated"]


def test_org_admins_cannot_use_workspace_admin(db_client: TestClient, people: dict[str, object]) -> None:
    org_user = _auth(people["org"], people["home"])
    assert db_client.get(URL, headers=org_user).status_code == 403
    assert db_client.get(f"{URL}/{people['home']}", headers=org_user).status_code == 403
    assert db_client.patch(f"{URL}/{people['home']}", json={"name": "Mine"}, headers=org_user).status_code == 403
    assert db_client.post(URL, json=body(f"oa-{people['s']}"), headers=org_user).status_code == 403
    assert db_client.get(URL).status_code == 401


def test_legal_entities_are_isolated_by_tenant(db_client: TestClient, people: dict[str, object]) -> None:
    """RLS: inside workspace A, workspace B's legal entities are invisible."""
    h = _auth(people["admin"])
    a = db_client.post(URL, json=body(f"iso-a-{people['s']}"), headers=h).json()
    b = db_client.post(URL, json=body(f"iso-b-{people['s']}"), headers=h).json()

    async def visible_from(tenant_id: str) -> set[str]:
        async with tenant_session(uuid.UUID(tenant_id)) as db:
            return {str(t) for t in await db.scalars(select(LegalEntity.tenant_id))}

    assert db_client.portal.call(visible_from, a["id"]) == {a["id"]}
    assert db_client.portal.call(visible_from, b["id"]) == {b["id"]}


def test_reference_lists(db_client: TestClient, people: dict[str, object]) -> None:
    h = _auth(people["org"], people["home"])
    countries = db_client.get("/api/v1/reference/countries", headers=h).json()
    assert {"code": "UK", "name": "United Kingdom", "eu": False} in countries
    modules = db_client.get("/api/v1/reference/modules", headers=h).json()
    assert [m["id"] for m in modules] == ["EPR", "PPWR", "DPP", "LCA"]
    assert db_client.get("/api/v1/reference/countries").status_code == 401
