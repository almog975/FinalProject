"""Minimal Instrumentator-compatible metrics helper.

Current PyPI ``prometheus-flask-instrumentator`` (4.1.1) requires Flask <2,
which conflicts with the course Flask 3 stack. This shim uses prometheus_client
to expose GET /metrics with request latency and count, matching the API used by
``Instrumentator().instrument(app).expose(app, endpoint=\"metrics\")``.

When a Flask-3-compatible upstream release returns, swap the import in
``app/__init__.py`` back to ``prometheus_flask_instrumentator``.
"""

from __future__ import annotations

import time
from typing import Optional

from flask import Flask, Response, request
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest


REQUEST_COUNT = Counter(
    "flask_http_request_total",
    "Total HTTP requests",
    ["method", "status", "path"],
)
REQUEST_LATENCY = Histogram(
    "flask_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "path"],
)


class Instrumentator:
    """Tiny stand-in for prometheus_flask_instrumentator.Instrumentator."""

    def __init__(self) -> None:
        self._app: Optional[Flask] = None

    def instrument(self, app: Flask) -> "Instrumentator":
        self._app = app

        @app.before_request
        def _start_timer():  # type: ignore[misc]
            request._prom_start = time.perf_counter()  # noqa: SLF001

        @app.after_request
        def _record(response):  # type: ignore[misc]
            start = getattr(request, "_prom_start", None)
            # Normalize path template-ish: use rule if available
            path = request.path
            if request.url_rule is not None:
                path = request.url_rule.rule
            if start is not None:
                REQUEST_LATENCY.labels(method=request.method, path=path).observe(
                    time.perf_counter() - start
                )
            REQUEST_COUNT.labels(
                method=request.method, status=str(response.status_code), path=path
            ).inc()
            return response

        return self

    def expose(self, app: Flask, endpoint: str = "metrics") -> "Instrumentator":
        def metrics_view():
            return Response(generate_latest(), mimetype=CONTENT_TYPE_LATEST)

        # Avoid duplicate registration on repeated create_app in tests
        if endpoint not in app.view_functions:
            app.add_url_rule(f"/{endpoint}", endpoint=endpoint, view_func=metrics_view)
        return self
