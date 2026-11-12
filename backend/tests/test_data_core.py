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


def errors(res) -> dict[str, str]:
    """Field → message from a 422 problem response."""
    return {e["loc"][-1]: e["msg"] for e in res.json().get("errors", [])}


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


def test_rules_follow_the_workspace_modules_and_countries(db_client: TestClient, ws: dict[str, object]) -> None:
    h, pa = _auth(ws["oa"], ws["a"]), _auth(ws["pa"])
    all_rules = {g["rule_id"] for g in db_client.get("/api/v1/gaps", headers=h).json()}
    assert "GR-001" in all_rules  # a DPP-only rule applies while the workspace has no modules set

    db_client.patch(
        f"/api/v1/admin/tenants/{ws['a']}",
        json={
            "modules": ["EPR"],
            "countries": ["UK"],
            "legal_entities": [{"name": "A Ltd", "country": "UK", "registration_number": "1"}],
        },
        headers=pa,
    )
    epr_only = db_client.get("/api/v1/gaps", headers=h).json()
    assert epr_only and all("EPR" in g["modules"] for g in epr_only)
    assert "GR-001" not in {g["rule_id"] for g in epr_only}


def test_a_data_source_remembers_its_mapping_and_can_auto_approve(db_client: TestClient, ws: dict[str, object]) -> None:
    h = _auth(ws["oa"], ws["a"])
    source = db_client.post("/api/v1/data-sources", json={"system": "plm"}, headers=h).json()
    assert source["system"] == "plm"

    first = db_client.post(f"/api/v1/data-sources/{source['id']}/sync", headers=h).json()
    assert first["job_id"] is None  # nothing saved yet: review first
    mapping = {**first["draft"]["suggested_mapping"], "end_of_life_info": None}
    db_client.put(f"/api/v1/imports/{first['draft']['id']}/mapping", json={"mapping": mapping}, headers=h)
    db_client.post(f"/api/v1/imports/{first['draft']['id']}/approve", headers=h)
    db_client.portal.call(wait_for_inline_jobs)

    saved = db_client.get("/api/v1/data-sources", headers=h).json()
    plm = next(s for s in saved if s["id"] == source["id"])
    assert plm["last_status"] == "succeeded" and plm["syncs"] >= 1

    db_client.patch(f"/api/v1/data-sources/{source['id']}", json={"auto_approve": True}, headers=h)
    second = db_client.post(f"/api/v1/data-sources/{source['id']}/sync", headers=h).json()
    assert second["draft"]["suggested_mapping"]["end_of_life_info"] is None  # the saved "skip" sticks
    assert second["job_id"] is not None
    db_client.portal.call(wait_for_inline_jobs)

    history = db_client.get("/api/v1/imports", headers=h).json()
    assert history[0]["status"] == "imported" and history[0]["source"] == "plm"
    assert db_client.get("/api/v1/data-sources", headers=_auth(ws["ob"], ws["b"])).json() == []


