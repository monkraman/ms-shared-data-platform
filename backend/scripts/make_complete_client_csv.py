# ruff: noqa: E501
"""Writes one complete client file: every data point the platform stores per SKU, filled and valid.

``seeds/csv-tests/complete-client.csv`` is a fictional Danish food company (Nordlys Foods ApS) with
three products and nine packaging components. Every product, passport and component field of the
catalogue has a column, so one import fills every data point a CSV can carry.

The script proves it with the platform's own code and stops with an error if any check fails:
every column maps itself, no row is rejected, no value is flagged by validation, no gap rule fires
(all modules: EPR, PPWR, DPP), completeness is 100%, every SKU's status is OK and every PPWR
declaration is ready to sign. It also writes ``COMPLETE_CLIENT.md``: which column fills which data
point, and which data points cannot come from a CSV.

    python scripts/make_complete_client_csv.py        (from backend/)
"""

from __future__ import annotations

import csv
import io
import sys
from collections import Counter
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import make_csv_tests  # noqa: E402
from make_csv_tests import Store, gtin  # noqa: E402

from app.catalog import reference  # noqa: E402
from app.catalog.service import summary  # noqa: E402
from app.ingestion import service  # noqa: E402
from app.modules import assessment, ppwr_doc  # noqa: E402
from app.quality.engine import find_gaps  # noqa: E402
from app.quality.validation import issues  # noqa: E402

OUT = ROOT / "seeds" / "csv-tests"
COUNTRIES = ["GB", "DK"]

# fmt: off
PRODUCT = {
    "NLF-KET-500": dict(product_name="Nordlys Tomatketchup 500ml", brand="Nordlys", gtin=gtin("571234500001"), container_volume_ml="500",
                        commodity_code="2103200000", carbon_footprint_kgco2e="0.42", drs_status="Not in scheme"),
    "NLF-MAYO-250": dict(product_name="Nordlys Mayonnaise 250ml glas", brand="Nordlys", gtin=gtin("571234500002"), container_volume_ml="250",
                         commodity_code="2103909000", carbon_footprint_kgco2e="0.61", drs_status="Not in scheme"),
    "NLF-JUICE-1L": dict(product_name="Nordlys Æblemost 1L", brand="Nordlys Frugt", gtin=gtin("571234500003"), container_volume_ml="1000",
                         commodity_code="2009790000", carbon_footprint_kgco2e="0.38", drs_status="In scheme"),
}

# (component, level, units per pack, material, polymer, split, weight g, colour, recycled %, food contact, conai band, supplier)
COMPONENTS = {
    "NLF-KET-500": [
        ("Squeeze bottle", "Primary", "1", "Plastic", "PET", "PET 100", "30", "Clear", "50", "Yes", "A1", "SUP-PET-01"),
        ("Flip-top cap", "Primary", "1", "Plastic", "PP", "PP 100", "3", "Red", "10", "Yes", "B1", "SUP-CAP-01"),
        ("Shipper case", "Secondary", "0.083", "Paper/board", "", "Paper/board 100", "140", "Brown", "70", "No", "n/a", "SUP-BOARD-01"),
    ],
    "NLF-MAYO-250": [
        ("Glass jar", "Primary", "1", "Glass", "", "Glass 100", "180", "Flint", "40", "Yes", "n/a", "SUP-GLASS-01"),
        ("Twist-off lid", "Primary", "1", "Steel", "", "Steel 100", "8", "White", "20", "Yes", "n/a", "SUP-METAL-01"),
        ("Paper label", "Primary", "1", "Paper/board", "", "Paper/board 100", "1.5", "White", "30", "No", "n/a", "SUP-LABEL-01"),
    ],
    "NLF-JUICE-1L": [
        ("PET bottle", "Primary", "1", "Plastic", "PET", "PET 100", "38", "Clear", "50", "Yes", "A1", "SUP-PET-01"),
        ("HDPE cap", "Primary", "1", "Plastic", "HDPE", "HDPE 100", "2.8", "Green", "10", "Yes", "B1", "SUP-CAP-01"),
        ("Shrink film", "Secondary", "0.167", "Plastic", "LDPE", "LDPE 100", "6", "Clear", "35", "No", "B2", "SUP-FILM-01"),
    ],
}
# fmt: on


