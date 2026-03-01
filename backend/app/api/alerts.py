from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.alert import Alert
from app.schemas.alerts import AlertResponse, AlertSummary

router = APIRouter()


@router.get("/", response_model=list[AlertResponse])
def list_alerts(
    alert_type: str | None = None,
    severity: str | None = None,
    is_read: bool | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = db.query(Alert).filter(Alert.is_dismissed == False)  # noqa: E712

    if alert_type:
        query = query.filter(Alert.alert_type == alert_type)
    if severity:
        query = query.filter(Alert.severity == severity)
    if is_read is not None:
        query = query.filter(Alert.is_read == is_read)

    return query.order_by(Alert.created_at.desc()).offset(offset).limit(limit).all()


@router.get("/summary", response_model=AlertSummary)
def alert_summary(db: Session = Depends(get_db)):
    base = db.query(Alert).filter(Alert.is_dismissed == False)  # noqa: E712
    total = base.count()
    unread = base.filter(Alert.is_read == False).count()  # noqa: E712
    critical = base.filter(Alert.severity == "critical").count()
    warning = base.filter(Alert.severity == "warning").count()
    return AlertSummary(total=total, unread=unread, critical=critical, warning=warning)


@router.put("/{alert_id}/read")
def mark_read(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_read = True
    db.commit()
    return {"ok": True}


@router.put("/{alert_id}/dismiss")
def dismiss_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_dismissed = True
    db.commit()
    return {"ok": True}
