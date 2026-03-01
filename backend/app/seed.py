from app.database import SessionLocal
from app.models.category import Category

DEFAULT_CATEGORIES = [
    {"name": "Groceries", "icon": "shopping-cart", "color": "#22c55e"},
    {"name": "Dining", "icon": "utensils", "color": "#f97316"},
    {"name": "Fuel", "icon": "fuel", "color": "#eab308"},
    {"name": "Shopping", "icon": "shopping-bag", "color": "#3b82f6"},
    {"name": "Travel", "icon": "plane", "color": "#8b5cf6"},
    {"name": "Entertainment", "icon": "film", "color": "#ec4899"},
    {"name": "Utilities", "icon": "zap", "color": "#06b6d4"},
    {"name": "Healthcare", "icon": "heart-pulse", "color": "#ef4444"},
    {"name": "Subscriptions", "icon": "repeat", "color": "#a855f7"},
    {"name": "Education", "icon": "book", "color": "#14b8a6"},
    {"name": "Insurance", "icon": "shield", "color": "#64748b"},
    {"name": "EMI", "icon": "calendar", "color": "#f59e0b"},
    {"name": "Fees & Charges", "icon": "alert-triangle", "color": "#dc2626"},
    {"name": "Transfers", "icon": "arrow-right-left", "color": "#6366f1"},
    {"name": "Other", "icon": "circle", "color": "#94a3b8"},
]


def seed_categories():
    db = SessionLocal()
    try:
        if db.query(Category).count() == 0:
            for cat in DEFAULT_CATEGORIES:
                db.add(Category(**cat))
            db.commit()
    finally:
        db.close()
