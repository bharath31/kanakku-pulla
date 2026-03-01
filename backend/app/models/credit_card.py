from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String, func

from app.database import Base


class CreditCard(Base):
    __tablename__ = "credit_cards"

    id = Column(Integer, primary_key=True)
    inbox_id = Column(Integer, ForeignKey("inboxes.id"), nullable=True)
    bank = Column(String, nullable=False)
    card_name = Column(String)
    last_four = Column(String(4))
    holder_name = Column(String, nullable=False)
    dob = Column(Date)  # Used for PDF password generation
    credit_limit = Column(Numeric(12, 2))
    created_at = Column(DateTime, server_default=func.now())
