# LedgrAI — AI-Powered Accounting Software

> Full-stack accounting automation: double-entry engine · AI bank reconciliation · GST reports · payroll

![CI](https://github.com/infotaskosphere/aiaccounting/actions/workflows/ci.yml/badge.svg)

## Quick Start

```bash
# Backend
cd backend && pip install -r requirements.txt
cp .env.example .env   # fill in secrets
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend && npm install && npm run dev
# → http://localhost:3000
```

## Structure

```
aiaccounting/
├── backend/          # FastAPI + Python
│   ├── app/          # Routes, models, dependencies
│   ├── engine/       # Double-entry accounting core
│   ├── ai/           # Transaction classifier, reconciliation
│   ├── compliance/   # GST engine, payroll processor
│   └── db/           # PostgreSQL schema + seeds
├── frontend/         # React + Vite
│   └── src/
│       ├── pages/    # Dashboard, Journal, Bank, GST, Payroll
│       ├── components/
│       ├── api/      # Axios client + mock data
│       └── utils/
├── infra/            # Docker Compose + Nginx
└── .github/          # CI/CD workflows
```

## Stack
**Backend**: Python 3.12, FastAPI, PostgreSQL 16, asyncpg, Celery, Redis  
**AI**: sentence-transformers, rapidfuzz, scikit-learn, Tesseract OCR  
**Frontend**: React 18, Vite, Recharts, react-dropzone  
**Infra**: Docker, Nginx, GitHub Actions  

## API Docs
Visit `http://localhost:8000/api/docs` after starting the backend.
