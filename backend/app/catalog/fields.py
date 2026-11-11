"""Reading stored field maps: one place for the small helpers every module needs.

A field map is ``{"weight_g": {"dp": "DP09", "value": "26"}}``; values are always strings.
"""

from __future__ import annotations

from typing import Any

FieldMap = dict[str, dict[str, Any]]

# Weight sources that are estimates. Specification weights are recorded data, but EPR
# results still flag them as not measured.
ESTIMATE_SOURCES = frozenset({"Estimated", "Estimate"})
NOT_MEASURED_SOURCES = ESTIMATE_SOURCES | {"Spec"}


def value(fields: FieldMap, key: str) -> str:
    """The stored text of a field, trimmed; "" when absent."""
    return str((fields.get(key) or {}).get("value", "")).strip()


def number(text: str | None) -> float | None:
    """The text as a number, or None when it is empty or not a number."""
    try:
        return float(text) if text not in (None, "") else None
    except ValueError:
        return None


def fmt(n: float) -> str:
    """26.0 → "26", 2.13 → "2.1", 1234.5 → "1,235"."""
    if n >= 100:
        return f"{n:,.0f}"
    return str(int(n)) if float(n).is_integer() else f"{n:.1f}"
