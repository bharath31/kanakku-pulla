import json
import logging

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.category import Category
from app.models.credit_card import CreditCard
from app.models.merchant_cache import MerchantCache
from app.models.transaction import Transaction
from app.services.ai_activity_logger import log_ai_activity

logger = logging.getLogger(__name__)

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

# Category inference from web search keywords
CATEGORY_KEYWORDS = {
    "restaurant": "Dining",
    "food": "Dining",
    "cafe": "Dining",
    "dining": "Dining",
    "grocery": "Groceries",
    "supermarket": "Groceries",
    "retail": "Shopping",
    "shop": "Shopping",
    "store": "Shopping",
    "ecommerce": "Shopping",
    "e-commerce": "Shopping",
    "travel": "Travel",
    "airline": "Travel",
    "hotel": "Travel",
    "booking": "Travel",
    "flight": "Travel",
    "cab": "Travel",
    "taxi": "Travel",
    "ride": "Travel",
    "streaming": "Subscriptions",
    "subscription": "Subscriptions",
    "saas": "Subscriptions",
    "telecom": "Utilities",
    "electricity": "Utilities",
    "water": "Utilities",
    "gas station": "Fuel",
    "petrol": "Fuel",
    "fuel": "Fuel",
    "cinema": "Entertainment",
    "movie": "Entertainment",
    "entertainment": "Entertainment",
    "game": "Entertainment",
    "hospital": "Healthcare",
    "pharmacy": "Healthcare",
    "medical": "Healthcare",
    "health": "Healthcare",
    "clinic": "Healthcare",
    "doctor": "Healthcare",
    "insurance": "Insurance",
    "education": "Education",
    "school": "Education",
    "university": "Education",
    "college": "Education",
    "course": "Education",
}

BATCH_SIZE = 20


def _get_user_id_for_transaction(db: Session, txn: Transaction) -> int | None:
    """Look up the user_id for a transaction via its card."""
    card = db.query(CreditCard).filter(CreditCard.id == txn.card_id).first()
    return card.user_id if card else None


async def categorize_transactions(db: Session, transaction_ids: list[int], user_id: int | None = None):
    """Categorize transactions using known mappings first, then AI for unknowns."""
    txns = db.query(Transaction).filter(Transaction.id.in_(transaction_ids)).all()
    categories = {c.name: c.id for c in db.query(Category).all()}

    uncategorized = []
    categorized_count = 0

    for txn in txns:
        if txn.is_fee:
            txn.category_id = categories.get("Fees & Charges")
            categorized_count += 1
            continue

        # Try known merchant mapping
        matched = False
        desc_lower = (txn.description or "").lower() + " " + (txn.merchant_name or "").lower()
        for keyword, cat_name in KNOWN_MERCHANTS.items():
            if keyword in desc_lower:
                txn.category_id = categories.get(cat_name)
                categorized_count += 1
                matched = True
                break

        if not matched:
            # Check merchant cache
            merchant_key = (txn.merchant_name or txn.description or "").strip().lower()
            if merchant_key:
                cached = db.query(MerchantCache).filter(MerchantCache.merchant_name == merchant_key).first()
                if cached and cached.category_name in categories:
                    txn.category_id = categories[cached.category_name]
                    categorized_count += 1
                    matched = True

        if not matched:
            uncategorized.append(txn)

    db.commit()

    # Use AI for remaining uncategorized transactions
    ai_categorized = 0
    if uncategorized and settings.cloudflare_account_id and settings.cloudflare_api_token:
        for i in range(0, len(uncategorized), BATCH_SIZE):
            batch = uncategorized[i : i + BATCH_SIZE]
            count = await _ai_categorize_batch(db, batch, categories)
            ai_categorized += count

    # Try web search for still-uncategorized
    still_uncategorized = [t for t in uncategorized if not t.category_id]
    web_categorized = 0
    if still_uncategorized:
        web_categorized = await _web_search_categorize(db, still_uncategorized, categories)

    # Determine user_id for logging
    if not user_id and txns:
        user_id = _get_user_id_for_transaction(db, txns[0])

    if user_id and (categorized_count + ai_categorized + web_categorized) > 0:
        total = categorized_count + ai_categorized + web_categorized
        log_ai_activity(
            db, user_id, "categorized",
            f"Categorized {total} transaction{'s' if total != 1 else ''}",
            {"keyword": categorized_count, "ai": ai_categorized, "web_search": web_categorized},
        )


async def _ai_categorize_batch(db: Session, txns: list[Transaction], categories: dict[str, int]) -> int:
    category_names = list(categories.keys())
    categorized = 0

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
                return 0

            data = resp.json()
            result_text = data.get("result", {}).get("response", "")

            # Extract JSON array from response
            start = result_text.find("[")
            end = result_text.rfind("]") + 1
            if start == -1 or end == 0:
                return 0

            ai_categories = json.loads(result_text[start:end])

            for txn, cat_name in zip(txns, ai_categories):
                if cat_name in categories:
                    txn.category_id = categories[cat_name]
                    categorized += 1
                    # Cache the mapping
                    merchant_key = (txn.merchant_name or txn.description or "").strip().lower()
                    if merchant_key:
                        _cache_merchant(db, merchant_key, cat_name)

            db.commit()
    except Exception:
        pass  # AI categorization is best-effort

    return categorized


async def _web_search_categorize(db: Session, txns: list[Transaction], categories: dict[str, int]) -> int:
    """Use DuckDuckGo Instant Answer API to categorize merchants by web search."""
    categorized = 0

    for txn in txns:
        merchant = (txn.merchant_name or txn.description or "").strip()
        if not merchant or len(merchant) < 3:
            continue

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://api.duckduckgo.com/",
                    params={"q": merchant, "format": "json", "no_redirect": "1"},
                )
                if resp.status_code != 200:
                    continue

                data = resp.json()
                abstract = (data.get("Abstract", "") + " " + data.get("AbstractText", "")).lower()
                heading = data.get("Heading", "").lower()
                # Also check related topics
                related_text = " ".join(
                    t.get("Text", "") for t in data.get("RelatedTopics", []) if isinstance(t, dict)
                ).lower()

                search_text = f"{abstract} {heading} {related_text}"

                # Try to match category keywords
                matched_cat = None
                for keyword, cat_name in CATEGORY_KEYWORDS.items():
                    if keyword in search_text:
                        if cat_name in categories:
                            matched_cat = cat_name
                            break

                if matched_cat:
                    txn.category_id = categories[matched_cat]
                    categorized += 1
                    merchant_key = merchant.strip().lower()
                    _cache_merchant(db, merchant_key, matched_cat)

        except Exception:
            continue  # Web search is best-effort

    if categorized > 0:
        db.commit()

    return categorized


def _cache_merchant(db: Session, merchant_key: str, category_name: str):
    """Cache a merchant→category mapping."""
    existing = db.query(MerchantCache).filter(MerchantCache.merchant_name == merchant_key).first()
    if not existing:
        db.add(MerchantCache(merchant_name=merchant_key, category_name=category_name))
        try:
            db.flush()
        except Exception:
            db.rollback()
