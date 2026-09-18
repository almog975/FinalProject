"""Flask CLI commands."""

from app.cli.security import register_security_cli


def register_cli(app):
    register_security_cli(app)
