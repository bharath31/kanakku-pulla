from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class StatementResponse(BaseModel):
    id: int
    card_id: int
    statement_date: date | None
    due_date: date | None
    total_due: Decimal | None
    min_due: Decimal | None
    parse_status: str
    source: str
    created_at: datetime | None

    model_config = {"from_attributes": True}
