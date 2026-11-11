"""Write the API's OpenAPI document for the frontend client: python scripts/export_openapi.py <path>."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import create_application  # noqa: E402


def main(path: str) -> None:
    spec = create_application().openapi()
    Path(path).write_text(json.dumps(spec, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1])