def rows() -> tuple[list[str], list[list[str]]]:
    levels = ("Product", "Passport", "Component")
    keys = [k for lvl in levels for k, f in reference.fields().items() if f["level"] == lvl]
    columns = ["sku", "component_id", *keys]
    out = []
    for sku, p in PRODUCT.items():
        short = sku.removeprefix("NLF-")
        url = f"https://id.nordlys.example/01/{p['gtin']}"
        product = {
            **p,
            "reusable": "No",
            "minimisation_assessment_ref": f"MIN-{short}-2026",
            "empty_space_ratio_pct": "12",
            "doc_reference": f"DOC-{sku}",
            "doc_version": "v1",
            "technical_file_refs": f"TF-{short}-RECYCLABILITY;TF-{short}-PFAS;TF-{short}-MINIMISATION",
            "doc_manufacturer": "Nordlys Foods ApS",
            "doc_signatory": "Mette Holm, Head of Packaging Compliance",
            "doc_issue_date": "2026-08-12",
            "retention_until": "2036-08-12",
            "harmonised_label_status": "On pack",
            "data_carrier_url": url,
            "triman_on_pack": "Yes",
            "it_environmental_label": "On pack",
            "unique_product_id": url,
            "passport_level": "Model",
            "facility_id": "DK-FAC-0042",
            "end_of_life_info": "Empty the pack. Sort each part as shown on the label.",
            "passport_host": "Nordlys Foods ApS",
            "public_fields": "Material, recycled content, end-of-life",
            "registry_id": f"EU-DPP-{sku}",
        }
        for n, (name, level, units, material, polymer, split, weight, colour, rc, food, conai, supplier) in enumerate(
            COMPONENTS[sku], 1
        ):
            plastic = material == "Plastic"
            comp = {
                "component_name": name,
                "packaging_level": level,
                "units_per_pack": units,
                "material": material,
                "polymer": polymer or "n/a",
                "material_split": split,
                "weight_g": weight,
                "weight_source": "Measured",
                "colour": colour,
                "additives": "Water-based inks" if material == "Paper/board" else "None",
                "recyclability_result": "Good",
                "recycled_content_pct": rc,
                "recycled_content_cert": f"RCC-{short}-{n:02d}",
                "food_contact": food,
                "pfas_declaration_ref": f"PFAS-{short}-{n:02d}",
                "heavy_metals_mgkg": "4",
                "soc_declaration_ref": f"SOC-{short}-{n:02d}",
                "conai_band": conai,
                "non_recycled_plastic_g": f"{float(weight) * (1 - float(rc) / 100):g}" if plastic else "0",
                "supplier_id": supplier,
            }
            values = {**product, **comp}
            out.append([sku, f"{sku}-{n:02d}", *(values[k] for k in keys)])
    return columns, out


def main() -> None:
    columns, data = rows()
    buf = io.StringIO()
    csv.writer(buf, lineterminator="\r\n").writerows([columns, *data])
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "complete-client.csv").write_text(buf.getvalue(), encoding="utf-8", newline="")

    # Prove it with the platform's own code.
    mapping = service.suggest_mapping(columns)
    unmapped = [c for c, k in mapping.items() if k != c]
    batch = SimpleNamespace(id="complete", columns=columns, rows=data, mapping=mapping, extras={})
    pv = service.preview(batch, set())
    store = Store()
    store.apply(batch)
    products = list(store.products.values())
    for p in products:
        p.sales = []
    rules = _all_rules()
    gaps = find_gaps(products, rules)
    invalid = issues(products)
    complete = {p.sku: summary(p)["completeness_pct"] for p in products}
    status = {}
    for p in products:
        a = assessment.product(p, workspace_countries=COUNTRIES, ppwr=True, fees=[], open_gaps=0)
        status[p.sku] = (a["status"], a["ram"], a["grade"], a["status_reasons"])
    docs = {p.sku: ppwr_doc.readiness(p) for p in products}

    problems = []
    if unmapped:
        problems.append(f"columns not mapped to themselves: {unmapped}")
    if pv["invalid_rows"] or pv["warnings"]:
        problems.append(f"rejected rows or warnings: {pv['issues'] + pv['warnings']}")
    if gaps:
        problems.append(f"gaps: {Counter(g['rule_id'] for g in gaps)}")
    if invalid:
        problems.append(f"validation: {[(i['sku'], i['field'], i['value']) for i in invalid]}")
    if any(v != 100 for v in complete.values()):
        problems.append(f"completeness: {complete}")
    if any(s[0] != "ok" for s in status.values()):
        problems.append(f"status: {status}")
    if any(d.get("status") != "ready" for d in docs.values()):
        problems.append(f"declarations: {docs}")
    if problems:
        raise SystemExit("complete-client.csv is not complete:\n- " + "\n- ".join(problems))

    write_doc(columns, data, pv, status)
    print(f"complete-client.csv: {len(data)} rows, {len(columns)} columns; every check passed")


