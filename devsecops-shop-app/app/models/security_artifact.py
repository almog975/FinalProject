"""Security artifact model (SBOM / vulnerability scan summaries)."""

from datetime import datetime, timezone

from app.extensions import db


def _utcnow():
    return datetime.now(timezone.utc)


class SecurityArtifact(db.Model):
    """Persisted pipeline security artifact (latest row per kind wins on read)."""

    __tablename__ = "security_artifacts"

    KIND_SBOM = "sbom"
    KIND_SCAN = "scan"

    id = db.Column(db.Integer, primary_key=True)
    kind = db.Column(db.String(32), nullable=False, index=True)
    content = db.Column(db.JSON, nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True), default=_utcnow, nullable=False, index=True
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "kind": self.kind,
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
