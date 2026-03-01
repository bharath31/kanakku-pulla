from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, func

from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True)
    statement_id = Column(Integer, ForeignKey("statements.id"), nullable=False)
    card_id = Column(Integer, ForeignKey("credit_cards.id"), nullable=False)
    txn_date = Column(Date)
    description = Column(String)
    merchant_name = Column(String)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), default="INR")
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    is_fee = Column(Boolean, default=False)
    fee_type = Column(String)  # annual_fee, gst, finance_charge, late_fee, overlimit, forex, fuel_surcharge, emi_processing
    is_emi = Column(Boolean, default=False)
    is_international = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
