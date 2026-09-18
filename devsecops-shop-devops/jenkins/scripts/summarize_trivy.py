#!/usr/bin/env python3
"""Convert raw Trivy JSON into a compact scan-report envelope for the shop API."""
from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <trivy.json> <out.json>", file=sys.stderr)
        return 2
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    if not src.exists():
        print(f"missing {src}", file=sys.stderr)
        return 1
    data = json.loads(src.read_text(encoding="utf-8"))
    results = data.get("Results") or []
    vulns = []
    counts: Counter[str] = Counter()
    for result in results:
        for v in result.get("Vulnerabilities") or []:
            sev = (v.get("Severity") or "UNKNOWN").upper()
            counts[sev.lower()] += 1
            counts["total"] += 1
            vulns.append(
                {
                    "id": v.get("VulnerabilityID"),
                    "severity": sev,
                    "pkg": v.get("PkgName"),
                    "installed": v.get("InstalledVersion"),
                    "fixed": v.get("FixedVersion"),
                    "title": v.get("Title"),
                }
            )
    envelope = {
        "scanner": {"name": "trivy", "generated_at": datetime.now(timezone.utc).isoformat()},
        "summary": {
            "critical": counts.get("critical", 0),
            "high": counts.get("high", 0),
            "medium": counts.get("medium", 0),
            "low": counts.get("low", 0),
            "unknown": counts.get("unknown", 0),
            "total": counts.get("total", 0),
        },
        "vulnerabilities": vulns[:200],
    }
    dst.write_text(json.dumps(envelope, indent=2), encoding="utf-8")
    print(f"Wrote {dst} summary={envelope['summary']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
