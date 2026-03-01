"""Tests for the American Express credit card statement parser."""

import io
from datetime import date
from decimal import Decimal

import pytest

from app.parsers.amex import AmexParser
from app.parsers.registry import get_parser, list_parsers


@pytest.fixture
def parser():
    return AmexParser()


# ---------------------------------------------------------------------------
# Registration tests
# ---------------------------------------------------------------------------


def test_amex_registered_in_registry():
    p = get_parser("amex")
    assert p is not None
    assert isinstance(p, AmexParser)


def test_amex_in_list_parsers():
    ids = [p.bank_id for p in list_parsers()]
    assert "amex" in ids


# ---------------------------------------------------------------------------
# Basic property tests
# ---------------------------------------------------------------------------


def test_bank_id(parser):
    assert parser.bank_id == "amex"


def test_bank_name(parser):
    assert parser.bank_name == "American Express"


# ---------------------------------------------------------------------------
# PDF password generation
# ---------------------------------------------------------------------------


def test_generate_pdf_password_standard(parser):
    dob = date(1990, 3, 15)
    password = parser.generate_pdf_password("Rahul Sharma", dob)
    # First 4 chars of "RahulSharma" uppercase = "RAHU", DOB = 15031990
    assert password == "RAHU15031990"


def test_generate_pdf_password_short_name(parser):
    dob = date(1985, 11, 5)
    password = parser.generate_pdf_password("Ali", dob)
    # "ALI" is only 3 chars, pad as-is
    assert password == "ALI05111985"


def test_generate_pdf_password_no_dob(parser):
    assert parser.generate_pdf_password("Rahul Sharma", None) is None


def test_generate_pdf_password_no_name(parser):
    assert parser.generate_pdf_password("", date(1990, 1, 1)) is None


# ---------------------------------------------------------------------------
# Date parsing helpers (via _extract_date indirectly)
# ---------------------------------------------------------------------------


def test_parse_date_slash(parser):
    d = parser._parse_date_slash("15/03/2024")
    assert d == date(2024, 3, 15)


def test_parse_date_slash_invalid(parser):
    assert parser._parse_date_slash("99/99/9999") is None


def test_parse_date_month_short(parser):
    d = parser._parse_date_month("01 Jan 2024")
    assert d == date(2024, 1, 1)


def test_parse_date_month_full(parser):
    d = parser._parse_date_month("15 March 2024")
    assert d == date(2024, 3, 15)


def test_parse_date_month_invalid(parser):
    assert parser._parse_date_month("NotADate") is None


# ---------------------------------------------------------------------------
# Amount extraction helper
# ---------------------------------------------------------------------------


def test_extract_amount_simple(parser):
    assert parser._extract_amount("Total Amount Due 5,432.10") == Decimal("5432.10")


def test_extract_amount_no_amount(parser):
    assert parser._extract_amount("No numbers here") is None


# ---------------------------------------------------------------------------
# Merchant extraction
# ---------------------------------------------------------------------------


def test_extract_merchant_removes_pos_prefix(parser):
    # POS prefix stripped, trailing digits stripped, trailing INDIA stripped
    assert parser._extract_merchant("POS SWIGGY INDIA 123456789") == "SWIGGY"


def test_extract_merchant_removes_ecom_prefix(parser):
    assert parser._extract_merchant("ECOM AMAZON IN 987654321") == "AMAZON"


def test_extract_merchant_removes_amex_prefix(parser):
    assert parser._extract_merchant("AMEX HOTEL GRAND MUMBAI") == "HOTEL GRAND MUMBAI"


def test_extract_merchant_no_prefix(parser):
    assert parser._extract_merchant("ZOMATO MUMBAI") == "ZOMATO MUMBAI"


def test_extract_merchant_removes_trailing_digits(parser):
    assert parser._extract_merchant("NETFLIX 123456789") == "NETFLIX"


def test_extract_merchant_removes_india_suffix(parser):
    assert parser._extract_merchant("UBER INDIA") == "UBER"


# ---------------------------------------------------------------------------
# Transaction line parsing
# ---------------------------------------------------------------------------