def test_epr_and_ppwr_results_come_from_the_workspace_data(db_client: TestClient, ws: dict[str, object]) -> None:
    h, viewer, b = _auth(ws["oa"], ws["a"]), _auth(ws["viewer"], ws["a"]), _auth(ws["ob"], ws["b"])
    uk = db_client.get("/api/v1/modules/epr/epr_uk", headers=viewer)
    assert uk.status_code == 200, uk.text
    body = uk.json()
    assert body["currency"] == "GBP" and body["rates_status"] == "published"
    assert body["total_fee"] > 0 and body["by_material"] and body["by_product"]
    assert db_client.get("/api/v1/modules/epr/epr_uk", headers=b).json()["total_fee"] == 0

    # Workspace A has only EPR: PPWR is a module it has not switched on.
    assert db_client.get("/api/v1/modules/ppwr/declarations", headers=h).status_code == 403
    regimes = {r["id"]: r for r in db_client.get("/api/v1/modules/regimes", headers=h).json()}
    assert regimes["epr_uk"]["in_scope"] and not regimes["ppwr_dk"]["in_scope"]
    db_client.patch(
        f"/api/v1/admin/tenants/{ws['a']}",
        json={"modules": ["EPR", "PPWR"], "countries": ["UK", "DK"]},
        headers=_auth(ws["pa"]),
    )
    rows = db_client.get("/api/v1/modules/ppwr/declarations", headers=h).json()
    assert any(r["sku"] == "HLA-KET-460" for r in rows)
    doc = db_client.get("/api/v1/modules/ppwr/declarations/HLA-KET-460", params={"lang": "da"}, headers=h).json()
    assert doc["text"]["title"] == "EU-overensstemmelseserklæring"
    assert doc["components"] and {r["key"] for r in doc["requirements"]} >= {"substances", "recyclability"}

    # SKU library: fee per regime the workspace covers, RAM rating, PPWR grade, markets, status.
    # Recyclability is vendor data the simulated syncs do not send: components are not assessed
    # (Red under RAM, no PPWR grade) until it is entered.
    skus = {r["sku"]: r for r in db_client.get("/api/v1/products", headers=viewer).json()}
    sachet = skus["HLA-PORT-10"]
    assert {f["regime"] for f in sachet["fees"]} == {"epr_uk", "epr_dk"}
    assert sachet["markets"] == ["DK", "UK"] and sachet["markets_assumed"] and sachet["ppwr_in_scope"]
    assert sachet["ram"] == "Red" and sachet["grade"] is None and sachet["status"] != "ok"
    detail = db_client.get("/api/v1/products/HLA-BEAN-415", headers=viewer).json()
    assert detail["components"][0]["assessment"]["ram_reason"] == "Not assessed"
    for c in detail["components"]:
        if c["level"] == "Primary":
            res = db_client.patch(
                f"/api/v1/products/HLA-BEAN-415/components/{c['id']}",
                json={"values": {"recyclability_result": "Good"}},
                headers=h,
            )
            assert res.status_code == 200, res.text
    detail = res.json()
    assert detail["grade"] == "A" and detail["ram"] in ("Green", "Red")  # secondary film still unassessed
    assert detail["components"][0]["assessment"]["ram"] == "Green"

    # Home uses the same engines: the fees match the regime results and the hotspots carry the fee.
    summary = db_client.get("/api/v1/home", headers=viewer)
    assert summary.status_code == 200, summary.text
    home = summary.json()
    fees = {f["regime"]: f for f in home["fees"]}
    uk_now = db_client.get("/api/v1/modules/epr/epr_uk", headers=viewer).json()
    assert fees["epr_uk"]["total_fee"] == uk_now["total_fee"]
    assert home["skus"] == len(skus) and home["hotspots"] and home["ppwr"]["declarations_total"] == len(skus)
    assert sum(home["data_health"][k] for k in ("verified", "estimated", "flagged")) == home["data_health"]["values"]
    assert db_client.get("/api/v1/modules/ppwr/declarations/HLA-KET-460", headers=b).status_code == 404

    assert db_client.get("/api/v1/modules/regimes", headers=h).json()
    # Back to EPR + UK for the tests that follow.
    db_client.patch(
        f"/api/v1/admin/tenants/{ws['a']}", json={"modules": ["EPR"], "countries": ["UK"]}, headers=_auth(ws["pa"])
    )


