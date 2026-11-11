"""The access-token signing key (``JWT_SECRET_KEY``). Tokens are made and checked in ``app.core.auth``."""

import logging
import secrets

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _load_secret_key() -> str:
    """Read the JWT signing key from settings; never fall back to a fixed value.

    Production refuses to start without JWT_SECRET_KEY. Other environments get a
    random per-process key, so tokens stop working on restart until the variable is set.
    """
    settings = get_settings()
    if settings.jwt_secret_key:
        return settings.jwt_secret_key
    if settings.app_env == "production":
        raise RuntimeError("JWT_SECRET_KEY must be set when APP_ENV=production.")
    logger.warning("JWT_SECRET_KEY is not set; using a random key for this process only.")
    return secrets.token_urlsafe(48)


SECRET_KEY = _load_secret_key()
ALGORITHM = "HS256"
