#!/usr/bin/env python3
"""Minimal CycloneDX SBOM when syft is unavailable (student agents)."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <app_dir> <out.json>", file=sys.stderr)
        return 2
    app_dir, out = Path(sys.argv[1]), Path(sys.argv[2])
    req = app_dir / "requirements.txt"
    components = []
    if req.exists():
        for line in req.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or line.startswith("-"):
                continue
            name, _, ver = line.partition("==")
            components.append(
                {
                    "type": "library",
                    "name": name.strip(),
                    "version": ver.strip() or "unknown",
                    "purl": f"pkg:pypi/{name.strip()}@{ver.strip() or 'unknown'}",
                }
            )
    doc = {
        "bomFormat": "CycloneDX",
        "specVersion": "1.5",
        "version": 1,
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "tools": [{"name": "sbom_fallback.py", "vendor": "devsecops-shop"}],
            "component": {"type": "application", "name": "shop-api"},
        },
        "components": components,
    }
    out.write_text(json.dumps(doc, indent=2), encoding="utf-8")
    print(f"Wrote fallback SBOM {out} ({len(components)} components)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
