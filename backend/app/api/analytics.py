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

# Categories that represent payments/credits, not actual spending
EXCLUDED_CATEGORIES = {"Transfers", "Fees & Charges"}


def _get_user_card_ids(db: Session, user_id: int) -> list[int]:
    return [c.id for c in db.query(CreditCard).filter(CreditCard.user_id == user_id).all()]


def _get_category_map(db: Session) -> dict[int, str]:
    return {c.id: c.name for c in db.query(Category).all()}


@router.get("/monthly")
def monthly_summary(
    card_id: int | None = None,
    month: int = Query(default=None),
    year: int = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_card_ids = _get_user_card_ids(db, current_user.id)

    # If no month/year specified, find the most recent month with data
    if month is None and year is None:
        latest = (
            db.query(
                func.strftime("%Y", Transaction.txn_date).label("y"),
                func.strftime("%m", Transaction.txn_date).label("m"),
            )
            .filter(Transaction.card_id.in_(user_card_ids), Transaction.txn_date.isnot(None))
            .order_by(func.strftime("%Y-%m", Transaction.txn_date).desc())
            .first()
        )
        if latest and latest.y and latest.m:
            y = int(latest.y)
            m = int(latest.m)
        else:
            today = date.today()
            m = today.month
            y = today.year
    else:
        today = date.today()
        m = month or today.month
        y = year or today.year

    query = db.query(Transaction).filter(
        func.strftime("%m", Transaction.txn_date) == f"{m:02d}",
        func.strftime("%Y", Transaction.txn_date) == str(y),
        Transaction.card_id.in_(user_card_ids),
    )
    if card_id:
        query = query.filter(Transaction.card_id == card_id)

    txns = query.all()
    cat_map = _get_category_map(db)

    # Exclude credits (amount <= 0) and transfers from spend totals
    total_spend = sum(
        float(t.amount) for t in txns
        if t.amount > 0 and not t.is_fee and cat_map.get(t.category_id, "") not in EXCLUDED_CATEGORIES
    )
    total_fees = sum(float(t.amount) for t in txns if t.is_fee)
    txn_count = len([
        t for t in txns
        if not t.is_fee and t.amount > 0 and cat_map.get(t.category_id, "") not in EXCLUDED_CATEGORIES
    ])

    # Category breakdown — only actual spending (positive, non-transfer, non-fee)
    category_totals: dict[str, float] = {}
    for t in txns:
        if t.amount <= 0:
            continue  # Skip credits/payments
        if t.is_fee:
            category_totals["Fees & Charges"] = category_totals.get("Fees & Charges", 0) + float(t.amount)
            continue
        cat_name = cat_map.get(t.category_id, "Uncategorized") if t.category_id else "Uncategorized"
        if cat_name == "Transfers":
            continue  # Skip payments from category chart
        category_totals[cat_name] = category_totals.get(cat_name, 0) + float(t.amount)

    # Top merchants — only actual spend
    merchant_totals: dict[str, float] = {}
    for t in txns:
        if t.merchant_name and not t.is_fee and t.amount > 0:
            cat_name = cat_map.get(t.category_id, "") if t.category_id else ""
            if cat_name == "Transfers":
                continue
            merchant_totals[t.merchant_name] = merchant_totals.get(t.merchant_name, 0) + float(t.amount)
    top_merchants = sorted(merchant_totals.items(), key=lambda x: x[1], reverse=True)[:10]

    # Monthly spend trend (last 6 months ending at the viewed month)
    monthly_spend: list[dict] = []
    for i in range(5, -1, -1):
        tm = m - i
        ty = y
        while tm <= 0:
            tm += 12
            ty -= 1
        month_txns = db.query(Transaction).filter(
            func.strftime("%m", Transaction.txn_date) == f"{tm:02d}",
            func.strftime("%Y", Transaction.txn_date) == str(ty),
            Transaction.card_id.in_(user_card_ids),
            Transaction.is_fee == False,  # noqa: E712
        )
        if card_id:
            month_txns = month_txns.filter(Transaction.card_id == card_id)
        month_total = sum(
            float(t.amount) for t in month_txns.all()
            if t.amount > 0 and cat_map.get(t.category_id, "") not in EXCLUDED_CATEGORIES
        )
        month_label = f"{ty}-{tm:02d}"
        monthly_spend.append({"month": month_label, "amount": month_total})

    return {
        "month": m,
        "year": y,
        "total_spend": total_spend,
        "total_fees": total_fees,
        "transaction_count": txn_count,
        "category_breakdown": [{"name": k, "amount": v} for k, v in sorted(category_totals.items(), key=lambda x: x[1], reverse=True)],
        "monthly_spend": monthly_spend,
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
    user_card_ids = _get_user_card_ids(db, current_user.id)
    cat_map = _get_category_map(db)
    results = []

    for i in range(months - 1, -1, -1):
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1

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
            if t.amount <= 0:
                continue
            cat_name = cat_map.get(t.category_id, "Uncategorized") if t.category_id else "Uncategorized"
            if cat_name in EXCLUDED_CATEGORIES:
                continue
            month_data[cat_name] = month_data.get(cat_name, 0) + float(t.amount)

        results.append({"month": f"{y}-{m:02d}", "categories": month_data})

    return results


@router.get("/fees")
def fee_breakdown(
    card_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_card_ids = _get_user_card_ids(db, current_user.id)
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
    user_card_ids = _get_user_card_ids(db, current_user.id)
    query = db.query(RewardPoints).filter(RewardPoints.card_id.in_(user_card_ids))
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
