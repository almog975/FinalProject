"""Load and ingest SBOM / vulnerability scan artifacts.

Resolution order for GET endpoints:
  1. Files under SECURITY_ARTIFACTS_DIR (sbom.json / scan-report.json)
  2. Latest row in security_artifacts (DB)
  3. Bundled samples/ (so compose works without a pipeline)
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.extensions import db
from app.models.security_artifact import SecurityArtifact

KIND_SBOM = SecurityArtifact.KIND_SBOM
KIND_SCAN = SecurityArtifact.KIND_SCAN

FILE_NAMES = {
    KIND_SBOM: "sbom.json",
    KIND_SCAN: "scan-report.json",
}

VALID_KINDS = frozenset(FILE_NAMES)


class SecurityServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _package_root() -> Path:
    """devsecops-shop-app/ (parent of app/)."""
    return Path(__file__).resolve().parents[2]


def samples_dir() -> Path:
    return _package_root() / "samples"


def artifacts_dir() -> Path | None:
    raw = os.environ.get("SECURITY_ARTIFACTS_DIR", "").strip()
    if not raw:
        return None
    return Path(raw)


def normalize_kind(kind: str) -> str:
    value = (kind or "").strip().lower()
    aliases = {
        "sbom": KIND_SBOM,
        "scan": KIND_SCAN,
        "scan-report": KIND_SCAN,
        "scan_report": KIND_SCAN,
        "vuln": KIND_SCAN,
        "vulnerability": KIND_SCAN,
    }
    if value not in aliases:
        raise SecurityServiceError(
            f"Unknown kind '{kind}'. Use 'sbom' or 'scan' (scan-report).",
            400,
        )
    return aliases[value]


def _read_json_file(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise SecurityServiceError(f"Artifact at {path} must be a JSON object", 500)
    return data


def _mtime_iso(path: Path) -> str | None:
    try:
        ts = path.stat().st_mtime
    except OSError:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def _from_artifacts_dir(kind: str) -> dict[str, Any] | None:
    directory = artifacts_dir()
    if directory is None:
        return None
    path = directory / FILE_NAMES[kind]
    content = _read_json_file(path)
    if content is None:
        return None
    return {
        "source": "file",
        "kind": kind,
        "path": str(path),
        "created_at": _mtime_iso(path),
        "artifact": content,
    }


def _from_db(kind: str) -> dict[str, Any] | None:
    row = (
        SecurityArtifact.query.filter_by(kind=kind)
        .order_by(SecurityArtifact.created_at.desc(), SecurityArtifact.id.desc())
        .first()
    )
    if row is None:
        return None
    return {
        "source": "db",
        "kind": kind,
        "path": None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "artifact": row.content,
    }


def _from_samples(kind: str) -> dict[str, Any] | None:
    path = samples_dir() / FILE_NAMES[kind]
    content = _read_json_file(path)
    if content is None:
        return None
    return {
        "source": "samples",
        "kind": kind,
        "path": str(path),
        "created_at": _mtime_iso(path),
        "artifact": content,
    }


def get_latest(kind: str) -> dict[str, Any]:
    """Return envelope with latest artifact for kind (never raises if samples exist)."""
    normalized = normalize_kind(kind)
    for loader in (_from_artifacts_dir, _from_db, _from_samples):
        payload = loader(normalized)
        if payload is not None:
            return payload
    raise SecurityServiceError(
        f"No {normalized} artifact available (file, DB, or samples)",
        404,
    )


def load_json_path(path: str | Path) -> dict[str, Any]:
    file_path = Path(path)
    if not file_path.is_file():
        raise SecurityServiceError(f"File not found: {file_path}", 400)
    try:
        with file_path.open(encoding="utf-8") as handle:
            data = json.load(handle)
    except json.JSONDecodeError as exc:
        raise SecurityServiceError(f"Invalid JSON in {file_path}: {exc}", 400) from exc
    if not isinstance(data, dict):
        raise SecurityServiceError("Artifact JSON must be an object", 400)
    return data


def ingest_content(kind: str, content: dict[str, Any]) -> dict[str, Any]:
    """Persist artifact JSON into security_artifacts and optionally mirror to dir."""
    if not isinstance(content, dict):
        raise SecurityServiceError("content must be a JSON object", 400)
    normalized = normalize_kind(kind)
    row = SecurityArtifact(kind=normalized, content=content)
    db.session.add(row)
    db.session.commit()

    directory = artifacts_dir()
    mirrored_path = None
    if directory is not None:
        directory.mkdir(parents=True, exist_ok=True)
        target = directory / FILE_NAMES[normalized]
        with target.open("w", encoding="utf-8") as handle:
            json.dump(content, handle, indent=2)
            handle.write("\n")
        mirrored_path = str(target)

    return {
        "id": row.id,
        "kind": row.kind,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "mirrored_to": mirrored_path,
    }


def ingest_file(kind: str, path: str | Path) -> dict[str, Any]:
    return ingest_content(kind, load_json_path(path))
