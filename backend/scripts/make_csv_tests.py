# ruff: noqa: E501
"""Writes the CSV import test pack and its expected results.

Ten files in ``seeds/csv-tests/``, imported in order into an empty test workspace (modules EPR and
PPWR), each testing one part of the import: auto-mapping, client column names, rejected rows,
validation warnings, gaps and estimates, re-import, Excel-style files, volume and bad files.

The expected results (``seeds/csv-tests/EXPECTED.md``) are not typed by hand: this script runs
each file through the platform's own code (mapping suggestions, row checks, validation, the merge
used on import and the gap engine with the seeded rules), so they change when that code changes.

    python scripts/make_csv_tests.py        (from backend/, with the requirements installed)
"""

from __future__ import annotations

import csv
import importlib.util
import io
import sys
from collections import Counter
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.catalog import reference  # noqa: E402
from app.catalog.service import merge  # noqa: E402
from app.ingestion import service  # noqa: E402
from app.quality.engine import find_gaps  # noqa: E402
from app.quality.estimates import propose  # noqa: E402
from app.quality.validation import issues  # noqa: E402

OUT = ROOT / "seeds" / "csv-tests"
MODULES = {"EPR", "PPWR"}  # the test workspace's modules


def gtin(base12: str) -> str:
    """A GTIN-13 with a correct GS1 check digit."""
    total = sum(int(d) * (3 if i % 2 else 1) for i, d in enumerate(base12))
    return base12 + str((10 - total % 10) % 10)


# ---------------------------------------------------------------- the files
# fmt: off

FULL = [
    "sku", "product_name", "brand", "gtin", "component_id", "component_name", "packaging_level",
    "units_per_pack", "material", "polymer", "weight_g", "weight_source", "recycled_content_pct",
    "recycled_content_cert", "food_contact", "pfas_declaration_ref", "recyclability_result", "supplier_id",
]  # fmt: skip


def c(sku, name, brand, ean, cid, comp, level, units, material, polymer, weight, rc, cert, food, pfas, recyc, supplier):
    return [sku, name, brand, ean, cid, comp, level, units, material, polymer, weight, "Measured", rc, cert, food, pfas, recyc, supplier]


