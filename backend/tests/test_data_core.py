"""Screens 3–8: data points, products, import and sync, gap rules, gaps, data overview (needs PostgreSQL)."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.auth import create_platform_token
from app.core.jobs import wait_for_inline_jobs
from app.core.tenancy import tenant_session
from app.platform import repository as repo
from app.platform.models import TenantRole, TenantStatus


def _auth(user_id: uuid.UUID, tenant_id: uuid.UUID | None = None) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_platform_token(user_id, tenant_id)}"}


@pytest.fixture(scope="module")
def ws(db_client: TestClient) -> dict[str, object]:
    """Two workspaces, an org admin and a viewer in A, an org admin in B, a platform admin."""

    async def build() -> dict[str, object]:
        s = uuid.uuid4().hex[:6]
        async with tenant_session(None, platform_access=True) as db:
            a = await repo.upsert_tenant(db, slug=f"dc-a-{s}", name="A", status=TenantStatus.ACTIVE)
            b = await repo.upsert_tenant(db, slug=f"dc-b-{s}", name="B", status=TenantStatus.ACTIVE)
            oa = await repo.upsert_user(db, email=f"dc-oa-{s}@x.test", full_name="Org A")
            viewer = await repo.upsert_user(db, email=f"dc-v-{s}@x.test", full_name="Viewer A")
            ob = await repo.upsert_user(db, email=f"dc-ob-{s}@x.test", full_name="Org B")
            pa = await repo.upsert_user(db, email=f"dc-pa-{s}@x.test", full_name="Platform", is_platform_admin=True)
            await repo.ensure_membership(db, tenant_id=a.id, user_id=oa.id, role=TenantRole.ORG_ADMIN)
            await repo.ensure_membership(db, tenant_id=a.id, user_id=viewer.id, role=TenantRole.VIEWER)
            await repo.ensure_membership(db, tenant_id=b.id, user_id=ob.id, role=TenantRole.ORG_ADMIN)
            return {"a": a.id, "b": b.id, "oa": oa.id, "viewer": viewer.id, "ob": ob.id, "pa": pa.id}

    return db_client.portal.call(build)


def _approve(client: TestClient, headers: dict[str, str], draft: dict[str, object]) -> dict[str, object]:
    preview = client.put(
        f"/api/v1/imports/{draft['id']}/mapping", json={"mapping": draft["suggested_mapping"]}, headers=headers
    )
    assert preview.status_code == 200, preview.text
    started = client.post(f"/api/v1/imports/{draft['id']}/approve", headers=headers)
    assert started.status_code == 202, started.text
    client.portal.call(wait_for_inline_jobs)
    job = client.get(f"/api/v1/jobs/{started.json()['job_id']}", headers=headers).json()
    assert job["status"] == "succeeded", job
    return job


def test_data_point_dictionary(db_client: TestClient, ws: dict[str, object]) -> None:
    res = db_client.get("/api/v1/admin/data-points", headers=_auth(ws["pa"]))
    assert res.status_code == 200
    body = res.json()
    assert body["data_points"][0]["code"] == "DP01"
    assert {"erp", "plm", "supplier", "man"} <= body["sources"].keys()
    assert db_client.get("/api/v1/admin/data-points", headers=_auth(ws["oa"], ws["a"])).status_code == 403


def test_csv_import_creates_products(db_client: TestClient, ws: dict[str, object]) -> None:
    h = _auth(ws["oa"], ws["a"])
    draft = db_client.post(
        "/api/v1/imports",
        json={
            "filename": "skus.csv",
            "columns": ["Article", "Description", "Component", "Level", "Material", "Weight (g)"],
            "rows": [
                ["CSV-1", "Ketchup 460g", "Bottle", "Primary", "Plastic", "26"],
                ["CSV-1", "Ketchup 460g", "Cap", "Primary", "Plastic", ""],
                ["", "No SKU", "Tray", "Transit", "Paper", "100"],
            ],
        },
        headers=h,
    )
    assert draft.status_code == 201, draft.text
    assert draft.json()["suggested_mapping"]["Article"] == "sku"
    job = _approve(db_client, h, draft.json())
    assert job["result"]["imported_products"] == 1

    product = db_client.get("/api/v1/products/CSV-1", headers=h).json()
    assert [c["name"] for c in product["components"]] == ["Bottle", "Cap"]
    assert product["components"][1]["weight_g"] is None
    # The missing cap weight is a gap, not a rejected row.
    gaps = db_client.get("/api/v1/gaps", headers=h).json()
    assert any(g["id"] == "GR-008:CSV-1-02" for g in gaps)


def test_erp_then_plm_sync_merge_into_the_same_products(db_client: TestClient, ws: dict[str, object]) -> None:
    h = _auth(ws["oa"], ws["a"])
    erp = db_client.post("/api/v1/imports/sync", json={"system": "erp"}, headers=h).json()
    assert erp["source"] == "erp"
    _approve(db_client, h, erp)
    plm = db_client.post("/api/v1/imports/sync", json={"system": "plm"}, headers=h).json()
    _approve(db_client, h, plm)

    products = db_client.get("/api/v1/products", headers=h).json()
    skus = {p["sku"] for p in products}
    assert "HLA-KET-460" in skus
    ketchup = db_client.get("/api/v1/products/HLA-KET-460", headers=h).json()
    assert ketchup["sales"], "ERP brings sales lines"
    codes = [c["id"] for c in ketchup["components"]]
    assert len(codes) == len(set(codes)), "PLM rows update ERP's components instead of adding copies"

    overview = db_client.get("/api/v1/data-overview", headers=h).json()
    assert overview["products"] == len(products)
    assert 0 < overview["readiness_pct"] < 100


def test_resolve_a_gap_by_setting_the_value(db_client: TestClient, ws: dict[str, object]) -> None:
    h = _auth(ws["oa"], ws["a"])
    res = db_client.post("/api/v1/gaps/GR-008:CSV-1-02/resolve", json={"action": "set_value", "value": "4"}, headers=h)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "resolved"
    cap = db_client.get("/api/v1/products/CSV-1", headers=h).json()["components"][1]
    assert cap["weight_g"] == 4
    assert all(g["id"] != "GR-008:CSV-1-02" for g in db_client.get("/api/v1/gaps", headers=h).json())


def test_viewers_read_but_do_not_change(db_client: TestClient, ws: dict[str, object]) -> None:
    h = _auth(ws["viewer"], ws["a"])
    assert db_client.get("/api/v1/products", headers=h).status_code == 200
    assert db_client.post("/api/v1/imports/sync", json={"system": "erp"}, headers=h).status_code == 403
    assert (
        db_client.post("/api/v1/gaps/GR-009:CSV-1/resolve", json={"action": "accept_estimate"}, headers=h).status_code
        == 403
    )


def test_workspaces_cannot_see_each_others_data(db_client: TestClient, ws: dict[str, object]) -> None:
    a, b = _auth(ws["oa"], ws["a"]), _auth(ws["ob"], ws["b"])
    assert db_client.get("/api/v1/products", headers=b).json() == []
    assert db_client.get("/api/v1/products/CSV-1", headers=b).status_code == 404
    assert db_client.get("/api/v1/gaps", headers=b).json() == []
    assert db_client.get("/api/v1/data-overview", headers=b).json()["products"] == 0

    draft = db_client.post("/api/v1/imports/sync", json={"system": "plm"}, headers=a).json()
    assert db_client.put(f"/api/v1/imports/{draft['id']}/mapping", json={"mapping": {}}, headers=b).status_code == 404
    assert db_client.post(f"/api/v1/imports/{draft['id']}/approve", headers=b).status_code == 404


def test_platform_admin_needs_a_workspace_for_client_data(db_client: TestClient, ws: dict[str, object]) -> None:
    assert db_client.get("/api/v1/products", headers=_auth(ws["pa"])).status_code == 403
    inside = _auth(ws["pa"], ws["a"])
    assert db_client.get("/api/v1/products", headers=inside).status_code == 200


def test_gap_rules_are_managed_by_platform_admins(db_client: TestClient, ws: dict[str, object]) -> None:
    pa, oa = _auth(ws["pa"]), _auth(ws["oa"], ws["a"])
    rules = db_client.get("/api/v1/admin/gap-rules", headers=pa).json()
    assert [r["id"] for r in rules][:2] == ["GR-001", "GR-002"]
    assert db_client.get("/api/v1/admin/gap-rules", headers=oa).status_code == 403

    created = db_client.post(
        "/api/v1/admin/gap-rules",
        json={
            "name": "Polymer missing",
            "data_point": "DP07",
            "field": "polymer",
            "check": {"kind": "missing"},
            "severity": "warning",
            "modules": ["PPWR"],
        },
        headers=pa,
    )
    assert created.status_code == 201, created.text
    rule_id = created.json()["id"]
    off = db_client.patch(f"/api/v1/admin/gap-rules/{rule_id}", json={"active": False}, headers=pa)
    assert off.json()["active"] is False
    assert (
        db_client.post("/api/v1/admin/gap-rules", json={**created.json(), "field": "nope"}, headers=pa).status_code
        == 422
    )
