from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.category import Category
from app.models.credit_card import CreditCard
from app.models.transaction import Transaction
from app.models.reward_points import RewardPoints
from app.models.user import User

router = APIRouter()


@router.get("/monthly")
def monthly_summary(
    card_id: int | None = None,
    month: int = Query(default=None),
    year: int = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    m = month or today.month
    y = year or today.year

    user_card_ids = [c.id for c in db.query(CreditCard).filter(CreditCard.user_id == current_user.id).all()]
    query = db.query(Transaction).filter(
        func.strftime("%m", Transaction.txn_date) == f"{m:02d}",
        func.strftime("%Y", Transaction.txn_date) == str(y),
        Transaction.card_id.in_(user_card_ids),
    )
    if card_id:
        query = query.filter(Transaction.card_id == card_id)

    txns = query.all()

    total_spend = sum(float(t.amount) for t in txns if t.amount > 0)
    total_fees = sum(float(t.amount) for t in txns if t.is_fee)
    txn_count = len([t for t in txns if not t.is_fee])

    # Category breakdown
    category_totals: dict[str, float] = {}
    for t in txns:
        if t.category_id and not t.is_fee:
            cat = db.query(Category).filter(Category.id == t.category_id).first()
            name = cat.name if cat else "Uncategorized"
        else:
            name = "Fees & Charges" if t.is_fee else "Uncategorized"
        category_totals[name] = category_totals.get(name, 0) + float(t.amount)

    # Daily spend
    daily: dict[str, float] = {}
    for t in txns:
        if t.txn_date and t.amount > 0:
            day = t.txn_date.isoformat()
            daily[day] = daily.get(day, 0) + float(t.amount)

    # Top merchants
    merchant_totals: dict[str, float] = {}
    for t in txns:
        if t.merchant_name and not t.is_fee:
            merchant_totals[t.merchant_name] = merchant_totals.get(t.merchant_name, 0) + float(t.amount)
    top_merchants = sorted(merchant_totals.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        "month": m,
        "year": y,
        "total_spend": total_spend,
        "total_fees": total_fees,
        "transaction_count": txn_count,
        "category_breakdown": [{"name": k, "amount": v} for k, v in sorted(category_totals.items(), key=lambda x: x[1], reverse=True)],
        "daily_spend": [{"date": k, "amount": v} for k, v in sorted(daily.items())],
        "top_merchants": [{"name": k, "amount": v} for k, v in top_merchants],
    }


@router.get("/trends")
def spending_trends(
    card_id: int | None = None,
    months: int = Query(default=6, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Category-wise spending trends over last N months."""
    today = date.today()
    results = []

    for i in range(months - 1, -1, -1):
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1

        user_card_ids = [c.id for c in db.query(CreditCard).filter(CreditCard.user_id == current_user.id).all()]
        query = db.query(Transaction).filter(
            func.strftime("%m", Transaction.txn_date) == f"{m:02d}",
            func.strftime("%Y", Transaction.txn_date) == str(y),
            Transaction.is_fee == False,  # noqa: E712
            Transaction.card_id.in_(user_card_ids),
        )
        if card_id:
            query = query.filter(Transaction.card_id == card_id)

        txns = query.all()
        month_data: dict[str, float] = {}
        for t in txns:
            if t.category_id:
                cat = db.query(Category).filter(Category.id == t.category_id).first()
                name = cat.name if cat else "Uncategorized"
            else:
                name = "Uncategorized"
            month_data[name] = month_data.get(name, 0) + float(t.amount)

        results.append({"month": f"{y}-{m:02d}", "categories": month_data})

    return results


@router.get("/fees")
def fee_breakdown(
    card_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_card_ids = [c.id for c in db.query(CreditCard).filter(CreditCard.user_id == current_user.id).all()]
    query = db.query(Transaction).filter(Transaction.is_fee == True, Transaction.card_id.in_(user_card_ids))  # noqa: E712
    if card_id:
        query = query.filter(Transaction.card_id == card_id)

    txns = query.all()
    by_type: dict[str, float] = {}
    for t in txns:
        fee_type = t.fee_type or "other"
        by_type[fee_type] = by_type.get(fee_type, 0) + float(t.amount)

    total = sum(by_type.values())
    return {
        "total_fees": total,
        "breakdown": [{"type": k, "amount": v} for k, v in sorted(by_type.items(), key=lambda x: x[1], reverse=True)],
    }


@router.get("/rewards")
def rewards_summary(
    card_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(RewardPoints)
    if card_id:
        query = query.filter(RewardPoints.card_id == card_id)

    points = query.order_by(RewardPoints.as_of_date.desc()).all()
    return [
        {
            "card_id": p.card_id,
            "points_earned": float(p.points_earned),
            "points_redeemed": float(p.points_redeemed),
            "total_points": float(p.total_points),
            "as_of_date": p.as_of_date.isoformat() if p.as_of_date else None,
        }
        for p in points
    ]
