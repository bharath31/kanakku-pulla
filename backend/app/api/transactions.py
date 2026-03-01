from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.category import Category
from app.models.credit_card import CreditCard
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transactions import CategoryOverride, TransactionResponse
from app.services.ai_analyzer import categorize_transactions

router = APIRouter()


@router.get("/", response_model=list[TransactionResponse])
def list_transactions(
    card_id: int | None = None,
    statement_id: int | None = None,
    category_id: int | None = None,
    is_fee: bool | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    min_amount: float | None = None,
    max_amount: float | None = None,
    search: str | None = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_card_ids = [c.id for c in db.query(CreditCard).filter(CreditCard.user_id == current_user.id).all()]
    query = db.query(Transaction).filter(Transaction.card_id.in_(user_card_ids))

    if card_id:
        query = query.filter(Transaction.card_id == card_id)
    if statement_id:
        query = query.filter(Transaction.statement_id == statement_id)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if is_fee is not None:
        query = query.filter(Transaction.is_fee == is_fee)
    if date_from:
        query = query.filter(Transaction.txn_date >= date_from)
    if date_to:
        query = query.filter(Transaction.txn_date <= date_to)
    if min_amount is not None:
        query = query.filter(Transaction.amount >= min_amount)
    if max_amount is not None:
        query = query.filter(Transaction.amount <= max_amount)
    if search:
        query = query.filter(
            Transaction.description.ilike(f"%{search}%")
            | Transaction.merchant_name.ilike(f"%{search}%")
        )

    txns = query.order_by(Transaction.txn_date.desc()).offset(offset).limit(limit).all()

    # Enrich with category names
    results = []
    for txn in txns:
        data = TransactionResponse.model_validate(txn)
        if txn.category_id:
            cat = db.query(Category).filter(Category.id == txn.category_id).first()
            if cat:
                data.category_name = cat.name
        results.append(data)

    return results


@router.put("/{txn_id}/category", response_model=TransactionResponse)
def update_category(
    txn_id: int,
    override: CategoryOverride,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_card_ids = [c.id for c in db.query(CreditCard).filter(CreditCard.user_id == current_user.id).all()]
    txn = db.query(Transaction).filter(Transaction.id == txn_id, Transaction.card_id.in_(user_card_ids)).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    cat = db.query(Category).filter(Category.id == override.category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    txn.category_id = override.category_id
    db.commit()
    db.refresh(txn)

    data = TransactionResponse.model_validate(txn)
    data.category_name = cat.name
    return data


@router.post("/auto-categorize")
async def auto_categorize(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-categorize all uncategorized transactions for the current user."""
    user_card_ids = [c.id for c in db.query(CreditCard).filter(CreditCard.user_id == current_user.id).all()]
    uncategorized = (
        db.query(Transaction)
        .filter(
            Transaction.card_id.in_(user_card_ids),
            Transaction.category_id.is_(None),
            Transaction.is_fee == False,  # noqa: E712
        )
        .all()
    )

    if not uncategorized:
        return {"categorized": 0, "message": "No uncategorized transactions found"}

    txn_ids = [t.id for t in uncategorized]
    await categorize_transactions(db, txn_ids, user_id=current_user.id)

    # Count how many were categorized
    still_uncategorized = (
        db.query(Transaction)
        .filter(Transaction.id.in_(txn_ids), Transaction.category_id.is_(None))
        .count()
    )
    categorized = len(txn_ids) - still_uncategorized

    return {"categorized": categorized, "remaining": still_uncategorized}


@router.get("/categories")
def list_categories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Category).all()
