"""Serve the Vite React SPA from frontend/dist (same origin as the API).

Registered last so /api/*, /health, /ready, and /metrics keep their handlers.
If dist is missing (local tests without a frontend build), routes are skipped.
"""

from __future__ import annotations

import os
from pathlib import Path

from flask import Flask, send_from_directory


def frontend_dist_path() -> Path:
    """Resolve SPA build directory.

    Override with FRONTEND_DIST (absolute or relative to CWD).
    Default: <package_root>/frontend/dist  (package_root = parent of app/).
    In the Docker image that is /app/frontend/dist.
    """
    override = os.environ.get("FRONTEND_DIST", "").strip()
    if override:
        return Path(override).resolve()
    package_root = Path(__file__).resolve().parents[1]
    return package_root / "frontend" / "dist"


def register_frontend(flask_app: Flask) -> None:
    dist = frontend_dist_path()
    if not dist.is_dir() or not (dist / "index.html").is_file():
        flask_app.logger.info(
            "Frontend dist not found at %s — SPA routes not registered", dist
        )
        return

    @flask_app.get("/")
    def spa_index():
        return send_from_directory(dist, "index.html")

    @flask_app.get("/<path:path>")
    def spa_assets_or_fallback(path: str):
        # Belt-and-suspenders: never steal reserved API/ops paths if unmatched.
        first = path.split("/", 1)[0]
        if first in {"api", "health", "ready", "metrics"}:
            return {"error": "Not found"}, 404

        candidate = dist / path
        if path and candidate.is_file():
            return send_from_directory(dist, path)
        return send_from_directory(dist, "index.html")
