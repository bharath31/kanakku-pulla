import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.config import settings
from app.database import Base, engine
from app.seed import seed_categories
from app.api import auth, cards, statements, transactions, analytics, alerts, webhooks, inboxes, ai_activity

logger = logging.getLogger(__name__)


def _run_migrations():
    """Add columns that are missing from existing tables."""
    inspector = inspect(engine)
    with engine.begin() as conn:
        if "credit_cards" in inspector.get_table_names():
            existing = {col["name"] for col in inspector.get_columns("credit_cards")}
            if "user_id" not in existing:
                logger.info("Adding user_id column to credit_cards")
                conn.execute(text("ALTER TABLE credit_cards ADD COLUMN user_id INTEGER REFERENCES users(id)"))

        if "users" in inspector.get_table_names():
            existing = {col["name"] for col in inspector.get_columns("users")}
            if "totp_secret" not in existing:
                logger.info("Adding 2FA columns to users")
                conn.execute(text("ALTER TABLE users ADD COLUMN totp_secret TEXT"))
                conn.execute(text("ALTER TABLE users ADD COLUMN totp_pending_secret TEXT"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    seed_categories()
    yield


app = FastAPI(title="Kanakku Pulla", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(inboxes.router, prefix="/api/v1/inboxes", tags=["inboxes"])
app.include_router(cards.router, prefix="/api/v1/cards", tags=["cards"])
app.include_router(statements.router, prefix="/api/v1/statements", tags=["statements"])
app.include_router(transactions.router, prefix="/api/v1/transactions", tags=["transactions"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["alerts"])
app.include_router(webhooks.router, prefix="/api/v1/webhooks", tags=["webhooks"])
app.include_router(ai_activity.router, prefix="/api/v1/ai", tags=["ai"])


@app.get("/health")
def health():
    return {"status": "ok"}
