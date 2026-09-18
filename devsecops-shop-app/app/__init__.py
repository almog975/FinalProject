"""Flask application factory."""

from flask import Flask
from flask_restful import Api
from sqlalchemy.pool import StaticPool

from app.api.cart import CartItemResource, CartResource, CartUserResource
from app.api.health import health_bp
from app.api.orders import OrderListResource, OrderResource
from app.api.products import ProductListResource, ProductResource
from app.api.security import ScanReportResource, SbomResource
from app.config import get_config
from app.extensions import db, migrate
from app.cli import register_cli
from app.frontend import register_frontend
from app.instrumentator import Instrumentator


def create_app(config_name: str | None = None) -> Flask:
    """Create and configure the Flask application."""
    flask_app = Flask(__name__)
    cfg = get_config(config_name)
    flask_app.config.from_object(cfg)
    uri = cfg.SQLALCHEMY_DATABASE_URI
    flask_app.config["SQLALCHEMY_DATABASE_URI"] = uri

    if uri.startswith("sqlite"):
        flask_app.config.setdefault(
            "SQLALCHEMY_ENGINE_OPTIONS",
            {
                "connect_args": {"check_same_thread": False},
                "poolclass": StaticPool,
            },
        )

    db.init_app(flask_app)
    migrate.init_app(flask_app, db)

    flask_app.register_blueprint(health_bp)

    api = Api(flask_app, prefix="/api")
    api.add_resource(ProductListResource, "/products")
    api.add_resource(ProductResource, "/products/<int:product_id>")
    api.add_resource(CartResource, "/cart")
    api.add_resource(CartUserResource, "/cart/<string:user_id>")
    api.add_resource(
        CartItemResource, "/cart/<string:user_id>/item/<int:product_id>"
    )
    api.add_resource(OrderListResource, "/orders")
    api.add_resource(OrderResource, "/orders/<int:order_id>")
    api.add_resource(SbomResource, "/security/sbom")
    api.add_resource(ScanReportResource, "/security/scan-report")

    # Prometheus metrics at GET /metrics (see app/instrumentator.py)
    Instrumentator().instrument(flask_app).expose(flask_app, endpoint="metrics")

    # Import models for metadata registration (avoid shadowing local flask_app)
    import app.models  # noqa: F401

    with flask_app.app_context():
        db.create_all()

    register_cli(flask_app)

    # SPA last — must not shadow /api, /health, /ready, /metrics
    register_frontend(flask_app)

    return flask_app