def file_01() -> tuple[list[str], list[list[str]]]:
    """Six products, 17 components, platform column names, every value valid and complete."""
    k, m, b, s, p, j = (gtin(f"57000000{n:04d}") for n in (1, 2, 3, 4, 5, 6))
    rows = [
        c("TST-KET-500", "Test Tomato Ketchup 500ml", "Test Foods", k, "TST-KET-500-01", "Squeeze bottle", "Primary", "1", "Plastic", "PET", "30", "30", "RC-PET-001", "Yes", "PFAS-001", "Good", "SUP-01"),
        c("TST-KET-500", "Test Tomato Ketchup 500ml", "Test Foods", k, "TST-KET-500-02", "Flip-top cap", "Primary", "1", "Plastic", "PP", "3", "0", "n/a", "Yes", "PFAS-002", "Good", "SUP-02"),
        c("TST-KET-500", "Test Tomato Ketchup 500ml", "Test Foods", k, "TST-KET-500-03", "Shipper case", "Secondary", "0.083", "Paper/board", "", "140", "70", "FSC-RC-01", "No", "", "Good", "SUP-03"),
        c("TST-MAYO-250", "Test Mayonnaise 250ml jar", "Test Foods", m, "TST-MAYO-250-01", "Glass jar", "Primary", "1", "Glass", "", "180", "40", "GL-RC-01", "Yes", "PFAS-003", "Good", "SUP-04"),
        c("TST-MAYO-250", "Test Mayonnaise 250ml jar", "Test Foods", m, "TST-MAYO-250-02", "Twist-off lid", "Primary", "1", "Steel", "", "8", "0", "n/a", "Yes", "PFAS-004", "Good", "SUP-05"),
        c("TST-MAYO-250", "Test Mayonnaise 250ml jar", "Test Foods", m, "TST-MAYO-250-03", "Paper label", "Primary", "1", "Paper/board", "", "1.5", "0", "n/a", "No", "", "Good", "SUP-06"),
        c("TST-BEAN-400", "Test Baked Beans 400g", "Test Foods", b, "TST-BEAN-400-01", "Steel can", "Primary", "1", "Steel", "", "45", "25", "ST-RC-01", "Yes", "PFAS-005", "Good", "SUP-07"),
        c("TST-BEAN-400", "Test Baked Beans 400g", "Test Foods", b, "TST-BEAN-400-02", "Paper label", "Primary", "1", "Paper/board", "", "2", "0", "n/a", "No", "", "Good", "SUP-06"),
        c("TST-BEAN-400", "Test Baked Beans 400g", "Test Foods", b, "TST-BEAN-400-03", "Shrink film", "Secondary", "0.25", "Plastic", "LDPE", "6", "0", "n/a", "No", "", "Good", "SUP-08"),
        c("TST-SOUP-500", "Test Tomato Soup 500ml pouch", "Test Foods", s, "TST-SOUP-500-01", "Stand-up pouch", "Primary", "1", "Plastic", "PP", "12", "0", "n/a", "Yes", "PFAS-006", "Good", "SUP-09"),
        c("TST-SOUP-500", "Test Tomato Soup 500ml pouch", "Test Foods", s, "TST-SOUP-500-02", "Screw cap", "Primary", "1", "Plastic", "PP", "2.5", "0", "n/a", "Yes", "PFAS-007", "Good", "SUP-02"),
        c("TST-SOUP-500", "Test Tomato Soup 500ml pouch", "Test Foods", s, "TST-SOUP-500-03", "Display tray", "Secondary", "0.1", "Paper/board", "", "95", "80", "FSC-RC-02", "No", "", "Good", "SUP-03"),
        c("TST-SAUCE-300", "Test BBQ Sauce 300ml", "Test Foods", p, "TST-SAUCE-300-01", "Glass bottle", "Primary", "1", "Glass", "", "220", "35", "GL-RC-01", "Yes", "PFAS-008", "Good", "SUP-04"),
        c("TST-SAUCE-300", "Test BBQ Sauce 300ml", "Test Foods", p, "TST-SAUCE-300-02", "Aluminium cap", "Primary", "1", "Aluminium", "", "4", "0", "n/a", "Yes", "PFAS-009", "Good", "SUP-10"),
        c("TST-SAUCE-300", "Test BBQ Sauce 300ml", "Test Foods", p, "TST-SAUCE-300-03", "Paper label", "Primary", "1", "Paper/board", "", "1.8", "0", "n/a", "No", "", "Good", "SUP-06"),
        c("TST-JUICE-1L", "Test Apple Juice 1L", "Test Drinks", j, "TST-JUICE-1L-01", "PET bottle", "Primary", "1", "Plastic", "PET", "38", "50", "RC-PET-002", "Yes", "PFAS-010", "Good", "SUP-01"),
        c("TST-JUICE-1L", "Test Apple Juice 1L", "Test Drinks", j, "TST-JUICE-1L-02", "HDPE cap", "Primary", "1", "Plastic", "HDPE", "2.8", "0", "n/a", "Yes", "PFAS-011", "Good", "SUP-02"),
    ]
    return FULL, rows


def file_02() -> tuple[list[str], list[list[str]]]:
    """Two new products with a client's own column names; two columns have no field."""
    cols = ["Article", "Description", "EAN", "Component", "Level", "Units", "Material", "Weight (g)", "PCR", "Plant", "Comment"]
    a, b = gtin("570000000101"), gtin("570000000102")
    rows = [
        ["TST-PEST-190", "Test Pesto 190g", a, "Glass jar", "Primary", "1", "Glass", "160", "30", "Aarhus", ""],
        ["TST-PEST-190", "Test Pesto 190g", a, "Metal lid", "Primary", "1", "Steel", "7", "0", "Aarhus", ""],
        ["TST-JAM-370", "Test Strawberry Jam 370g", b, "Glass jar", "Primary", "1", "Glass", "190", "30", "Odense", "new recipe"],
        ["TST-JAM-370", "Test Strawberry Jam 370g", b, "Metal lid", "Primary", "1", "Steel", "8", "0", "Odense", ""],
        ["TST-JAM-370", "Test Strawberry Jam 370g", b, "Paper label", "Primary", "1", "Paper/board", "1.2", "0", "Odense", ""],
    ]
    return cols, rows


