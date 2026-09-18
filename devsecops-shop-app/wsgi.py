"""WSGI entrypoint for Flask / Docker."""

from app import create_app

app = create_app()
