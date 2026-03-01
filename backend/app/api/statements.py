import hashlib

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.credit_card import CreditCard
from app.models.user import User
from app.models.statement import Statement
from app.models.transaction import Transaction
from app.parsers.registry import auto_detect_and_parse, get_parser
from app.schemas.statements import StatementResponse
from app.services.ai_analyzer import categorize_transactions
from app.services.alert_engine import run_alerts_for_statement

router = APIRouter()


@router.post("/upload", response_model=StatementResponse)
async def upload_statement(
    file: UploadFile,
    card_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    card = db.query(CreditCard).filter(CreditCard.id == card_id, CreditCard.user_id == current_user.id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    pdf_bytes = await file.read()

    # Dedup check
    file_hash = hashlib.sha256(pdf_bytes).hexdigest()
    existing = db.query(Statement).filter(Statement.pdf_file_hash == file_hash).first()
    if existing:
        raise HTTPException(status_code=409, detail="Statement already uploaded")

    # Try bank-specific parser first, then auto-detect
    password = None
    parser = get_parser(card.bank.lower())
    if parser and card.holder_name and card.dob:
        password = parser.generate_pdf_password(card.holder_name, card.dob)

    parsed = None
    bank_id = card.bank.lower()

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
        # Save statement as failed
        stmt = Statement(
            card_id=card_id,
            pdf_file_hash=file_hash,
            parse_status="failed",
            source="upload",
        )
        db.add(stmt)
        db.commit()
        db.refresh(stmt)
        raise HTTPException(status_code=422, detail="Could not parse statement")

    # Save statement
    stmt = Statement(
        card_id=card_id,
        statement_date=parsed.statement_date,
        due_date=parsed.due_date,
        total_due=parsed.total_due,
        min_due=parsed.min_due,
        pdf_file_hash=file_hash,
        parse_status="parsed",
        source="upload",
    )
    db.add(stmt)
    db.flush()

    # Save transactions
    for txn in parsed.transactions:
        db_txn = Transaction(
            statement_id=stmt.id,
            card_id=card_id,
            txn_date=txn.txn_date,
            description=txn.description,
            merchant_name=txn.merchant_name,
            amount=txn.amount,
            currency=txn.currency,
            is_fee=txn.is_fee,
            fee_type=txn.fee_type,
            is_emi=txn.is_emi,
            is_international=txn.is_international,
        )
        db.add(db_txn)

    db.commit()
    db.refresh(stmt)

    # Run alert engine and AI categorization
    run_alerts_for_statement(db, stmt.id)
    txn_ids = [t.id for t in db.query(Transaction).filter(Transaction.statement_id == stmt.id).all()]
    await categorize_transactions(db, txn_ids)

    return stmt


@router.get("/", response_model=list[StatementResponse])
def list_statements(
    card_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_card_ids = [c.id for c in db.query(CreditCard).filter(CreditCard.user_id == current_user.id).all()]
    query = db.query(Statement).filter(Statement.card_id.in_(user_card_ids))
    if card_id:
        query = query.filter(Statement.card_id == card_id)
    return query.order_by(Statement.created_at.desc()).all()


@router.get("/{statement_id}", response_model=StatementResponse)
def get_statement(
    statement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_card_ids = [c.id for c in db.query(CreditCard).filter(CreditCard.user_id == current_user.id).all()]
    stmt = db.query(Statement).filter(Statement.id == statement_id, Statement.card_id.in_(user_card_ids)).first()
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")
    return stmt