def file_03() -> tuple[list[str], list[list[str]]]:
    """Six rows, three without a required value: they are skipped with row and column."""
    cols = ["sku", "product_name", "component_name", "material", "weight_g", "packaging_level"]
    rows = [
        ["TST-RICE-1KG", "Test Rice 1kg", "Paper bag", "Paper/board", "22", "Primary"],
        ["", "Test Rice 1kg", "Window film", "Plastic", "1", "Primary"],
        ["TST-RICE-1KG", "Test Rice 1kg", "Shipper case", "Paper/board", "300", "Secondary"],
        ["TST-OATS-500", "", "Carton", "Paper/board", "35", "Primary"],
        ["TST-OATS-500", "Test Oats 500g", "", "Plastic", "4", "Primary"],
        ["TST-OATS-500", "Test Oats 500g", "Inner bag", "Plastic", "6", "Primary"],
    ]
    return cols, rows


def file_04() -> tuple[list[str], list[list[str]]]:
    """Values the catalogue does not accept: imported as they are, listed with a correction."""
    cols = [
        "sku", "product_name", "gtin", "component_id", "component_name", "packaging_level", "material",
        "weight_g", "recycled_content_pct", "food_contact", "pfas_declaration_ref", "doc_issue_date",
        "data_carrier_url",
    ]  # fmt: skip
    rows = [
        ["TST-VAL-01", "Test Vinegar 500ml", "570-0000-002013", "TST-VAL-01-01", "Glass bottle", "primary", "glass", "260 g", "30%", "ja", "PFAS-020", "10/08/2026", "id.example.com/01/5700000002013"],
        ["TST-VAL-01", "Test Vinegar 500ml", "570-0000-002013", "TST-VAL-01-02", "Cap", "Primary", "Plastik", "0.003 kg", "0", "Y", "PFAS-021", "10/08/2026", "id.example.com/01/5700000002013"],
        ["TST-VAL-02", "Test Olive Oil 750ml", "5700000002021", "TST-VAL-02-01", "Glass bottle", "Primary", "Glass", "2,5", "130", "Yes", "PFAS-022", "10 Aug 2026", "https://id.example.com/01/5700000002021"],
        ["TST-VAL-02", "Test Olive Oil 750ml", "5700000002021", "TST-VAL-02-02", "Pourer", "Primary", "Plastic", "-4", "0", "Yes", "PFAS-023", "10 Aug 2026", "https://id.example.com/01/5700000002021"],
    ]
    return cols, rows


def file_05() -> tuple[list[str], list[list[str]]]:
    """Values left out or not good enough: each row triggers one gap rule."""
    g1, g2 = gtin("570000000301"), gtin("570000000302")
    rows = [
        # GR-008 weight missing (estimable: average of Plastic / Primary weights already stored)
        c("TST-GAP-01", "Test Hot Sauce 150ml", "Test Foods", g1, "TST-GAP-01-01", "Squeeze bottle", "Primary", "1", "Plastic", "PET", "", "30", "RC-PET-003", "Yes", "PFAS-030", "Good", "SUP-01"),
        # GR-010 recycled content missing (estimable: fixed 0)
        c("TST-GAP-01", "Test Hot Sauce 150ml", "Test Foods", g1, "TST-GAP-01-02", "Cap", "Primary", "1", "Plastic", "PP", "2", "", "", "Yes", "PFAS-031", "Good", "SUP-02"),
        # GR-006 food contact without PFAS declaration (needs data)
        c("TST-GAP-01", "Test Hot Sauce 150ml", "Test Foods", g1, "TST-GAP-01-03", "Inner seal", "Primary", "1", "Plastic", "PP", "0.5", "0", "n/a", "Yes", "", "Good", "SUP-11"),
        # GR-009 GTIN missing (needs data); GR-005 recycled content without certificate (needs data)
        c("TST-GAP-02", "Test Chutney 300g", "Test Foods", "", "TST-GAP-02-01", "Glass jar", "Primary", "1", "Glass", "", "200", "25", "", "Yes", "PFAS-032", "Good", "SUP-04"),
        # GR-004 limited recyclability (warning)
        c("TST-GAP-03", "Test Crisps 150g", "Test Snacks", g2, "TST-GAP-03-01", "Metallised bag", "Primary", "1", "Plastic", "PP", "5", "0", "n/a", "Yes", "PFAS-033", "Limited", "SUP-12"),
    ]
    rows.append(c("TST-GAP-03", "Test Crisps 150g", "Test Snacks", g2, "TST-GAP-03-02", "Shipper case", "Secondary", "0.05", "Paper/board", "", "180", "70", "FSC-RC-01", "No", "", "Good", "SUP-03"))
    rows[-1][FULL.index("weight_source")] = "Spec"  # GR-003 weight from specification (warning)
    return FULL, rows


