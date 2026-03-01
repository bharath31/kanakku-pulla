import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.credit_card import CreditCard
from app.models.inbox import Inbox
from app.schemas.cards import CardCreate, CardResponse, CardUpdate
from app.services.inbox_service import create_agentmail_inbox

router = APIRouter()


def _make_inbox_username(card: CreditCard) -> str:
    first_name = re.sub(r"[^a-z0-9]", "", card.holder_name.split()[0].lower())[:8]
    bank = re.sub(r"[^a-z0-9]", "", card.bank.lower())[:6]
    return f"{first_name}-{bank}-{card.id}"


def _enrich_card(db: Session, card: CreditCard) -> CardResponse:
    result = CardResponse.model_validate(card)
    if card.inbox_id:
        inbox = db.query(Inbox).filter(Inbox.id == card.inbox_id).first()
        if inbox:
            result.inbox_email = inbox.email_address
    return result


@router.post("/", response_model=CardResponse)
async def create_card(card: CardCreate, db: Session = Depends(get_db)):
    db_card = CreditCard(**card.model_dump())
    db.add(db_card)
    db.commit()
    db.refresh(db_card)

    # Auto-create email inbox if not explicitly provided
    if not db_card.inbox_id:
        username = _make_inbox_username(db_card)
        inbox = await create_agentmail_inbox(db, username)
        db_card.inbox_id = inbox.id
        db.commit()
        db.refresh(db_card)

    return _enrich_card(db, db_card)


@router.get("/", response_model=list[CardResponse])
def list_cards(db: Session = Depends(get_db)):
    cards = db.query(CreditCard).all()
    return [_enrich_card(db, c) for c in cards]


@router.get("/{card_id}", response_model=CardResponse)
def get_card(card_id: int, db: Session = Depends(get_db)):
    card = db.query(CreditCard).filter(CreditCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return _enrich_card(db, card)


@router.post("/{card_id}/inbox", response_model=CardResponse)
async def create_card_inbox(card_id: int, db: Session = Depends(get_db)):
    """Create or retrieve the email inbox for an existing card."""
    card = db.query(CreditCard).filter(CreditCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    if not card.inbox_id:
        username = _make_inbox_username(card)
        inbox = await create_agentmail_inbox(db, username)
        card.inbox_id = inbox.id
        db.commit()
        db.refresh(card)

    return _enrich_card(db, card)


@router.put("/{card_id}", response_model=CardResponse)
def update_card(card_id: int, update: CardUpdate, db: Session = Depends(get_db)):
    card = db.query(CreditCard).filter(CreditCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(card, key, value)
    db.commit()
    db.refresh(card)
    return _enrich_card(db, card)


@router.delete("/{card_id}")
def delete_card(card_id: int, db: Session = Depends(get_db)):
    card = db.query(CreditCard).filter(CreditCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    db.delete(card)
    db.commit()
    return {"ok": True}
