from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func

from app.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)
    statement_id = Column(Integer, ForeignKey("statements.id"), nullable=True)
    alert_type = Column(String, nullable=False)  # duplicate_charge, hidden_fee, unusual_amount, ai_suspicious
    severity = Column(String, default="info")  # info, warning, critical
    title = Column(String, nullable=False)
    description = Column(String)
    is_read = Column(Boolean, default=False)
    is_dismissed = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
