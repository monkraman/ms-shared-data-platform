"""Reference data shipped with the app, generated from the team's data set.

``reference/*.json`` is written by ``node scripts/make-mock-fixtures.js`` in ``frontend/``
from ``reference-docs-teams/datapoints-epr-ppwr-main/src``:

* ``data-points.json``: the regulatory data points (seeded into ``data_points`` by migration 0005),
  the source systems and the outputs they feed.
* ``fields.json``: every collected field, its label, data point and level (product, component...).
* ``sample-products.json``: the sample client's products, used by the simulated ERP/PLM sync.
"""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path
from typing import Any

_DIR = Path(__file__).resolve().parent / "reference"


def _load(name: str) -> Any:
    return json.loads((_DIR / name).read_text(encoding="utf-8"))


@cache
def dictionary() -> dict[str, Any]:
    return _load("data-points.json")


@cache
def fields() -> dict[str, dict[str, Any]]:
    """Field key → {label, dp, level, type, allowed}."""
    return _load("fields.json")


@cache
def sample_products() -> dict[str, Any]:
    return _load("sample-products.json")


def field_level(key: str) -> str | None:
    info = fields().get(key)
    return info["level"] if info else None


def field_dp(key: str) -> str | None:
    info = fields().get(key)
    return info["dp"] if info else None
