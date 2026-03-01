from datetime import datetime

from pydantic import BaseModel


class AlertResponse(BaseModel):
    id: int
    transaction_id: int | None
    statement_id: int | None
    alert_type: str
    severity: str
    title: str
    description: str | None
    is_read: bool
    is_dismissed: bool
    created_at: datetime | None

    model_config = {"from_attributes": True}


class AlertSummary(BaseModel):
    total: int
    unread: int
    critical: int
    warning: int
