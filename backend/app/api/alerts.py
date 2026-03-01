from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.alert import Alert
from app.models.credit_card import CreditCard
from app.models.statement import Statement
from app.models.user import User
from app.schemas.alerts import AlertResponse, AlertSummary

router = APIRouter()


def _user_alert_query(db: Session, user: User):
    """Return a base query for alerts scoped to the current user's cards."""
    user_card_ids = [c.id for c in db.query(CreditCard).filter(CreditCard.user_id == user.id).all()]
    return db.query(Alert).join(
        Statement, Alert.statement_id == Statement.id
    ).filter(
        Statement.card_id.in_(user_card_ids),
        Alert.is_dismissed == False,  # noqa: E712
    )


@router.get("/", response_model=list[AlertResponse])
def list_alerts(
    alert_type: str | None = None,
    severity: str | None = None,
    is_read: bool | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = _user_alert_query(db, current_user)

    if alert_type:
        query = query.filter(Alert.alert_type == alert_type)
    if severity:
        query = query.filter(Alert.severity == severity)
    if is_read is not None:
        query = query.filter(Alert.is_read == is_read)

    return query.order_by(Alert.created_at.desc()).offset(offset).limit(limit).all()


@router.get("/summary", response_model=AlertSummary)
def alert_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    base = _user_alert_query(db, current_user)
    total = base.count()
    unread = base.filter(Alert.is_read == False).count()  # noqa: E712
    critical = base.filter(Alert.severity == "critical").count()
    warning = base.filter(Alert.severity == "warning").count()
    return AlertSummary(total=total, unread=unread, critical=critical, warning=warning)


@router.put("/{alert_id}/read")
def mark_read(alert_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user_card_ids = [c.id for c in db.query(CreditCard).filter(CreditCard.user_id == current_user.id).all()]
    alert = db.query(Alert).join(
        Statement, Alert.statement_id == Statement.id
    ).filter(Alert.id == alert_id, Statement.card_id.in_(user_card_ids)).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_read = True
    db.commit()
    return {"ok": True}


@router.put("/{alert_id}/dismiss")
def dismiss_alert(alert_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user_card_ids = [c.id for c in db.query(CreditCard).filter(CreditCard.user_id == current_user.id).all()]
    alert = db.query(Alert).join(
        Statement, Alert.statement_id == Statement.id
    ).filter(Alert.id == alert_id, Statement.card_id.in_(user_card_ids)).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_dismissed = True
    db.commit()
    return {"ok": True}
