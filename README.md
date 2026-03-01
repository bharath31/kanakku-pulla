# Kanakku Pulla

**AI-powered credit card statement analyzer for Indian banks.** A privacy-first, self-hosted alternative to CRED Protect.

Upload your credit card statement PDFs and instantly get:
- **Transaction categorization** — auto-categorized with Indian merchant awareness (Swiggy, BigBasket, IRCTC, etc.)
- **Hidden fee detection** — spots annual fees, GST, finance charges, late fees, forex markup, and more
- **Duplicate charge alerts** — flags suspicious repeated charges
- **Spending analytics** — category breakdowns, trends, top merchants, daily spending charts
- **Actionable tips** — advice on waiving fees and saving money

## Privacy First

Your data **never leaves your machine**. Everything runs locally:
- SQLite database (single file, no external DB)
- Self-hosted backend and frontend
- AI categorization sends only merchant names (no personal data)
- No email passwords stored — uses email forwarding via AgentMail

## One-Click Deploy

[![Deploy on Fly.io](https://fly.io/button/button.svg)](https://fly.io/launch?repo=https://github.com/bharath31/kanakku-pulla)
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template?repo=https://github.com/bharath31/kanakku-pulla)

## Quick Start

### Docker (Recommended)

```bash
git clone https://github.com/bharath31/kanakku-pulla.git
cd kanakku-pulla
cp .env.example .env
docker-compose up
```

Open http://localhost:3000

### Manual Setup

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## How It Works

1. **Add your card** — Go to Settings, add your credit card (bank + name on card + DOB for PDF password)
2. **Upload statement** — Drop your CC statement PDF on the Statements page
3. **Auto-analysis** — Transactions are parsed, categorized, and scanned for hidden charges
4. **Review insights** — Check Dashboard for spending overview, Alerts for suspicious charges

## Supported Banks

- HDFC Bank (fully supported)
- ICICI Bank (coming soon)
- SBI (coming soon)
- Axis Bank (coming soon)

## Tech Stack

- **Backend**: Python / FastAPI / SQLAlchemy / SQLite / pdfplumber
- **Frontend**: Next.js 15 / React 19 / TypeScript / Tailwind CSS / shadcn/ui / Recharts
- **AI**: Cloudflare Workers AI (optional, Llama 3.1 8B)
- **Email**: AgentMail webhooks (optional)

## Configuration

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | No | SQLite path (default: `sqlite:///./kanakku.db`) |
| `CLOUDFLARE_ACCOUNT_ID` | No | For AI categorization |
| `CLOUDFLARE_API_TOKEN` | No | For AI categorization |
| `AGENTMAIL_API_KEY` | No | For email forwarding |

AI and email features are optional — core parsing and fee detection work without any API keys.

## Contributing

Contributions welcome! Especially:
- New bank parsers (see `backend/app/parsers/hdfc.py` as template)
- Improved transaction categorization
- Bug reports with sample statement structures

## License

MIT