def file_06() -> tuple[list[str], list[list[str]]]:
    """Re-import of file 01 products: changed, empty and new values, a new component, a new SKU."""
    cols = ["sku", "product_name", "brand", "component_id", "component_name", "material", "weight_g", "packaging_level"]
    rows = [
        # weight 30 -> 28: replaced
        ["TST-KET-500", "Test Tomato Ketchup 500ml", "Test Foods", "TST-KET-500-01", "Squeeze bottle", "Plastic", "28", "Primary"],
        # weight empty: the stored 3 is kept
        ["TST-KET-500", "Test Tomato Ketchup 500ml", "Test Foods", "TST-KET-500-02", "Flip-top cap", "Plastic", "", "Primary"],
        # new component on an existing product
        ["TST-KET-500", "Test Tomato Ketchup 500ml", "Test Foods", "TST-KET-500-04", "Shrink sleeve", "Plastic", "1.2", "Primary"],
        # brand changed; component matched by name (no component ID)
        ["TST-MAYO-250", "Test Mayonnaise 250ml jar", "Test Foods Premium", "", "Glass jar", "Glass", "175", "Primary"],
        # new SKU
        ["TST-NEW-01", "Test Mustard 200ml", "Test Foods", "", "Squeeze bottle", "Plastic", "18", "Primary"],
    ]
    return cols, rows


def file_07() -> tuple[list[str], list[list[str]]]:
    """Excel style: semicolons, UTF-8 with BOM, quoted values with semicolons and quotes, Danish letters."""
    cols = ["SKU", "Product name", "Component name", "Material", "Empty weight", "Packaging level"]
    rows = [
        ["TST-DK-01", "Rødgrød med fløde 500g", "Glas; klassisk", "Glass", "210", "Primary"],
        ["TST-DK-01", "Rødgrød med fløde 500g", 'Låg "twist-off"', "Steel", "9", "Primary"],
        ["TST-DK-02", "Æblemost økologisk 1L", "Flaske", "Glass", "420", "Primary"],
    ]
    return cols, rows


def file_08() -> tuple[list[str], list[list[str]]]:
    """Volume: 2,000 products with 4 components each (8,000 rows, 20,000 is the limit)."""
    cols = ["sku", "product_name", "gtin", "component_name", "packaging_level", "material", "polymer", "weight_g", "recycled_content_pct"]
    rows = []
    parts = [("Bottle", "Primary", "Plastic", "PET", 25), ("Cap", "Primary", "Plastic", "PP", 2),
             ("Label", "Primary", "Paper/board", "", 1), ("Shipper case", "Secondary", "Paper/board", "", 120)]  # fmt: skip
    for n in range(1, 2001):
        sku, ean = f"TST-VOL-{n:04d}", gtin(f"5701{n:08d}")
        for name, level, material, polymer, weight in parts:
            rows.append([sku, f"Test Volume Product {n}", ean, name, level, material, polymer, str(weight + n % 7), "0"])
    return cols, rows


def file_09() -> tuple[list[str], list[list[str]]]:
    """Two columns with the same name: the upload is refused."""
    return ["sku", "product_name", "component_name", "weight_g", "weight_g"], [["TST-BAD-01", "Test", "Jar", "100", "110"]]


FILES = [
    ("01-products-clean.csv", file_01, ",", False),
    ("02-client-column-names.csv", file_02, ",", False),
    ("03-rejected-rows.csv", file_03, ",", False),
    ("04-validation-warnings.csv", file_04, ",", False),
    ("05-gaps-and-estimates.csv", file_05, ",", False),
    ("06-reimport-updates.csv", file_06, ",", False),
    ("07-excel-semicolon-bom.csv", file_07, ";", True),
    ("08-volume-2000-skus.csv", file_08, ",", False),
    ("09-duplicate-columns.csv", file_09, ",", False),
]


# fmt: on
# ---------------------------------------------------------------- expected results


