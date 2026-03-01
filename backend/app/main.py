from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.seed import seed_categories
from app.api import auth, cards, statements, transactions, analytics, alerts, webhooks, inboxes


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_categories()
    yield


app = FastAPI(title="Kanakku Pulla", version="0.1.0", lifespan=lifespan)

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


@app.get("/health")
def health():
    return {"status": "ok"}
