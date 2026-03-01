from sqlalchemy import Boolean, Column, DateTime, Integer, String, func

from app.database import Base


class Inbox(Base):
    __tablename__ = "inboxes"

    id = Column(Integer, primary_key=True)
    agentmail_inbox_id = Column(String, unique=True)
    email_address = Column(String, unique=True, nullable=False)
    webhook_secret = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
