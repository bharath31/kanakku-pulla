from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, func

from app.database import Base


class RewardPoints(Base):
    __tablename__ = "reward_points"

    id = Column(Integer, primary_key=True)
    card_id = Column(Integer, ForeignKey("credit_cards.id"), nullable=False)
    points_earned = Column(Numeric(12, 2), default=0)
    points_redeemed = Column(Numeric(12, 2), default=0)
    total_points = Column(Numeric(12, 2), default=0)
    as_of_date = Column(Date)
    created_at = Column(DateTime, server_default=func.now())
