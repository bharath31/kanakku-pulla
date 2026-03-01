import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from io import BytesIO

import pdfplumber

from app.parsers.base import BaseBankParser, ParsedStatement, ParsedTransaction
from app.parsers.hdfc import FEE_PATTERNS
from app.parsers.registry import register_parser

DATE_PATTERN = re.compile(r"(\d{2}/\d{2}/\d{4})")


class ICICIParser(BaseBankParser):
    @property
    def bank_id(self) -> str:
        return "icici"

    @property
    def bank_name(self) -> str:
        return "ICICI Bank"

    def generate_pdf_password(self, holder_name: str, dob: date | None) -> str | None:
        if not dob or not holder_name:
            return None
        name_part = holder_name.replace(" ", "")[:4].lower()
        dob_part = dob.strftime("%d%m")
        return name_part + dob_part

    def parse(self, pdf_bytes: bytes, password: str | None = None) -> ParsedStatement:
        result = ParsedStatement()
        all_lines: list[str] = []

        with pdfplumber.open(BytesIO(pdf_bytes), password=password) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    all_lines.extend(text.split("\n"))

        if not all_lines:
            return result

        self._parse_summary(all_lines, result)
        result.transactions = self._parse_transactions(all_lines)
        return result

    def _parse_summary(self, lines: list[str], result: ParsedStatement):
        for line in lines:
            ll = line.lower()
            if "statement date" in ll:
                dates = DATE_PATTERN.findall(line)
                if dates:
                    result.statement_date = self._parse_date(dates[-1])
            if "payment due date" in ll or "due date" in ll:
                dates = DATE_PATTERN.findall(line)
                if dates:
                    result.due_date = self._parse_date(dates[0])
            if "total amount due" in ll or "total due" in ll:
                amt = self._extract_amount(line)
                if amt:
                    result.total_due = amt
            if "minimum amount due" in ll:
                amt = self._extract_amount(line)
                if amt:
                    result.min_due = amt

    def _parse_transactions(self, lines: list[str]) -> list[ParsedTransaction]:
        transactions = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            txn = self._try_parse_txn_line(line)
            if txn:
                transactions.append(txn)
        return transactions

    def _try_parse_txn_line(self, line: str) -> ParsedTransaction | None:
        date_match = DATE_PATTERN.match(line)
        if not date_match:
            return None

        txn_date = self._parse_date(date_match.group(1))
        rest = line[date_match.end():].strip()
        if not rest:
            return None

        amount_pattern = re.compile(r"([\d,]+\.\d{2})\s*(Cr|Dr|CR|DR)?\s*$")
        amount_match = amount_pattern.search(rest)
        if not amount_match:
            return None

        try:
            amount = Decimal(amount_match.group(1).replace(",", ""))
        except InvalidOperation:
            return None

        if amount_match.group(2) and amount_match.group(2).upper() == "CR":
            amount = -amount

        description = rest[:amount_match.start()].strip()
        if not description:
            return None

        is_fee = False
        fee_type = None
        for ft, pattern in FEE_PATTERNS.items():
            if pattern.search(description):
                is_fee = True
                fee_type = ft
                break

        is_international = bool(re.search(r"(USD|EUR|GBP|SGD|AED)", description, re.IGNORECASE))
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
        cleaned = re.sub(r"^(POS|ECOM|UPI|IMPS|NEFT)\s+", "", description, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s+\d{6,}$", "", cleaned)
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


register_parser(ICICIParser())
