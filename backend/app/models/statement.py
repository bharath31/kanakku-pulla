from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String, func

from app.database import Base


class Statement(Base):
    __tablename__ = "statements"

    id = Column(Integer, primary_key=True)
    card_id = Column(Integer, ForeignKey("credit_cards.id"), nullable=False)
    statement_date = Column(Date)
    due_date = Column(Date)
    total_due = Column(Numeric(12, 2))
    min_due = Column(Numeric(12, 2))
    pdf_file_hash = Column(String(64), unique=True)  # SHA-256 for dedup
    parse_status = Column(String, default="pending")  # pending, parsing, parsed, failed
    source = Column(String, default="upload")  # upload, email
    created_at = Column(DateTime, server_default=func.now())
