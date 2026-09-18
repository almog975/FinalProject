"""Application configuration."""

import os


class Config:
    """Base configuration."""

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False

    @staticmethod
    def database_url() -> str:
        url = os.environ.get("DATABASE_URL")
        if url:
            # Normalize Heroku-style postgres:// to SQLAlchemy-friendly form
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql://", 1)
            return url
        # Unit tests / local without Postgres
        return "sqlite://"


class DevelopmentConfig(Config):
    DEBUG = True

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return self.database_url()


class TestingConfig(Config):
    TESTING = True
    DEBUG = True

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        # Prefer explicit test URL; otherwise in-memory SQLite
        return os.environ.get("TEST_DATABASE_URL", "sqlite://")


class ProductionConfig(Config):
    DEBUG = False

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return self.database_url()


def get_config(name: str | None = None):
    """Return a config class instance by environment name."""
    env = (name or os.environ.get("FLASK_ENV", "development")).lower()
    mapping = {
        "development": DevelopmentConfig,
        "testing": TestingConfig,
        "production": ProductionConfig,
    }
    cls = mapping.get(env, DevelopmentConfig)
    return cls()
