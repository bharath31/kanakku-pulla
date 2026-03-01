import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from io import BytesIO

import pdfplumber

from app.parsers.base import BaseBankParser, ParsedStatement, ParsedTransaction
from app.parsers.registry import register_parser

# Fee patterns for HDFC credit card statements
FEE_PATTERNS = {
    "annual_fee": re.compile(r"(annual|membership)\s*(fee|charge)", re.IGNORECASE),
    "gst": re.compile(r"(gst|goods\s*&?\s*service\s*tax|cgst|sgst|igst)", re.IGNORECASE),
    "finance_charge": re.compile(r"(finance|interest)\s*charge", re.IGNORECASE),
    "late_fee": re.compile(r"late\s*(payment)?\s*(fee|charge)", re.IGNORECASE),
    "overlimit": re.compile(r"over\s*limit\s*(fee|charge)", re.IGNORECASE),
    "forex": re.compile(r"(forex|foreign\s*currency|cross\s*currency)\s*(markup|charge|fee)", re.IGNORECASE),
    "fuel_surcharge": re.compile(r"fuel\s*surcharge", re.IGNORECASE),
    "emi_processing": re.compile(r"emi\s*(processing|conversion)\s*(fee|charge)", re.IGNORECASE),
}

# Date patterns commonly found in HDFC statements
DATE_PATTERN = re.compile(r"(\d{2}/\d{2}/\d{4})")


class HDFCParser(BaseBankParser):
    @property
    def bank_id(self) -> str:
        return "hdfc"

    @property
    def bank_name(self) -> str:
        return "HDFC Bank"

    def generate_pdf_password(self, holder_name: str, dob: date | None) -> str | None:
        if not dob or not holder_name:
            return None
        # HDFC pattern: first 4 chars of name (lowercase) + DDMM of DOB
        name_part = holder_name.replace(" ", "")[:4].lower()
        dob_part = dob.strftime("%d%m")
        return name_part + dob_part

    def parse(self, pdf_bytes: bytes, password: str | None = None) -> ParsedStatement:
        result = ParsedStatement()
        all_text_lines: list[str] = []

        with pdfplumber.open(BytesIO(pdf_bytes), password=password) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    all_text_lines.extend(text.split("\n"))

        if not all_text_lines:
            return result

        # Extract summary info
        self._parse_summary(all_text_lines, result)

        # Extract transactions
        result.transactions = self._parse_transactions(all_text_lines)

        return result

    def _parse_summary(self, lines: list[str], result: ParsedStatement):
        for line in lines:
            line_lower = line.lower()

            # Statement date
            if "statement date" in line_lower or "statement period" in line_lower:
                dates = DATE_PATTERN.findall(line)
                if dates:
                    result.statement_date = self._parse_date(dates[-1])

            # Due date
            if "due date" in line_lower or "payment due" in line_lower:
                dates = DATE_PATTERN.findall(line)
                if dates:
                    result.due_date = self._parse_date(dates[0])

            # Total due
            if "total" in line_lower and ("due" in line_lower or "amount" in line_lower):
                amount = self._extract_amount(line)
                if amount is not None:
                    result.total_due = amount

            # Minimum due
            if "minimum" in line_lower and ("due" in line_lower or "amount" in line_lower):
                amount = self._extract_amount(line)
                if amount is not None:
                    result.min_due = amount

            # Credit limit
            if "credit limit" in line_lower:
                amount = self._extract_amount(line)
                if amount is not None:
                    result.credit_limit = amount

            # Reward points
            if "reward" in line_lower and "point" in line_lower:
                amount = self._extract_amount(line)
                if amount is not None:
                    result.reward_points = amount

    def _parse_transactions(self, lines: list[str]) -> list[ParsedTransaction]:
        transactions = []
        in_txn_section = False

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Detect transaction section headers
            line_lower = line.lower()
            if "domestic" in line_lower and "transaction" in line_lower:
                in_txn_section = True
                continue
            if "international" in line_lower and "transaction" in line_lower:
                in_txn_section = True
                continue

            # Skip headers and footers
            if any(skip in line_lower for skip in ["page ", "statement", "opening balance", "closing balance", "total"]):
                if "total" in line_lower and in_txn_section:
                    in_txn_section = False
                continue

            if not in_txn_section:
                # Also try to parse lines that look like transactions anywhere
                pass

            # Try to parse as transaction line: DATE DESCRIPTION AMOUNT
            txn = self._try_parse_txn_line(line)
            if txn:
                transactions.append(txn)

        return transactions

    def _try_parse_txn_line(self, line: str) -> ParsedTransaction | None:
        # Pattern: DD/MM/YYYY description amount
        # Amount is usually the last number, possibly with Cr suffix for credits
        date_match = DATE_PATTERN.match(line)
        if not date_match:
            return None

        txn_date = self._parse_date(date_match.group(1))
        rest = line[date_match.end():].strip()

        if not rest:
            return None

        # Extract amount from end of line
        # Handles: 1,234.56 or 1234.56 or 1,234.56 Cr
        amount_pattern = re.compile(r"([\d,]+\.\d{2})\s*(Cr|Dr|CR|DR)?\s*$")
        amount_match = amount_pattern.search(rest)
        if not amount_match:
            return None

        amount_str = amount_match.group(1).replace(",", "")
        try:
            amount = Decimal(amount_str)
        except InvalidOperation:
            return None

        # Credits (payments/refunds) are negative
        if amount_match.group(2) and amount_match.group(2).upper() == "CR":
            amount = -amount

        description = rest[:amount_match.start()].strip()
        if not description:
            return None

        # Detect fees
        is_fee = False
        fee_type = None
        for ft, pattern in FEE_PATTERNS.items():
            if pattern.search(description):
                is_fee = True
                fee_type = ft
                break

        # Detect international
        is_international = bool(re.search(r"(USD|EUR|GBP|SGD|AED|JPY)", description, re.IGNORECASE))

        # Detect EMI
        is_emi = bool(re.search(r"\bEMI\b", description, re.IGNORECASE))

        return ParsedTransaction(
            txn_date=txn_date,
            description=description,
            amount=amount,
            merchant_name=self._extract_merchant(description),
            is_fee=is_fee,
            fee_type=fee_type,
            is_international=is_international,
            is_emi=is_emi,
        )

    def _extract_merchant(self, description: str) -> str:
        """Extract merchant name from transaction description."""
        # Remove common prefixes like POS, ECOM, UPI, etc.
        cleaned = re.sub(r"^(POS|ECOM|UPI|IMPS|NEFT|RTGS|ATM)\s+", "", description, flags=re.IGNORECASE)
        # Remove trailing reference numbers
        cleaned = re.sub(r"\s+\d{6,}$", "", cleaned)
        # Remove trailing location codes
        cleaned = re.sub(r"\s+(IN|IND|INDIA)\s*$", "", cleaned, flags=re.IGNORECASE)
        return cleaned.strip() or description

    def _parse_date(self, date_str: str) -> date | None:
        try:
            return datetime.strptime(date_str, "%d/%m/%Y").date()
        except ValueError:
            return None

    def _extract_amount(self, text: str) -> Decimal | None:
        amounts = re.findall(r"[\d,]+\.\d{2}", text)
        if amounts:
            try:
                return Decimal(amounts[-1].replace(",", ""))
            except InvalidOperation:
                return None
        return None


# Register on import
register_parser(HDFCParser())
