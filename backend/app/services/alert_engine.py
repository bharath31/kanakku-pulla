import re
from datetime import timedelta

from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.credit_card import CreditCard
from app.models.statement import Statement
from app.models.transaction import Transaction
from app.services.ai_activity_logger import log_ai_activity

FEE_DESCRIPTIONS = {
    "annual_fee": (re.compile(r"(annual|membership)\s*(fee|charge)", re.IGNORECASE), "warning"),
    "gst": (re.compile(r"(gst|goods\s*&?\s*service\s*tax|cgst|sgst|igst)", re.IGNORECASE), "info"),
    "finance_charge": (re.compile(r"(finance|interest)\s*charge", re.IGNORECASE), "critical"),
    "late_fee": (re.compile(r"late\s*(payment)?\s*(fee|charge)", re.IGNORECASE), "critical"),
    "overlimit": (re.compile(r"over\s*limit\s*(fee|charge)", re.IGNORECASE), "warning"),
    "forex": (re.compile(r"(forex|foreign\s*currency|cross\s*currency)\s*(markup|charge|fee)", re.IGNORECASE), "info"),
    "fuel_surcharge": (re.compile(r"fuel\s*surcharge", re.IGNORECASE), "info"),
    "emi_processing": (re.compile(r"emi\s*(processing|conversion)\s*(fee|charge)", re.IGNORECASE), "info"),
}

FEE_TIPS = {
    "annual_fee": "You can often get this waived by calling your bank and requesting a waiver, especially if you have good spending history.",
    "finance_charge": "Pay your full statement balance before the due date to avoid finance charges entirely.",
    "late_fee": "Set up auto-pay for at least the minimum amount due to avoid late fees.",
    "overlimit": "Consider requesting a credit limit increase or setting up spend alerts.",
    "forex": "Consider using a forex-friendly card (like Niyo, Fi) for international transactions.",
    "fuel_surcharge": "Some cards offer fuel surcharge waivers — check your card benefits.",
}


def _get_user_id_for_statement(db: Session, statement_id: int) -> int | None:
    stmt = db.query(Statement).filter(Statement.id == statement_id).first()
    if not stmt:
        return None
    card = db.query(CreditCard).filter(CreditCard.id == stmt.card_id).first()
    return card.user_id if card else None


def run_alerts_for_statement(db: Session, statement_id: int):
    """Run all alert checks for a newly parsed statement."""
    txns = db.query(Transaction).filter(Transaction.statement_id == statement_id).all()

    fees_found = []
    duplicates_found = 0

    for txn in txns:
        # Fee detection
        fee = _check_fees(db, txn, statement_id)
        if fee:
            fees_found.append(fee)

        # Duplicate charge detection
        if _check_duplicates(db, txn, statement_id):
            duplicates_found += 1

    # Log AI activities
    user_id = _get_user_id_for_statement(db, statement_id)
    if user_id:
        if fees_found:
            total_fee_amount = sum(f["amount"] for f in fees_found)
            log_ai_activity(
                db, user_id, "fee_detected",
                f"Detected {len(fees_found)} fee{'s' if len(fees_found) != 1 else ''} totalling ₹{total_fee_amount:,.0f}",
                {"fees": fees_found},
            )
        if duplicates_found:
            log_ai_activity(
                db, user_id, "duplicate_found",
                f"Found {duplicates_found} possible duplicate charge{'s' if duplicates_found != 1 else ''}",
            )


def _check_fees(db: Session, txn: Transaction, statement_id: int) -> dict | None:
    if not txn.description:
        return None

    result = None
    for fee_type, (pattern, severity) in FEE_DESCRIPTIONS.items():
        if pattern.search(txn.description):
            tip = FEE_TIPS.get(fee_type, "")
            description = f"₹{txn.amount} — {txn.description}"
            if tip:
                description += f"\n\nTip: {tip}"

            alert = Alert(
                transaction_id=txn.id,
                statement_id=statement_id,
                alert_type="hidden_fee",
                severity=severity,
                title=f"{fee_type.replace('_', ' ').title()} detected",
                description=description,
            )
            db.add(alert)
            result = {"type": fee_type, "amount": float(txn.amount)}

    db.commit()
    return result


def _check_duplicates(db: Session, txn: Transaction, statement_id: int) -> bool:
    if not txn.txn_date or not txn.merchant_name:
        return False

    # Look for same merchant + same amount within 24 hours
    dupes = (
        db.query(Transaction)
        .filter(
            Transaction.id != txn.id,
            Transaction.merchant_name == txn.merchant_name,
            Transaction.amount == txn.amount,
            Transaction.txn_date >= txn.txn_date - timedelta(days=1),
            Transaction.txn_date <= txn.txn_date + timedelta(days=1),
        )
        .all()
    )

    if dupes:
        alert = Alert(
            transaction_id=txn.id,
            statement_id=statement_id,
            alert_type="duplicate_charge",
            severity="warning",
            title=f"Possible duplicate charge at {txn.merchant_name}",
            description=f"₹{txn.amount} charged {len(dupes) + 1} times within 24 hours at {txn.merchant_name}.",
        )
        db.add(alert)
        db.commit()
        return True

    return False