def test_try_parse_txn_line_slash_date_debit(parser):
    line = "15/03/2024 SWIGGY MUMBAI 450.00"
    txn = parser._try_parse_txn_line(line)
    assert txn is not None
    assert txn.txn_date == date(2024, 3, 15)
    assert txn.description == "SWIGGY MUMBAI"
    assert txn.amount == Decimal("450.00")
    assert not txn.is_fee


def test_try_parse_txn_line_slash_date_credit(parser):
    line = "20/03/2024 PAYMENT RECEIVED 5,000.00 Cr"
    txn = parser._try_parse_txn_line(line)
    assert txn is not None
    assert txn.amount == Decimal("-5000.00")


def test_try_parse_txn_line_month_date(parser):
    line = "01 Jan 2024 AMAZON IN 1,234.56"
    txn = parser._try_parse_txn_line(line)
    assert txn is not None
    assert txn.txn_date == date(2024, 1, 1)
    assert txn.description == "AMAZON IN"
    assert txn.amount == Decimal("1234.56")


def test_try_parse_txn_line_parenthesized_credit(parser):
    line = "10/02/2024 REFUND ZOMATO (200.00)"
    txn = parser._try_parse_txn_line(line)
    assert txn is not None
    assert txn.amount == Decimal("-200.00")


def test_try_parse_txn_line_no_date(parser):
    assert parser._try_parse_txn_line("No date here 100.00") is None


def test_try_parse_txn_line_no_amount(parser):
    assert parser._try_parse_txn_line("15/03/2024 Description without amount") is None


# ---------------------------------------------------------------------------
# Fee detection
# ---------------------------------------------------------------------------


def test_detects_annual_fee(parser):
    line = "01/04/2024 Annual Membership Fee 4,999.00"
    txn = parser._try_parse_txn_line(line)
    assert txn is not None
    assert txn.is_fee
    assert txn.fee_type == "annual_fee"


def test_detects_gst(parser):
    # Use a description that only matches GST (no "annual"/"membership" keyword)
    line = "01/04/2024 GST Charge 899.82"
    txn = parser._try_parse_txn_line(line)
    assert txn is not None
    assert txn.is_fee
    assert txn.fee_type == "gst"


def test_detects_late_fee(parser):
    line = "05/04/2024 Late Payment Charge 1,300.00"
    txn = parser._try_parse_txn_line(line)
    assert txn is not None
    assert txn.is_fee
    assert txn.fee_type == "late_fee"


def test_detects_finance_charge(parser):
    line = "05/04/2024 Finance Charge 750.00"
    txn = parser._try_parse_txn_line(line)
    assert txn is not None
    assert txn.is_fee
    assert txn.fee_type == "finance_charge"


def test_detects_forex(parser):
    line = "10/03/2024 Foreign Currency Markup Fee 250.00"
    txn = parser._try_parse_txn_line(line)
    assert txn is not None
    assert txn.is_fee
    assert txn.fee_type == "forex"


def test_detects_fuel_surcharge(parser):
    line = "12/03/2024 Fuel Surcharge 45.00"
    txn = parser._try_parse_txn_line(line)
    assert txn is not None
    assert txn.is_fee
    assert txn.fee_type == "fuel_surcharge"


# ---------------------------------------------------------------------------
# International detection
# ---------------------------------------------------------------------------


def test_detects_international_usd(parser):
    line = "15/03/2024 NETFLIX USA USD 649.00"
    txn = parser._try_parse_txn_line(line)
    assert txn is not None
    assert txn.is_international


def test_domestic_not_international(parser):
    line = "15/03/2024 SWIGGY MUMBAI 350.00"
    txn = parser._try_parse_txn_line(line)
    assert txn is not None
    assert not txn.is_international


# ---------------------------------------------------------------------------
# EMI detection
# ---------------------------------------------------------------------------


def test_detects_emi(parser):
    line = "01/03/2024 EMI FOR MACBOOK PRO 5,416.67"
    txn = parser._try_parse_txn_line(line)
    assert txn is not None
    assert txn.is_emi


def test_non_emi(parser):
    line = "01/03/2024 APPLE STORE 99,900.00"
    txn = parser._try_parse_txn_line(line)
    assert txn is not None
    assert not txn.is_emi