def _all_rules() -> list[SimpleNamespace]:
    """Every seeded gap rule: the workspace has all modules."""
    make_csv_tests.MODULES = {"EPR", "PPWR", "DPP", "LCA"}
    return make_csv_tests._rules()


def write_doc(columns: list[str], data: list[list[str]], pv: dict, status: dict) -> None:
    fields = reference.fields()
    points = reference.dictionary()["data_points"]
    in_csv = {fields[c]["dp"] for c in columns if c in fields and fields[c]["dp"]} | {"DP01"}
    lines = [
        "# Complete client file: Nordlys Foods ApS",
        "",
        "Generated by `backend/scripts/make_complete_client_csv.py`, which also checks it with the platform's own code.",
        "",
        f"`complete-client.csv`: {len(PRODUCT)} products, {len(data)} components, {len(columns)} columns. One import fills",
        f"every data point a CSV can carry: **{len(in_csv)} of {len(points)}**. The other {len(points) - len(in_csv)} are listed at the end.",
        "",
        "## How to load it",
        "",
        "1. As platform admin, create a workspace (for example `Nordlys Foods`) with modules **EPR, PPWR and DPP** and countries **GB and DK**.",
        "2. Open the workspace, go to **Data collection → Import** and drop `complete-client.csv`. Every column maps to its field.",
        f"3. **Review** shows {pv['valid_rows']} valid rows, 0 with errors, {pv['new_products']} new products, no warnings. Approve.",
        "",
        "## What you should see",
        "",
        "| Screen | Expected |",
        "| --- | --- |",
        "| SKU library | 3 products, each 100% complete and status OK |",
        "| Data gaps | No open gaps |",
        "| Data validation | Nothing to correct |",
        '| Compliance → PPWR | Each declaration "Ready to sign", in Danish and English |',
        '| Product page | Every value shows source "File import" |',
        "",
        "| SKU | Status | UK RAM | PPWR grade |",
        "| --- | --- | --- | --- |",
        *(f"| {sku} | {s[0].upper()} | {s[1]} | {s[2]} |" for sku, s in status.items()),
        "",
        "EPR fees stay empty: they need sales lines (below), which a CSV cannot bring.",
        "",
        "## Column → data point",
        "",
        "| Column | Field | Level | Data point |",
        "| --- | --- | --- | --- |",
        "| `sku` | SKU | Product | DP01 |",
        "| `component_id` | Component ID | Component | key |",
        *(
            f"| `{c}` | {fields[c]['label']} | {fields[c]['level']} | {fields[c]['dp'] or '—'} |"
            for c in columns
            if c in fields
        ),
        "",
        "## Data points a CSV cannot carry yet",
        "",
        "| Data point | Name | Fields | Why |",
        "| --- | --- | --- | --- |",
    ]
    by_dp: dict[str, list[tuple[str, str]]] = {}
    for key, f in fields.items():
        by_dp.setdefault(f["dp"], []).append((key, f["level"]))
    for d in points:
        if d["code"] in in_csv:
            continue
        found = by_dp.get(d["code"], [])
        lv = {lvl for _, lvl in found}
        why = (
            "Sales lines come only from the ERP sync"
            if lv == {"Sales"}
            else "Company and market details have no storage in the platform yet"
        )
        if "Sales" in lv and lv != {"Sales"}:
            why = "Sales lines come only from the ERP sync; company and market details have no storage yet"
        lines.append(f"| {d['code']} | {d['name']} | {', '.join(f'`{k}`' for k, _ in found)} | {why} |")
    (OUT / "COMPLETE_CLIENT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
