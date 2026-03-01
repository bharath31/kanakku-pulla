import hashlib

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.credit_card import CreditCard
from app.models.inbox import Inbox
from app.models.statement import Statement
from app.models.transaction import Transaction
from app.parsers.registry import auto_detect_and_parse, get_parser
from app.services.alert_engine import run_alerts_for_statement

router = APIRouter()

# Known bank sender patterns
BANK_SENDERS = {
    "hdfcbank.net": "hdfc",
    "icicibank.com": "icici",
    "sbi.co.in": "sbi",
    "axisbank.com": "axis",
    "kotak.com": "kotak",
}


@router.post("/agentmail")
async def agentmail_webhook(request: Request, db: Session = Depends(get_db)):
    """Receive incoming emails from AgentMail webhooks."""
    body = await request.json()

    to_address = body.get("to", "")
    from_address = body.get("from", "")
    attachments = body.get("attachments", [])

    # Find inbox
    inbox = db.query(Inbox).filter(Inbox.email_address == to_address).first()
    if not inbox:
        return {"status": "ignored", "reason": "unknown inbox"}

    # Find associated card
    card = db.query(CreditCard).filter(CreditCard.inbox_id == inbox.id).first()
    if not card:
        return {"status": "ignored", "reason": "no card configured for inbox"}

    # Detect bank from sender
    detected_bank = None
    for domain, bank_id in BANK_SENDERS.items():
        if domain in from_address.lower():
            detected_bank = bank_id
            break

    processed = 0
    for attachment in attachments:
        if not attachment.get("filename", "").lower().endswith(".pdf"):
            continue

        # Attachment content should be base64-encoded
        import base64
        pdf_bytes = base64.b64decode(attachment.get("content", ""))

        if not pdf_bytes:
            continue

        # Dedup
        file_hash = hashlib.sha256(pdf_bytes).hexdigest()
        if db.query(Statement).filter(Statement.pdf_file_hash == file_hash).first():
            continue

        # Generate password
        password = None
        bank_id = detected_bank or card.bank.lower()
        parser = get_parser(bank_id)
        if parser and card.holder_name and card.dob:
            password = parser.generate_pdf_password(card.holder_name, card.dob)

        # Parse
        parsed = None
        if parser:
            try:
                parsed = parser.parse(pdf_bytes, password)
            except Exception:
                pass

        if not parsed or len(parsed.transactions) == 0:
            result = auto_detect_and_parse(pdf_bytes, password)
            if result:
                bank_id, parsed = result

        if not parsed or len(parsed.transactions) == 0:
            stmt = Statement(card_id=card.id, pdf_file_hash=file_hash, parse_status="failed", source="email")
            db.add(stmt)
            db.commit()
            continue

        # Save
        stmt = Statement(
            card_id=card.id,
            statement_date=parsed.statement_date,
            due_date=parsed.due_date,
            total_due=parsed.total_due,
            min_due=parsed.min_due,
            pdf_file_hash=file_hash,
            parse_status="parsed",
            source="email",
        )
        db.add(stmt)
        db.flush()

        for txn in parsed.transactions:
            db.add(Transaction(
                statement_id=stmt.id,
                card_id=card.id,
                txn_date=txn.txn_date,
                description=txn.description,
                merchant_name=txn.merchant_name,
                amount=txn.amount,
                currency=txn.currency,
                is_fee=txn.is_fee,
                fee_type=txn.fee_type,
                is_emi=txn.is_emi,
                is_international=txn.is_international,
            ))

        db.commit()
        run_alerts_for_statement(db, stmt.id)
        processed += 1

    return {"status": "ok", "statements_processed": processed}
