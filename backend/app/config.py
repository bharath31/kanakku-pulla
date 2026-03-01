import logging
import secrets

from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    database_url: str = "sqlite:///./kanakku.db"
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    cors_origins: str = "http://localhost:3000"

    # Cloudflare Workers AI
    cloudflare_account_id: str = ""
    cloudflare_api_token: str = ""

    # AgentMail
    agentmail_api_key: str = ""
    agentmail_webhook_secret: str = ""

    # Auth
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    # 2FA
    totp_issuer: str = "Kanakku Pulla"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

# Generate a random JWT secret if not set
if not settings.jwt_secret_key:
    settings.jwt_secret_key = secrets.token_hex(32)
    logger.warning(
        "JWT_SECRET_KEY not set — generated a random secret. "
        "Set JWT_SECRET_KEY in .env for persistent sessions across restarts."
    )
