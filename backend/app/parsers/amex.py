import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from io import BytesIO

import pdfplumber

from app.parsers.base import BaseBankParser, ParsedStatement, ParsedTransaction
from app.parsers.registry import register_parser

# Fee patterns for Amex credit card statements
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

# Amex supports both DD/MM/YYYY and DD MMM YYYY date formats
DATE_PATTERN_SLASH = re.compile(r"(\d{2}/\d{2}/\d{4})")
DATE_PATTERN_MONTH = re.compile(r"(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})", re.IGNORECASE)


class AmexParser(BaseBankParser):
    @property
    def bank_id(self) -> str:
        return "amex"

    @property
    def bank_name(self) -> str:
        return "American Express"

    def generate_pdf_password(self, holder_name: str, dob: date | None) -> str | None:
        if not dob or not holder_name:
            return None
        # Amex India pattern: first 4 chars of name (uppercase) + DDMMYYYY of DOB
        name_part = holder_name.replace(" ", "")[:4].upper()
        dob_part = dob.strftime("%d%m%Y")
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

        self._parse_summary(all_text_lines, result)
        result.transactions = self._parse_transactions(all_text_lines)

        return result

    def _parse_summary(self, lines: list[str], result: ParsedStatement):
        for line in lines:
            line_lower = line.lower()

            # Statement / closing date
            if any(k in line_lower for k in ("closing date", "statement date", "statement period")):
                d = self._extract_date(line)
                if d:
                    result.statement_date = d

            # Payment due date
            if "payment due" in line_lower or ("due date" in line_lower and "payment" in line_lower):
                d = self._extract_date(line)
                if d:
                    result.due_date = d

            # Total amount due / new charges
            if any(k in line_lower for k in ("total amount due", "total new charges", "new balance")):
                amount = self._extract_amount(line)
                if amount is not None:
                    result.total_due = amount

            # Minimum payment due
            if "minimum" in line_lower and ("due" in line_lower or "payment" in line_lower):
                amount = self._extract_amount(line)
                if amount is not None:
                    result.min_due = amount

            # Credit limit
            if "credit limit" in line_lower:
                amount = self._extract_amount(line)
                if amount is not None:
                    result.credit_limit = amount

            # Available credit / available limit
            if "available" in line_lower and ("credit" in line_lower or "limit" in line_lower):
                amount = self._extract_amount(line)
                if amount is not None:
                    result.available_limit = amount

            # Membership Rewards points
            if "membership reward" in line_lower and "point" in line_lower:
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

            line_lower = line.lower()

            # Amex transaction section headers
            if any(k in line_lower for k in ("charges and credits", "account activity", "transactions")):
                in_txn_section = True
                continue

            # End of transaction section
            if in_txn_section and any(k in line_lower for k in ("total charges", "total new charges", "total credits", "total fees")):
                in_txn_section = False
                continue

            # Skip non-transaction lines
            if any(k in line_lower for k in ("page ", "statement", "opening balance", "closing balance")):
                continue

            # Try to parse as a transaction line
            txn = self._try_parse_txn_line(line)
            if txn:
                transactions.append(txn)

        return transactions

    def _try_parse_txn_line(self, line: str) -> ParsedTransaction | None:
        # Try DD/MM/YYYY format first
        txn = self._try_parse_slash_date(line)
        if txn:
            return txn
        # Try DD MMM YYYY format
        return self._try_parse_month_date(line)

    def _try_parse_slash_date(self, line: str) -> ParsedTransaction | None:
        date_match = DATE_PATTERN_SLASH.match(line)
        if not date_match:
            return None

        txn_date = self._parse_date_slash(date_match.group(1))
        rest = line[date_match.end():].strip()
        return self._parse_rest(rest, txn_date)

    def _try_parse_month_date(self, line: str) -> ParsedTransaction | None:
        date_match = DATE_PATTERN_MONTH.match(line)
        if not date_match:
            return None

        txn_date = self._parse_date_month(date_match.group(1))
        rest = line[date_match.end():].strip()
        return self._parse_rest(rest, txn_date)

    def _parse_rest(self, rest: str, txn_date: date | None) -> ParsedTransaction | None:
        if not rest:
            return None

        # Amount at end: 1,234.56 or 1,234.56 Cr/Dr/CR/DR or (1,234.56) for credits
        amount_pattern = re.compile(r"\(?([\d,]+\.\d{2})\)?\s*(Cr|Dr|CR|DR)?\s*$")
        amount_match = amount_pattern.search(rest)
        if not amount_match:
            return None

        amount_str = amount_match.group(1).replace(",", "")
        try:
            amount = Decimal(amount_str)
        except InvalidOperation:
            return None

        # Credits (payments/refunds) are negative
        suffix = amount_match.group(2)
        full_match = amount_match.group(0)
        is_credit = (suffix and suffix.upper() == "CR") or full_match.strip().startswith("(")
        if is_credit:
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

        # Detect international transactions
        is_international = bool(re.search(r"(USD|EUR|GBP|SGD|AED|JPY|CHF|AUD|CAD)", description, re.IGNORECASE))

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
        """Extract merchant name from Amex transaction description."""
        # Remove common Amex prefixes
        cleaned = re.sub(
            r"^(POS|ECOM|UPI|IMPS|NEFT|RTGS|ATM|AMEX|AXP)\s+",
            "",
            description,
            flags=re.IGNORECASE,
        )
        # Remove trailing reference/approval codes (6+ digits)
        cleaned = re.sub(r"\s+\d{6,}$", "", cleaned)
        # Remove trailing country codes
        cleaned = re.sub(r"\s+(IN|IND|INDIA)\s*$", "", cleaned, flags=re.IGNORECASE)
        return cleaned.strip() or description

    def _extract_date(self, line: str) -> date | None:
        """Try extracting a date from a summary line."""
        m = DATE_PATTERN_SLASH.search(line)
        if m:
            return self._parse_date_slash(m.group(1))
        m = DATE_PATTERN_MONTH.search(line)
        if m:
            return self._parse_date_month(m.group(1))
        return None

    def _parse_date_slash(self, date_str: str) -> date | None:
        try:
            return datetime.strptime(date_str, "%d/%m/%Y").date()
        except ValueError:
            return None

    def _parse_date_month(self, date_str: str) -> date | None:
        date_str = re.sub(r"\s+", " ", date_str.strip())
        for fmt in ("%d %b %Y", "%d %B %Y"):
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
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
register_parser(AmexParser())
