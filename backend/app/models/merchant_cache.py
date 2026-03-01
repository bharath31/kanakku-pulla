from sqlalchemy import Column, DateTime, Integer, String, func

from app.database import Base


class MerchantCache(Base):
    __tablename__ = "merchant_cache"

    id = Column(Integer, primary_key=True)
    merchant_name = Column(String, unique=True, nullable=False, index=True)
    category_name = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