def test_fill_estimates_writes_marked_values(db_client: TestClient, ws: dict[str, object]) -> None:
    h = _auth(ws["oa"], ws["a"])
    open_gaps = [g for g in db_client.get("/api/v1/gaps", headers=h).json() if g["status"] == "open"]
    estimable = [g for g in open_gaps if g["estimable"]]
    assert estimable, "missing weights and recycled content can be estimated"
    assert all(g["estimate"]["basis"] for g in estimable)
    assert any(not g["estimable"] for g in open_gaps), "certificates and identifiers need real data"

    weight_gap = next((g for g in estimable if g["field"] == "weight_g"), None)
    res = db_client.post("/api/v1/gaps/estimate", json={}, headers=h)
    assert res.status_code == 200, res.text
    assert res.json()["filled"] == len(estimable)
    assert not [g for g in db_client.get("/api/v1/gaps", headers=h).json() if g["estimable"] and g["status"] == "open"]

    if weight_gap:
        product = db_client.get(f"/api/v1/products/{weight_gap['sku']}", headers=h).json()
        component = next(c for c in product["components"] if c["id"] == weight_gap["component_id"])
        assert component["weight_source"] == "Estimate"
        assert str(component["weight_g"]).rstrip("0").rstrip(".") == weight_gap["estimate"]["value"].rstrip("0").rstrip(
            "."
        )
    viewer = _auth(ws["viewer"], ws["a"])
    assert db_client.post("/api/v1/gaps/estimate", json={}, headers=viewer).status_code == 403


def test_insights_scenarios_and_action_items(db_client: TestClient, ws: dict[str, object]) -> None:
    h, viewer, b = _auth(ws["oa"], ws["a"]), _auth(ws["viewer"], ws["a"]), _auth(ws["ob"], ws["b"])
    res = db_client.get("/api/v1/modules/epr/epr_uk/insights", headers=viewer)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["hotspots"]["components"] and body["hotspots"]["components"][0]["why"]
    recs = body["recommendations"]
    assert recs and all(r["action_id"] is None for r in recs)

    top = body["hotspots"]["components"][0]
    lighter = db_client.post(
        "/api/v1/modules/epr/epr_uk/scenario",
        json={"changes": [{"component_id": top["component_id"], "weight_g": "1"}]},
        headers=viewer,
    ).json()
    assert lighter["scenario_fee"] < lighter["baseline_fee"] and lighter["delta"] < 0
    assert lighter["lines"][0]["component_id"] == top["component_id"]

    rec = recs[0]
    action = {"title": rec["title"], "recommendation_id": rec["id"], "kind": rec["kind"], "regime": "epr_uk"}
    assert db_client.post("/api/v1/actions", json=action, headers=viewer).status_code == 403
    created = db_client.post("/api/v1/actions", json=action, headers=h)
    assert created.status_code == 201, created.text
    again = db_client.post("/api/v1/actions", json=action, headers=h).json()
    assert again["id"] == created.json()["id"], "one action per recommendation"

    done = db_client.patch(
        f"/api/v1/actions/{again['id']}", json={"status": "done", "owner": "Packaging team"}, headers=h
    ).json()
    assert (done["status"], done["owner"]) == ("done", "Packaging team")
    linked = db_client.get("/api/v1/modules/epr/epr_uk/insights", headers=h).json()["recommendations"]
    assert next(r for r in linked if r["id"] == rec["id"])["action_id"] == again["id"]
    assert db_client.get("/api/v1/actions", headers=b).json() == []


def test_horizon_milestones_and_lead_time(db_client: TestClient, ws: dict[str, object]) -> None:
    h, viewer = _auth(ws["oa"], ws["a"]), _auth(ws["viewer"], ws["a"])
    res = db_client.get("/api/v1/modules/horizon", headers=viewer)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["lead_months"] == 3
    ids = {m["id"] for m in body["milestones"]}
    assert "uk-drs-2027" in ids  # workspace A is EPR + UK
    assert "ppwr-labels-2028" not in ids  # no PPWR module, no EU country

    assert (
        db_client.put("/api/v1/modules/horizon/settings", json={"lead_months": 24}, headers=viewer).status_code == 403
    )
    longer = db_client.put("/api/v1/modules/horizon/settings", json={"lead_months": 24}, headers=h).json()
    drs = next(m for m in longer["milestones"] if m["id"] == "uk-drs-2027")
    assert drs["status"] in ("collecting", "now") and drs["collect_from"] < drs["date"]
    assert db_client.put("/api/v1/modules/horizon/settings", json={"lead_months": 99}, headers=h).status_code == 422

    gaps = db_client.get("/api/v1/gaps", headers=h).json()
    assert gaps and all(g["phase"] in ("now", "collecting", "upcoming") for g in gaps)


