from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.inbox import Inbox
from app.services.inbox_service import create_agentmail_inbox

router = APIRouter()


class InboxCreate(BaseModel):
    username: str  # e.g. "bharath-cc" → bharath-cc@agentmail.to


class InboxResponse(BaseModel):
    id: int
    email_address: str
    is_active: bool

    model_config = {"from_attributes": True}


@router.post("/", response_model=InboxResponse)
async def create_inbox(data: InboxCreate, db: Session = Depends(get_db)):
    inbox = await create_agentmail_inbox(db, data.username)
    return inbox


@router.get("/", response_model=list[InboxResponse])
def list_inboxes(db: Session = Depends(get_db)):
    return db.query(Inbox).all()


@router.get("/{inbox_id}", response_model=InboxResponse)
def get_inbox(inbox_id: int, db: Session = Depends(get_db)):
    inbox = db.query(Inbox).filter(Inbox.id == inbox_id).first()
    if not inbox:
        raise HTTPException(status_code=404, detail="Inbox not found")
    return inbox