def _rules() -> list[SimpleNamespace]:
    """The seeded gap rules (migrations 0005 and 0007) for the test workspace's modules."""
    path = ROOT / "migrations" / "versions" / "20261112_0005_data_core.py"
    spec = importlib.util.spec_from_file_location("m0005", path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    rules = [
        SimpleNamespace(
            id=r[0], name=r[1], data_point=r[2], field=r[3], check=r[4], severity=r[5], modules=r[6], active=True
        )
        for r in mod.RULES
    ]
    rules.append(
        SimpleNamespace(
            id="GR-010",
            name="Recycled content missing",
            data_point="DP13",
            field="recycled_content_pct",
            check={"kind": "missing"},
            severity="warning",
            modules=["PPWR", "EPR"],
            active=True,
        )
    )
    methods = {"GR-008": {"method": "similar_average"}, "GR-010": {"method": "fixed", "value": "0"}}
    labels = {"GR-008": "estimate: similar average", "GR-010": "estimate: fixed 0"}
    for r in rules:
        r.method, r.estimate = methods.get(r.id), labels.get(r.id)
    return [r for r in rules if MODULES & set(r.modules)]


class Store:
    """The workspace's products in memory, written with the platform's own merge rules."""

    def __init__(self) -> None:
        self.products: dict[str, SimpleNamespace] = {}

    def apply(self, batch: SimpleNamespace) -> dict[str, int]:
        by_sku: dict[str, list[dict[str, str]]] = {}
        for r in service.parse(batch):
            if r["ok"]:
                by_sku.setdefault(r["values"]["sku"], []).append(r["values"])
        created = 0
        for sku, lines in by_sku.items():
            p = self.products.get(sku)
            if p is None:
                p = self.products[sku] = SimpleNamespace(sku=sku, fields={}, passport={}, components=[])
                created += 1
            pf: dict[str, str] = {}
            pp: dict[str, str] = {}
            for values in lines:
                comp: dict[str, str] = {}
                for key, value in values.items():
                    level = reference.field_level(key)
                    if level == "Product":
                        pf[key] = value or pf.get(key, "")
                    elif level == "Passport":
                        pp[key] = value or pp.get(key, "")
                    elif level == "Component" or key == "component_id":
                        comp[key] = value
                code = comp.pop("component_id", "").strip()
                name = comp.get("component_name", "").strip()
                match = next((x for x in p.components if code and x.code == code), None) or next(
                    (x for x in p.components if name and (x.fields.get("component_name") or {}).get("value") == name),
                    None,
                )
                if match is None:
                    match = SimpleNamespace(code=code or f"{sku}-{len(p.components) + 1:02d}", fields={})
                    p.components.append(match)
                match.fields = merge(match.fields, comp, source="csv")
            p.fields = merge(p.fields, pf, source="csv")
            p.passport = merge(p.passport, pp, source="csv")
        return {"products": len(by_sku), "created": created, "updated": len(by_sku) - created}


def read_like_browser(text: str) -> list[list[str]]:
    """What the Import screen's CSV reader produces (``frontend/src/app/screens/import/csv.ts``)."""
    first = text.split("\n", 1)[0]
    delimiter = ";" if first.count(";") > first.count(",") else ","
    rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))
    return [r for r in rows if any(cell.strip() for cell in r)]


