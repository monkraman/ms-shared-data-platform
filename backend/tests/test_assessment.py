"""Per-SKU business rules (app/modules/assessment.py, epr modulation): no database needed."""

from __future__ import annotations

from collections import Counter
from types import SimpleNamespace as NS
from typing import Any

from app.modules import assessment, epr, skus


def fm(**values: Any) -> dict[str, dict[str, str]]:
    return {k: {"dp": None, "value": str(v)} for k, v in values.items()}


def comp(code: str, **values: Any) -> NS:
    return NS(code=code, fields=fm(**values))


def product(components: list[NS], sales: list[dict[str, Any]] | None = None) -> NS:
    lines = sales or [{"period": "2026", "channel": "Household", "units_placed": 1_000_000, "units_exported": 0}]
    return NS(
        sku="SKU-1",
        fields=fm(product_name="Test"),
        passport={},
        components=components,
        sales=[NS(code=f"S{i}", fields=fm(**s)) for i, s in enumerate(lines)],
    )


def test_ram_rating_rules() -> None:
    rate = lambda **v: assessment.component(fm(**v))["ram"]  # noqa: E731
    assert rate(material="Glass", recyclability_result="Good") == "Green"
    assert rate(material="Plastic", recyclability_result="Limited") == "Amber"
    assert rate(material="Plastic", recyclability_result="Good", colour="Black") == "Red"
    assert rate(material="Plastic", polymer="PVC", recyclability_result="Good") == "Red"
    assert rate(material="Plastic", recyclability_result="Good", material_split="PET 45; Aluminium 25; PE 25") == "Red"
    assert rate(material="Steel", recyclability_result="Good", material_split="Steel 90; Plastic 10") == "Amber"
    assert rate(material="Glass") == "Red"  # not assessed
    assert rate(material="Plastic", recyclability_result="Green", colour="Black") == "Green"  # stated rating wins
    assert rate(recyclability_result="Good") is None  # no material


def test_ppwr_grade_is_weighted_over_primary_components() -> None:
    p = product(
        [
            comp("B", material="Plastic", packaging_level="Primary", weight_g=26, recyclability_result="Limited"),
            comp("C", material="Plastic", packaging_level="Primary", weight_g=6, recyclability_result="Good"),
            comp("T", material="Paper/board", packaging_level="Transit", weight_g=180, recyclability_result="Poor"),
        ]
    )
    per = {c.code: assessment.component(c.fields) for c in p.components}
    unit = assessment.packaging_unit(p, per)
    assert unit["recyclable_pct"] == round((26 * 75 + 6 * 100) / 32, 1) and unit["grade"] == "C"
    per["C"] = assessment.component(fm(material="Plastic", packaging_level="Primary"))
    assert assessment.packaging_unit(p, per)["grade"] is None  # a primary component is not assessed


def test_recycled_content_per_packaging_unit() -> None:
    p = product(
        [
            comp(
                "J",
                material="Plastic",
                polymer="PET",
                food_contact="Yes",
                packaging_level="Primary",
                weight_g=30,
                recycled_content_pct=40,
            ),
            comp(
                "L",
                material="Plastic",
                polymer="PP",
                food_contact="Yes",
                packaging_level="Primary",
                weight_g=8,
                recycled_content_pct=0,
            ),
            comp(
                "F",
                material="Plastic",
                polymer="LDPE",
                packaging_level="Secondary",
                weight_g=10,
                recycled_content_pct=0,
            ),
            comp("K", material="Paper/board", packaging_level="Transit", weight_g=200),
            comp("W", material="Plastic", packaging_level="Transit", weight_g=2, recycled_content_pct=0),
        ]
    )
    units = {u["level"]: u for u in assessment.recycled_content(p)}
    assert units["Primary"]["target_pct"] == 30 and units["Primary"]["met"]  # 31.6% recycled, mainly PET
    assert units["Secondary"]["target_pct"] == 35 and units["Secondary"]["met"] is False
    assert units["Transit"]["exempt"] and units["Transit"]["met"]  # plastic under 5% of the unit


def test_fees_follow_markets_and_ram_modulation() -> None:
    green = comp("G", material="Glass", weight_g=1000, recyclability_result="Good", packaging_level="Primary")
    uk_line = {"period": "2026", "channel": "Household", "units_placed": 1000, "units_exported": 0, "market": "UK"}
    dk_line = {**uk_line, "market": "DK"}
    p = product([green], [uk_line, dk_line])
    uk = epr.calculate("epr_uk", [p], "2026")
    assert uk["modulated"] and uk["fee_tonnes"] == 1.0  # only the UK line counts
    assert uk["total_fee"] == round(epr.regimes()["epr_uk"]["rates"]["GL"] * 0.9, 2)  # Green factor
    before = product([green], [{**uk_line, "period": "2025"}])
    assert epr.calculate("epr_uk", [before], "2025")["total_fee"] == epr.regimes()["epr_uk"]["rates"]["GL"]

    tenant = NS(modules=["EPR", "PPWR"], countries=["UK", "DK"])
    row = skus.assess([p], tenant, Counter())["SKU-1"]
    assert row["markets"] == ["DK", "UK"] and not row["markets_assumed"] and row["ppwr_in_scope"]
    assert {f["regime"] for f in row["fees"]} == {"epr_uk", "epr_dk"}  # SB 54 is not a workspace country
    assert row["ram"] == "Green" and row["grade"] == "A" and row["status"] == "ok"
