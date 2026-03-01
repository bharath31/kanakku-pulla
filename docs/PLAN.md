# Kanakku Pulla - Implementation Plan

## Context

Building an open-source AI agent (like CRED Protect) that reads credit card statements from email, detects suspicious/hidden charges, and provides spending analytics — tailored for Indian banks. Uses Cloudflare Workers AI for cheap analysis. Designed with a plugin architecture to extend to banking transactions, mutual funds, etc.

**Key differentiator**: Extremely safe, secure, and privacy-friendly. Self-hosted, no data leaves your machine. 1-click deploy on your favorite platform.

---

## Tech Stack

- **Backend**: Python 3.11+ / FastAPI / SQLAlchemy / SQLite / pdfplumber
- **Frontend**: Next.js 15 / React 19 / TypeScript / Tailwind CSS / shadcn/ui / Recharts
- **AI**: Cloudflare Workers AI (REST API, Llama 3.1 8B)
- **Email Ingestion**: AgentMail (agentmail.to) — each user gets a dedicated inbox, forwards CC emails to it. Webhook-based, no IMAP polling needed
- **Deployment**: Docker Compose (single-file SQLite, no external DB). 1-click deploy buttons for Railway, Render, Fly.io

---

## Email Strategy: AgentMail

Instead of IMAP polling (which requires storing email passwords), we use **AgentMail**:

1. On signup/setup, create a dedicated AgentMail inbox per user (e.g., `bharath-cc@agentmail.to`)
2. User sets up email forwarding from their bank emails OR manually forwards CC statement emails to this address
3. AgentMail fires a **webhook** to our backend when an email arrives
4. Backend extracts PDF attachments, parses, categorizes, and alerts
5. **Also support manual PDF upload** as fallback

**Benefits**: No stored email passwords, no IMAP complexity, real-time via webhooks, works with any email provider. Users just forward emails.

---

## Data Models (SQLite)

| Table | Key Fields |
|-------|-----------|
| `inboxes` | agentmail_inbox_id, email_address, webhook_secret, is_active |
| `credit_cards` | inbox_id, bank, card_name, last_four, holder_name, dob, credit_limit |
| `statements` | card_id, statement_date, due_date, total_due, min_due, pdf_file_hash, parse_status, source |
| `transactions` | statement_id, card_id, txn_date, description, merchant_name, amount, currency, category_id, is_fee, fee_type, is_emi, is_international |
| `categories` | name, icon, color, parent_id |
| `alerts` | transaction_id, alert_type, severity, title, is_read |
| `reward_points` | card_id, points_earned, points_redeemed, total_points, as_of_date |

---

## Core Architecture

### 1. Bank Parser Plugin System
- `BaseBankParser` ABC with auto-detect
- PDF passwords by bank: HDFC = `name[:4].lower() + DDMM`, SBI = `name[:4].upper() + DDMM`
- Start with HDFC parser (largest issuer)

### 2. AI Categorization
- Known Indian merchant mappings (Swiggy=Dining, BigBasket=Groceries, etc.)
- Cloudflare Workers AI for unknown merchants (batch 20 txns/call)

### 3. Alert Engine
- Rule-based fee detection (8 fee types with India-specific tips)
- Duplicate charge detection (same merchant+amount within 24h)

### 4. Analytics
- Monthly summary, category trends, merchant ranking, fee breakdown, rewards

---

## Implementation Steps

1. Project scaffolding
2. Database models, config, migrations
3. Parser foundation + HDFC parser
4. Statement upload & transaction APIs
5. AI categorization service
6. Alert engine
7. Analytics API
8. Frontend — Settings & Upload
9. Frontend — Dashboard & Transactions
10. Frontend — Analytics & Alerts
11. AgentMail integration
12. Additional bank parsers (ICICI, SBI, Axis)
