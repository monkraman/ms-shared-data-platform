"""Check a stored value against the field catalogue, and suggest the corrected value.

The catalogue (``reference/fields.json``) gives each field a type (Number, Code, Yes/No, Date,
URL, List, Text) and, for some, allowed values or a range ("0–100"). ``check`` returns
``None`` when the value is fine, otherwise the problem and, when it can work one out, the
suggested correction, for example:

* "plastic" → "Plastic" (allowed values, any case; close spellings)
* "26 g" → "26", "0.026 kg" → "26" for grams, "2,5" → "2.5", "30%" → "30"
* "yes" / "Y" / "true" → "Yes"
* "10/08/2026" or "10 Aug 2026" → "2026-08-10"
* "id.example.com/01/…" → "https://id.example.com/01/…"
* GTIN: spaces removed, length and check digit verified

Empty values are not checked here (missing data is a gap); "n/a" means not applicable.
"""

from __future__ import annotations

import difflib
import re
from datetime import date
from typing import Any

from app.catalog import reference

NOT_APPLICABLE = {"n/a", "na", "not applicable"}
_MONTHS = {
    m: i for i, m in enumerate(("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"), 1)
}
_YES = {"yes", "y", "true", "1", "ja"}
_NO = {"no", "n", "false", "0", "nej"}


def _allowed(info: dict[str, Any]) -> list[str]:
    raw = info.get("allowed") or ""
    if ":" in raw or "–" in raw or not raw:  # descriptive ("UK: Red, …") or a range
        return []
    return [a.strip() for a in raw.split(",") if a.strip()]


def _range(info: dict[str, Any]) -> tuple[float, float] | None:
    m = re.fullmatch(r"\s*(-?\d+(?:\.\d+)?)\s*[–-]\s*(-?\d+(?:\.\d+)?)\s*", info.get("allowed") or "")
    return (float(m[1]), float(m[2])) if m else None


def _plain(n: float) -> str:
    return str(int(n)) if float(n).is_integer() else f"{n:g}"


def _problem(message: str, suggestion: str | None = None) -> dict[str, str | None]:
    return {"message": message, "suggestion": suggestion}


def _number(key: str, text: str, info: dict[str, Any]) -> dict[str, str | None] | None:
    t = text.strip().replace(" ", " ")
    try:
        n = float(t)
    except ValueError:
        n = None
    if n is None:
        m = re.fullmatch(r"(-?\d+(?:[.,]\d+)?)\s*(kg|g|mg|%|ml|l)?", t.lower().replace(" ", ""))
        if not m:
            return _problem("Not a number")
        n = float(m[1].replace(",", "."))
        unit = m[2]
        if key.endswith("_g") and unit == "kg":
            n *= 1000
        elif key.endswith("_g") and unit == "mg":
            n /= 1000
        elif key.endswith("_ml") and unit == "l":
            n *= 1000
        suggestion = _plain(round(n, 3))
        return _problem("Write the number only, without units or commas", suggestion)
    bounds = _range(info)
    if bounds and not bounds[0] <= n <= bounds[1]:
        fix = _plain(n * 100) if bounds == (0.0, 100.0) and 0 < n <= 1 else None
        return _problem(f"Must be between {_plain(bounds[0])} and {_plain(bounds[1])}", fix)
    if n < 0:
        return _problem("Cannot be negative")
    return None


def _code(text: str, allowed: list[str]) -> dict[str, str | None] | None:
    if text in allowed:
        return None
    exact = next((a for a in allowed if a.lower() == text.lower().strip()), None)
    if exact:
        return _problem("Use the listed spelling", exact)
    close = difflib.get_close_matches(text.strip(), allowed, n=1, cutoff=0.6) or difflib.get_close_matches(
        text.strip().lower(), [a.lower() for a in allowed], n=1, cutoff=0.6
    )
    fix = next((a for a in allowed if a.lower() == close[0].lower()), None) if close else None
    return _problem(f"Not one of: {', '.join(allowed)}", fix)


def _date(text: str) -> dict[str, str | None] | None:
    t = text.strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", t):
        try:
            date.fromisoformat(t)
            return None
        except ValueError:
            return _problem("Not a real date")
    fix = None
    if m := re.fullmatch(r"(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})", t):  # day first (EU)
        try:
            fix = date(int(m[3]), int(m[2]), int(m[1])).isoformat()
        except ValueError:
            fix = None
    elif m := re.fullmatch(r"(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})", t):
        month = _MONTHS.get(m[2].lower())
        fix = date(int(m[3]), month, int(m[1])).isoformat() if month else None
    return _problem("Use the date format YYYY-MM-DD", fix)


def _gtin(text: str) -> dict[str, str | None] | None:
    digits = re.sub(r"[\s-]", "", text)
    if not digits.isdigit() or len(digits) not in (8, 12, 13, 14):
        return _problem("A GTIN has 8, 12, 13 or 14 digits")
    body, check = digits[:-1], int(digits[-1])
    total = sum(int(d) * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(body)))
    if (10 - total % 10) % 10 != check:
        return _problem("The check digit is wrong")
    return _problem("Digits only", digits) if digits != text else None


def check(key: str, raw: str | None) -> dict[str, str | None] | None:
    """The problem with this value for this field, with a suggested correction when possible."""
    text = "" if raw is None else str(raw)
    if not text.strip() or text.strip().lower() in NOT_APPLICABLE:
        return None
    if key == "gtin":
        return _gtin(text)
    info = reference.fields().get(key)
    if info is None:
        return None
    kind = info.get("type")
    if text != text.strip():
        return _problem("Remove the spaces around the value", text.strip())
    if kind == "Number":
        return _number(key, text, info)
    if kind == "Yes/No":
        low = text.lower()
        if text in ("Yes", "No"):
            return None
        return _problem("Answer Yes or No", "Yes" if low in _YES else "No" if low in _NO else None)
    if kind == "Code":
        allowed = _allowed(info)
        return _code(text, allowed) if allowed else None
    if kind == "Date":
        return _date(text)
    if kind == "URL":
        if re.fullmatch(r"https?://\S+", text):
            return None
        return _problem(
            "Must be a web address", f"https://{text}" if re.fullmatch(r"[\w.-]+\.[a-z]{2,}\S*", text) else None
        )
    return None


def check_all(values: dict[str, Any]) -> dict[str, dict[str, str | None]]:
    """Problems by field for a set of incoming values (empty values are skipped)."""
    out = {}
    for key, raw in values.items():
        problem = check(key, raw)
        if problem:
            out[key] = problem
    return out
