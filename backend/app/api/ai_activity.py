from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.ai_activity import AIActivity
from app.models.user import User

router = APIRouter()


class AIActivityResponse(BaseModel):
    id: int
    action_type: str
    description: str
    metadata_json: str | None
    created_at: str

    model_config = {"from_attributes": True}


@router.get("/activity", response_model=list[AIActivityResponse])
def list_ai_activity(
    limit: int = Query(default=20, le=100),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    activities = (
        db.query(AIActivity)
        .filter(AIActivity.user_id == current_user.id)
        .order_by(AIActivity.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    results = []
    for a in activities:
        results.append(AIActivityResponse(
            id=a.id,
            action_type=a.action_type,
            description=a.description,
            metadata_json=a.metadata_json,
            created_at=a.created_at.isoformat() if a.created_at else "",
        ))
    return results
