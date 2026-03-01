from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class TransactionResponse(BaseModel):
    id: int
    statement_id: int
    card_id: int
    txn_date: date | None
    description: str | None
    merchant_name: str | None
    amount: Decimal
    currency: str
    category_id: int | None
    category_name: str | None = None
    is_fee: bool
    fee_type: str | None
    is_emi: bool
    is_international: bool
    created_at: datetime | None

    model_config = {"from_attributes": True}


class CategoryOverride(BaseModel):
    category_id: int
