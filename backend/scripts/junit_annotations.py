"""Turn pytest JUnit XML failures into GitHub annotations (readable without signing in)."""

import sys
import xml.etree.ElementTree as ET


def escape(text: str) -> str:
    return text.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def main(path: str) -> None:
    root = ET.parse(path).getroot()
    for case in root.iter("testcase"):
        for kind in ("failure", "error"):
            node = case.find(kind)
            if node is None:
                continue
            name = f"{case.get('classname')}::{case.get('name')}"
            body = (node.get("message") or "") + "\n" + (node.text or "")
            print(f"::error title={kind}: {name}::{escape(body[-3500:])}")


if __name__ == "__main__":
    main(sys.argv[1])
