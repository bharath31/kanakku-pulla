from sqlalchemy import Column, ForeignKey, Integer, String

from app.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)
    icon = Column(String)
    color = Column(String)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
