# Kanakku Pulla

AI-powered credit card statement analyzer for Indian banks.

## Project Structure
- `backend/` — Python FastAPI app (SQLAlchemy + SQLite + pdfplumber)
- `frontend/` — Next.js 15 + React 19 + TypeScript + Tailwind + shadcn/ui + Recharts

## Backend Commands
```bash
cd backend
pip install -e ".[dev]"
uvicorn app.main:app --reload        # Dev server on :8000
alembic upgrade head                  # Run migrations
alembic revision --autogenerate -m "" # New migration
pytest                                # Run tests
```

## Frontend Commands
```bash
cd frontend
npm install
npm run dev    # Dev server on :3000
npm run build  # Production build
```

## Architecture
- Bank parser plugin system in `backend/app/parsers/` — each bank has its own parser
- AI categorization via Cloudflare Workers AI (Llama 3.1 8B)
- Email ingestion via AgentMail webhooks
- Alert engine: rule-based fee detection + AI anomaly detection

## Key Patterns
- All API routes under `/api/v1/`
- Pydantic schemas for request/response validation
- SQLAlchemy ORM models in `backend/app/models/`
- Parser registry auto-discovers bank parsers