# ---------------------------------------------------------------------------
# Full parse with synthetic PDF-like text
# ---------------------------------------------------------------------------


def _make_fake_pdf(text: str) -> bytes:
    """Create a minimal valid PDF with the given text for testing."""
    # Build a simple single-page PDF that pdfplumber can read
    content_stream = f"BT /F1 12 Tf 50 700 Td ({text}) Tj ET"
    # We create a simple PDF structure
    objects = []

    # Object 1: Catalog
    objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    # Object 2: Pages
    objects.append(b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")
    # Object 3: Page
    objects.append(
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]"
        b" /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
    )
    # Object 4: Content stream
    stream_bytes = content_stream.encode("latin-1")
    objects.append(
        f"4 0 obj\n<< /Length {len(stream_bytes)} >>\nstream\n".encode()
        + stream_bytes
        + b"\nendstream\nendobj\n"
    )
    # Object 5: Font
    objects.append(
        b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
    )

    header = b"%PDF-1.4\n"
    body = b"".join(objects)
    xref_offset = len(header) + len(body)

    offsets = []
    pos = len(header)
    for obj in objects:
        offsets.append(pos)
        pos += len(obj)

    xref = b"xref\n"
    xref += f"0 {len(objects) + 1}\n".encode()
    xref += b"0000000000 65535 f \n"
    for off in offsets:
        xref += f"{off:010d} 00000 n \n".encode()

    trailer = f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode()

    return header + body + xref + trailer


def test_parse_returns_empty_on_blank_pdf(parser):
    """Parser should return empty ParsedStatement when PDF has no text."""
    # Use a minimal PDF that produces no extractable text
    empty_pdf = _make_fake_pdf("")
    result = parser.parse(empty_pdf)
    assert result.transactions == []


def test_parse_summary_statement_date(parser):
    lines = [
        "Closing Date: 31/03/2024",
        "Payment Due Date: 20/04/2024",
        "Total Amount Due INR 12,345.67",
        "Minimum Payment Due INR 500.00",
        "Credit Limit INR 3,00,000.00",
        "Available Credit INR 2,87,654.33",
        "Membership Rewards Points Balance 15000.00",
    ]
    from app.parsers.base import ParsedStatement

    result = ParsedStatement()
    parser._parse_summary(lines, result)

    assert result.statement_date == date(2024, 3, 31)
    assert result.due_date == date(2024, 4, 20)
    assert result.total_due == Decimal("12345.67")
    assert result.min_due == Decimal("500.00")
    assert result.credit_limit == Decimal("300000.00")
    assert result.available_limit == Decimal("287654.33")
    assert result.reward_points == Decimal("15000.00")


def test_parse_transactions_slash_dates(parser):
    lines = [
        "Charges and Credits",
        "15/03/2024 SWIGGY MUMBAI 350.00",
        "16/03/2024 AMAZON IN 1,299.00",
        "17/03/2024 PAYMENT RECEIVED 5,000.00 Cr",
        "18/03/2024 Annual Membership Fee 4,999.00",
        "Total Charges",
    ]
    txns = parser._parse_transactions(lines)
    assert len(txns) == 4

    assert txns[0].description == "SWIGGY MUMBAI"
    assert txns[0].amount == Decimal("350.00")

    assert txns[1].description == "AMAZON IN"
    assert txns[1].amount == Decimal("1299.00")

    assert txns[2].amount == Decimal("-5000.00")

    assert txns[3].is_fee
    assert txns[3].fee_type == "annual_fee"


def test_parse_transactions_month_dates(parser):
    lines = [
        "Account Activity",
        "01 Jan 2024 STARBUCKS COFFEE 320.00",
        "05 Jan 2024 NETFLIX USD 649.00",
    ]
    txns = parser._parse_transactions(lines)
    assert len(txns) == 2
    assert txns[0].txn_date == date(2024, 1, 1)
    assert txns[1].is_international


def test_can_parse_returns_false_on_empty(parser):
    empty_pdf = _make_fake_pdf("")
    assert not parser.can_parse(empty_pdf)
