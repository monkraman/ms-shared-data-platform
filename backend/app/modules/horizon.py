"""Horizon scanning: requirements coming into force, and when to start collecting their data.

The rule: data for a requirement is collected from ``lead months`` before it applies (the
workspace's ``horizon_lead_months``, default 3). Each data point's date comes from the data
point dictionary (``applies_from``); milestones group them (``reference/horizon.json``).

Phases, for a requirement date D and today T:
* ``now``: no date, or D ≤ T (in force);
* ``collecting``: D − lead ≤ T < D (collect now so the data is ready on D);
* ``upcoming``: T < D − lead (not asked for yet).
"""

from __future__ import annotations

import json
import re
from datetime import date
from functools import cache
from pathlib import Path
from typing import Any, Literal

Phase = Literal["now", "collecting", "upcoming"]
_REFERENCE = Path(__file__).resolve().parent / "reference" / "horizon.json"
_MONTHS = {
    m: i for i, m in enumerate(("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"), 1)
}
EU = {"DE", "FR", "ES", "IT", "DK", "NL"}


@cache
def reference() -> dict[str, Any]:
    return json.loads(_REFERENCE.read_text(encoding="utf-8"))


def parse_date(text: str | None) -> date | None:
    """ "12 Aug 2026" → 2026-08-12, "2030" → 2030-01-01, "2026-08-12" as is."""
    if not text:
        return None
    text = text.strip()
    if m := re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", text):
        return date(int(m[1]), int(m[2]), int(m[3]))
    if m := re.fullmatch(r"(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})", text):
        month = _MONTHS.get(m[2].lower())
        return date(int(m[3]), month, int(m[1])) if month else None
    if m := re.fullmatch(r"(\d{4})", text):
        return date(int(m[1]), 1, 1)
    return None


def collect_from(applies: date, lead_months: int) -> date:
    month = applies.month - lead_months
    year = applies.year + (month - 1) // 12
    month = (month - 1) % 12 + 1
    return date(year, month, min(applies.day, 28))


def phase(applies: date | None, lead_months: int, today: date) -> Phase:
    if applies is None or applies <= today:
        return "now"
    return "collecting" if collect_from(applies, lead_months) <= today else "upcoming"


def in_scope(milestone: dict[str, Any], modules: set[str], countries: set[str]) -> bool:
    if modules and milestone["module"] not in modules:
        return False
    if not countries:
        return True
    wanted = set(milestone["countries"])
    if "EU" in wanted and countries & EU:
        return True
    if "US-CA" in wanted:
        return True  # shown as a preview to every EPR workspace, like SB 54 results
    return bool(wanted & countries)


def milestone_points(milestone: dict[str, Any], points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if "data_points" in milestone:
        return [p for p in points if p["code"] in milestone["data_points"]]
    return [p for p in points if (p.get("applies_from") or "") == milestone["dp_applies_from"]]
