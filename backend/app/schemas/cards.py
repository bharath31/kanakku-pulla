from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class CardCreate(BaseModel):
    bank: str
    card_name: str | None = None
    last_four: str | None = None
    holder_name: str
    dob: date | None = None
    credit_limit: Decimal | None = None
    inbox_id: int | None = None


class CardUpdate(BaseModel):
    bank: str | None = None
    card_name: str | None = None
    last_four: str | None = None
    holder_name: str | None = None
    dob: date | None = None
    credit_limit: Decimal | None = None


class CardResponse(BaseModel):
    id: int
    bank: str
    card_name: str | None
    last_four: str | None
    holder_name: str
    dob: date | None
    credit_limit: Decimal | None
    inbox_id: int | None = None
    inbox_email: str | None = None

    model_config = {"from_attributes": True}
