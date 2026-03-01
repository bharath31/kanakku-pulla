from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal


@dataclass
class ParsedTransaction:
    txn_date: date | None
    description: str
    amount: Decimal
    merchant_name: str | None = None
    currency: str = "INR"
    is_international: bool = False
    is_fee: bool = False
    fee_type: str | None = None
    is_emi: bool = False


@dataclass
class ParsedStatement:
    statement_date: date | None = None
    due_date: date | None = None
    total_due: Decimal | None = None
    min_due: Decimal | None = None
    credit_limit: Decimal | None = None
    available_limit: Decimal | None = None
    reward_points: Decimal | None = None
    transactions: list[ParsedTransaction] = field(default_factory=list)


class BaseBankParser(ABC):
    @property
    @abstractmethod
    def bank_id(self) -> str:
        """Unique bank identifier, e.g. 'hdfc', 'icici'"""

    @property
    @abstractmethod
    def bank_name(self) -> str:
        """Human-readable bank name"""

    @abstractmethod
    def generate_pdf_password(self, holder_name: str, dob: date | None) -> str | None:
        """Generate PDF password from card holder info. Returns None if unknown."""

    @abstractmethod
    def parse(self, pdf_bytes: bytes, password: str | None = None) -> ParsedStatement:
        """Parse a credit card statement PDF and return structured data."""

    def can_parse(self, pdf_bytes: bytes, password: str | None = None) -> bool:
        """Try to detect if this parser can handle the given PDF."""
        try:
            result = self.parse(pdf_bytes, password)
            return len(result.transactions) > 0
        except Exception:
            return False
