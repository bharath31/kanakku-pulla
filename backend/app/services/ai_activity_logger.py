import json

from sqlalchemy.orm import Session

from app.models.ai_activity import AIActivity


def log_ai_activity(
    db: Session,
    user_id: int,
    action_type: str,
    description: str,
    metadata: dict | None = None,
):
    activity = AIActivity(
        user_id=user_id,
        action_type=action_type,
        description=description,
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    db.add(activity)
    db.commit()
