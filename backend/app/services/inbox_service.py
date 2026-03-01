import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.inbox import Inbox


async def create_agentmail_inbox(db: Session, username: str) -> Inbox:
    """Create a new AgentMail inbox for the user."""
    email_address = f"{username}@agentmail.to"

    # Check if already exists
    existing = db.query(Inbox).filter(Inbox.email_address == email_address).first()
    if existing:
        return existing

    agentmail_inbox_id = None

    if settings.agentmail_api_key:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.agentmail.to/v0/inboxes",
                headers={"Authorization": f"Bearer {settings.agentmail_api_key}"},
                json={"username": username},
            )
            if resp.status_code == 200:
                data = resp.json()
                agentmail_inbox_id = data.get("id")

    inbox = Inbox(
        agentmail_inbox_id=agentmail_inbox_id,
        email_address=email_address,
        is_active=True,
    )
    db.add(inbox)
    db.commit()
    db.refresh(inbox)
    return inbox
