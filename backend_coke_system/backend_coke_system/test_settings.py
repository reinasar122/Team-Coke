"""Isolated SQLite databases for tests; never use the local POS/mobile data."""

from .settings import *  # noqa: F403

DATABASES = {
    "default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"},
    "mobile_orders": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"},
}
# Test current POS models independently of the historical MySQL migration graph.
MIGRATION_MODULES = {"api": None}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
ALLOWED_HOSTS = ["testserver", "localhost", "127.0.0.1"]
