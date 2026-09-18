"""Flask CLI: flask security-ingest <kind> <path.json>"""

from __future__ import annotations

import click
from flask import Flask

from app.services import security_service
from app.services.security_service import SecurityServiceError


def register_security_cli(app: Flask) -> None:
    @app.cli.command("security-ingest")
    @click.argument("kind")
    @click.argument("path", type=click.Path(exists=True, dir_okay=False, readable=True))
    def security_ingest(kind: str, path: str) -> None:
        """Ingest an SBOM or scan-report JSON into the DB (and SECURITY_ARTIFACTS_DIR).

        KIND is 'sbom' or 'scan' (aliases: scan-report).

        Example:
          flask security-ingest sbom /artifacts/sbom.json
          flask security-ingest scan /artifacts/scan-report.json
        """
        try:
            result = security_service.ingest_file(kind, path)
        except SecurityServiceError as exc:
            raise click.ClickException(exc.message) from exc
        click.echo(
            f"Ingested {result['kind']} id={result['id']} "
            f"created_at={result['created_at']}"
            + (
                f" mirrored_to={result['mirrored_to']}"
                if result.get("mirrored_to")
                else ""
            )
        )