def expected(store: Store, rules: list[SimpleNamespace], name: str, text: str) -> list[str]:
    rows = read_like_browser(text)
    columns, data = rows[0], rows[1:]
    out = [f"## {name}", ""]
    if len(set(columns)) != len(columns):
        return [*out, "Upload refused: **Column names must be different**. Nothing is stored.", ""]
    mapping = service.suggest_mapping(columns)
    labels = {t["key"]: t["label"] for t in service.targets()}
    batch = SimpleNamespace(id=name, columns=columns, rows=data, mapping=mapping, extras={})
    pv = service.preview(batch, set(store.products))
    out += [f"{len(data):,} rows, {len(columns)} columns.", "", "**Suggested mapping**", ""]
    if len(columns) <= 20:
        out += ["| Column in file | Field |", "| --- | --- |"]
        out += [f"| `{col}` | {labels.get(mapping[col], 'Skip') if mapping[col] else 'Skip'} |" for col in columns]
    out += [
        "",
        "**Review step**",
        "",
        "| Valid rows | Rows with errors | New products | Updated products |",
        "| --- | --- | --- | --- |",
    ]
    out += [f"| {pv['valid_rows']:,} | {pv['invalid_rows']} | {pv['new_products']:,} | {pv['updated_products']} |", ""]
    if pv["issues"]:
        out += (
            ["Rows that will be skipped:", ""]
            + [f"- Row {i['row']}: {i['column']} {i['message'].lower()}" for i in pv["issues"]]
            + [""]
        )
    if pv["warnings"]:
        out += ["Imported as they are, to correct in Validation:", ""]
        out += [f"- Row {w['row']}, {w['column']}: {w['message']}" for w in pv["warnings"]] + [""]
    before = Counter(g["rule_id"] for g in find_gaps(store.products.values(), rules))
    result = store.apply(batch)
    gaps = find_gaps(store.products.values(), rules)
    after = Counter(g["rule_id"] for g in gaps)
    out += [
        f"**After approval:** {result['products']:,} products imported ({result['created']:,} new, {result['updated']} updated). Workspace: {len(store.products):,} products, {sum(len(p.components) for p in store.products.values()):,} components.",
        "",
    ]
    changed = [r for r in rules if after[r.id] != before[r.id]]
    if changed:
        out += [
            "**Open gaps after this file** (workspace total)",
            "",
            "| Rule | Gaps | Change | Kind |",
            "| --- | --- | --- | --- |",
        ]
        for r in changed:
            needs_value = r.check.get("kind") == "missing" or r.severity == "blocker"
            kind = (r.estimate or "needs data") if needs_value else "warning"
            out.append(f"| {r.id} {r.name} | {after[r.id]:,} | {after[r.id] - before[r.id]:+,} | {kind} |")
        out += [""]
    invalid = len(issues(list(store.products.values())))
    out += [f"**Data validation screen:** {invalid} values to correct (workspace total).", ""]
    if name.startswith("05"):
        by_rule = {r.id: r for r in rules}
        comps = {(p.sku, c.code): c for p in store.products.values() for c in p.components}
        out += ["**Fill estimates** (Data gaps) proposes:", ""]
        for g in gaps:
            rule = by_rule[g["rule_id"]]
            if rule.method and g["sku"].startswith("TST-GAP"):
                comp = comps.get((g["sku"], g["component_id"]))
                est = propose(rule.method, rule.field, comp, list(store.products.values()))
                text = f"{est['value']} ({est['basis']})" if est else "no estimate"
                out.append(f"- {g['sku']} · {g['component_name']} · {g['field_label']}: {text}")
        out += [""]
    return out


def summary(store: Store, rules: list[SimpleNamespace]) -> list[str]:
    gaps = Counter(g["rule_id"] for g in find_gaps(store.products.values(), rules))
    out = ["## After all files", "", "| Rule | Open gaps | Kind |", "| --- | --- | --- |"]
    for r in rules:
        if gaps[r.id]:
            needs_value = r.check.get("kind") == "missing" or r.severity == "blocker"
            out.append(
                f"| {r.id} {r.name} | {gaps[r.id]:,} | {(r.estimate or 'needs data') if needs_value else 'warning'} |"
            )
    return [*out, ""]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    store, rules = Store(), _rules()
    lines = [
        "# CSV import test pack: expected results",
        "",
        "Generated by `backend/scripts/make_csv_tests.py` from the platform's own import, validation and gap code.",
        "Assumes a new, empty workspace with modules EPR and PPWR, the seeded gap rules (GR-001 to GR-010) unchanged,",
        "and the files imported in this order with the suggested mapping accepted. Gap counts are workspace totals.",
        "",
    ]
    for name, make, delimiter, bom in FILES:
        cols, rows = make()
        buf = io.StringIO()
        csv.writer(buf, delimiter=delimiter, lineterminator="\r\n").writerows([cols, *rows])
        text = buf.getvalue()
        (OUT / name).write_text(text, encoding="utf-8-sig" if bom else "utf-8", newline="")
        lines += expected(store, rules, name, text)
        print(f"{name}: {len(rows):,} rows")
    lines += summary(store, rules)
    (OUT / "EXPECTED.md").write_text("\n".join(lines), encoding="utf-8")
    print("EXPECTED.md written")


if __name__ == "__main__":
    main()
