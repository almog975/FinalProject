"""Health and readiness endpoints."""

from flask import Blueprint, jsonify
from sqlalchemy import text

from app.extensions import db

health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health():
    """Liveness probe — process is up."""
    return jsonify({"status": "ok"}), 200


@health_bp.get("/ready")
def ready():
    """Readiness probe — database is reachable."""
    try:
        db.session.execute(text("SELECT 1"))
        return jsonify({"status": "ready"}), 200
    except Exception as exc:  # noqa: BLE001 — surface readiness failure
        return jsonify({"status": "not_ready", "error": str(exc)}), 503
