import re
from datetime import timedelta

from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.transaction import Transaction

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


def run_alerts_for_statement(db: Session, statement_id: int):
    """Run all alert checks for a newly parsed statement."""
    txns = db.query(Transaction).filter(Transaction.statement_id == statement_id).all()

    for txn in txns:
        # Fee detection
        _check_fees(db, txn, statement_id)

        # Duplicate charge detection
        _check_duplicates(db, txn, statement_id)


def _check_fees(db: Session, txn: Transaction, statement_id: int):
    if not txn.description:
        return

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

    db.commit()


def _check_duplicates(db: Session, txn: Transaction, statement_id: int):
    if not txn.txn_date or not txn.merchant_name:
        return

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
