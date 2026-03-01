from sqlalchemy import Column, DateTime, Integer, String, Text, func

from app.database import Base


class AIActivity(Base):
    __tablename__ = "ai_activities"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False, index=True)
    action_type = Column(String, nullable=False)  # categorized, fee_detected, alert_created, duplicate_found
    description = Column(String, nullable=False)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
