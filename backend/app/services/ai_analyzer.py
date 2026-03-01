import json

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.category import Category
from app.models.transaction import Transaction

# Well-known Indian merchant → category mappings
KNOWN_MERCHANTS = {
    "swiggy": "Dining",
    "zomato": "Dining",
    "bigbasket": "Groceries",
    "blinkit": "Groceries",
    "zepto": "Groceries",
    "dmart": "Groceries",
    "more": "Groceries",
    "amazon": "Shopping",
    "flipkart": "Shopping",
    "myntra": "Shopping",
    "ajio": "Shopping",
    "nykaa": "Shopping",
    "irctc": "Travel",
    "makemytrip": "Travel",
    "uber": "Travel",
    "ola": "Travel",
    "rapido": "Travel",
    "netflix": "Subscriptions",
    "spotify": "Subscriptions",
    "hotstar": "Subscriptions",
    "youtube": "Subscriptions",
    "prime video": "Subscriptions",
    "jio": "Utilities",
    "airtel": "Utilities",
    "vodafone": "Utilities",
    "vi ": "Utilities",
    "bescom": "Utilities",
    "bwssb": "Utilities",
    "iocl": "Fuel",
    "hpcl": "Fuel",
    "bpcl": "Fuel",
    "indian oil": "Fuel",
    "shell": "Fuel",
    "pvr": "Entertainment",
    "inox": "Entertainment",
    "bookmyshow": "Entertainment",
    "apollo": "Healthcare",
    "practo": "Healthcare",
    "pharmeasy": "Healthcare",
    "1mg": "Healthcare",
}

BATCH_SIZE = 20


async def categorize_transactions(db: Session, transaction_ids: list[int]):
    """Categorize transactions using known mappings first, then AI for unknowns."""
    txns = db.query(Transaction).filter(Transaction.id.in_(transaction_ids)).all()
    categories = {c.name: c.id for c in db.query(Category).all()}

    uncategorized = []

    for txn in txns:
        if txn.is_fee:
            txn.category_id = categories.get("Fees & Charges")
            continue

        # Try known merchant mapping
        matched = False
        desc_lower = (txn.description or "").lower() + " " + (txn.merchant_name or "").lower()
        for keyword, cat_name in KNOWN_MERCHANTS.items():
            if keyword in desc_lower:
                txn.category_id = categories.get(cat_name)
                matched = True
                break

        if not matched:
            uncategorized.append(txn)

    db.commit()

    # Use AI for remaining uncategorized transactions
    if uncategorized and settings.cloudflare_account_id and settings.cloudflare_api_token:
        for i in range(0, len(uncategorized), BATCH_SIZE):
            batch = uncategorized[i : i + BATCH_SIZE]
            await _ai_categorize_batch(db, batch, categories)


async def _ai_categorize_batch(db: Session, txns: list[Transaction], categories: dict[str, int]):
    category_names = list(categories.keys())

    txn_list = "\n".join(
        f"{i+1}. {t.description} — ₹{t.amount}" for i, t in enumerate(txns)
    )

    prompt = f"""Categorize these Indian credit card transactions into one of these categories:
{', '.join(category_names)}

Transactions:
{txn_list}

Reply with ONLY a JSON array of category names, one per transaction. Example: ["Dining", "Shopping", "Fuel"]"""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"https://api.cloudflare.com/client/v4/accounts/{settings.cloudflare_account_id}/ai/run/@cf/meta/llama-3.1-8b-instruct",
                headers={"Authorization": f"Bearer {settings.cloudflare_api_token}"},
                json={"messages": [{"role": "user", "content": prompt}]},
            )

            if resp.status_code != 200:
                return

            data = resp.json()
            result_text = data.get("result", {}).get("response", "")

            # Extract JSON array from response
            start = result_text.find("[")
            end = result_text.rfind("]") + 1
            if start == -1 or end == 0:
                return

            ai_categories = json.loads(result_text[start:end])

            for txn, cat_name in zip(txns, ai_categories):
                if cat_name in categories:
                    txn.category_id = categories[cat_name]

            db.commit()
    except Exception:
        pass  # AI categorization is best-effort