def test_edit_product_and_components_with_validation_and_history(db_client: TestClient, ws: dict[str, object]) -> None:
    h, viewer = _auth(ws["oa"], ws["a"]), _auth(ws["viewer"], ws["a"])
    bad = db_client.patch("/api/v1/products/CSV-1", json={"values": {"gtin": "123"}}, headers=h)
    assert bad.status_code == 422 and errors(bad) == {"gtin": "A GTIN has 8, 12, 13 or 14 digits"}
    ok = db_client.patch(
        "/api/v1/products/CSV-1", json={"values": {"gtin": "5790001000011", "brand": "HLA"}}, headers=h
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["gtin"] == "5790001000011" and ok.json()["fields"]["gtin"]["source"] == "manual"

    grams = db_client.patch(
        "/api/v1/products/CSV-1/components/CSV-1-01", json={"values": {"weight_g": "26 g"}}, headers=h
    )
    assert errors(grams) == {"weight_g": "Write the number only, without units or commas. Did you mean 26?"}
    db_client.patch("/api/v1/products/CSV-1/components/CSV-1-01", json={"values": {"weight_g": "24"}}, headers=h)

    added = db_client.post(
        "/api/v1/products/CSV-1/components",
        json={"values": {"component_name": "Sleeve", "packaging_level": "Secondary", "material": "Paper/board"}},
        headers=h,
    )
    assert added.status_code == 201, added.text
    sleeve = next(c for c in added.json()["components"] if c["name"] == "Sleeve")
    removed = db_client.delete(f"/api/v1/products/CSV-1/components/{sleeve['id']}", headers=h).json()
    assert all(c["name"] != "Sleeve" for c in removed["components"])

    history = db_client.get("/api/v1/products/CSV-1/history", headers=viewer).json()
    changed = [(c["field"], c["after"]) for e in history for c in e["changes"]]
    assert ("weight_g", "24") in changed and ("gtin", "5790001000011") in changed
    assert db_client.patch("/api/v1/products/CSV-1", json={"values": {"brand": "X"}}, headers=viewer).status_code == 403
    nope = db_client.patch("/api/v1/products/CSV-1", json={"values": {"weight_g": "1"}}, headers=h)
    assert errors(nope) == {"weight_g": "Not a field you can edit here"}


def test_validation_flags_suggests_and_corrects(db_client: TestClient, ws: dict[str, object]) -> None:
    h = _auth(ws["oa"], ws["a"])
    draft = db_client.post("/api/v1/imports/sync", json={"system": "plm"}, headers=h).json()
    preview = db_client.put(
        f"/api/v1/imports/{draft['id']}/mapping", json={"mapping": draft["suggested_mapping"]}, headers=h
    ).json()
    assert preview["invalid_rows"] == 0 and preview["warnings"], "messy values import with warnings"
    db_client.post(f"/api/v1/imports/{draft['id']}/approve", headers=h)
    db_client.portal.call(wait_for_inline_jobs)

    issues = db_client.get("/api/v1/validation", headers=h).json()
    material = next(i for i in issues if i["field"] == "material" and i["value"] == "plastic")
    assert material["suggestion"] == "Plastic" and material["source"] == "plm"
    res = db_client.post("/api/v1/validation/apply", json={"ids": [material["id"]]}, headers=h)
    assert res.json()["applied"] == 1
    product = db_client.get(f"/api/v1/products/{material['sku']}", headers=h).json()
    comp = next(c for c in product["components"] if c["id"] == material["component_id"])
    assert comp["fields"]["material"] == {
        "dp": comp["fields"]["material"]["dp"],
        "value": "Plastic",
        "source": "correction",
    }
    assert all(i["id"] != material["id"] for i in db_client.get("/api/v1/validation", headers=h).json())
