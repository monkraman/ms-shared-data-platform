# Compliance Hub — Shared Product & Packaging Data Platform

An enterprise multi-tenant platform for centralising packaging Bill of Materials (BOM), identifying data quality gaps, and calculating compliance liabilities across national Extended Producer Responsibility (EPR) regulations and emerging EU Packaging & Packaging Waste Regulations (PPWR).

---

## Architecture Overview

```text
[ Client ERP / PLM / Excel Source ]
                 │
                 ▼
    ┌─────────────────────────────┐
    │  1. Ingestion & Lineage     │  (Saved mapping templates per source feed)
    └──────────────┬──────────────┘
                   │
                   ▼
    ┌─────────────────────────────┐
    │  2. Canonical Foundation    │  (Master Products + Packaging BOM Components)
    │     (STORED ONCE)           │
    └──────────────┬──────────────┘
                   │
                   ▼
    ┌─────────────────────────────┐
    │  3. Data Quality Shield     │  (Automated gap detection + € liability risk)
    └──────────────┬──────────────┘
                   │
                   ├───► Module 1: UK Defra RPD EPR Filing (Statutory CSV export)
                   ├───► Module 2: France CITEO & Germany LUCID Fee Runs
                   ├───► Module 3: EU PPWR Recyclability Scorecard
                   └───► Module 4: Digital Product Passport (DPP QR Carriers)
```

### Core Engineering Principles
1. **Single Source of Truth:** Packaging master data and sales volumes are ingested once and normalized into canonical tables, eliminating repetitive data collection for each regulation.
2. **Read-Only Source System Boundary:** The platform audits and analyzes data without modifying client ERP (SAP S/4HANA) or PLM (Trace One Devex) databases directly. Corrections are routed via structured tickets to be updated at source.
3. **Reusable Mapping Templates:** Field mappings are configured once and retained. Subsequent re-imports or scheduled API syncs require zero manual mapping.
4. **No Silent Guessing:** Missing component weights or unverified recycled content (PCR%) are never defaulted to zero; they are tracked as explicit gaps with financial uncertainty margins.
5. **Strict Multi-Tenancy:** Workspaces, audit logs, and reports are isolated per client organization.

---

## Tech Stack

- **Frontend:** Angular 17+ (Standalone Components, Signals Reactive State, Dual Light/Dark Theme, Strict Monochrome UI).
- **Backend:** Python 3.11+, FastAPI, Pydantic v2.
- **Database:** PostgreSQL (with Neon Serverless driver support via `psycopg`).
- **Deployment:** Render Blueprint (`render.yaml`).

---

## Local Development Quickstart

### 1. Backend (FastAPI)

```bash
cd backend

# Create & activate Python virtual environment
python -m venv .venv
source .venv/Scripts/activate  # On Windows Git Bash
# or: .\.venv\Scripts\Activate.ps1 on PowerShell

# Install dependencies
pip install -r requirements.txt

# Start backend server
uvicorn app.main:app --reload --port 8000
```

- **Interactive Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Probe:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

### 2. Frontend (Angular)

```bash
cd frontend

# Install Node dependencies
npm install

# Start development server
npm start
```

- **Web Application:** [http://localhost:4200](http://localhost:4200)
- **Sign In & Workspace Entry:** [http://localhost:4200/sign-in](http://localhost:4200/sign-in)
- **SuperAdmin Panel:** [http://localhost:4200/admin](http://localhost:4200/admin)

---

## Deployment to Render

The repository includes a ready-to-use Render Blueprint (`render.yaml`):

1. Push your repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com/), select **New +** > **Blueprint**.
3. Select your repository. Render automatically configures:
   - `compliance-hub-backend` (Python Web Service)
   - `compliance-hub-frontend` (Static Site with SPA rewrite rules)
4. Add your `DATABASE_URL` (Neon PostgreSQL connection string) in the backend environment settings.
5. Click **Apply** to deploy both services simultaneously.

---

## Documentation Index

- [`docs/PRODUCT_CONTEXT.md`](docs/PRODUCT_CONTEXT.md) — Product vision, 5-stage loop, and module roadmap.
- [`docs/DATABASE_SCHEMA_PLAN.md`](docs/DATABASE_SCHEMA_PLAN.md) — Relational schema design and DDL.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Multi-tier system boundaries and integration architecture.
- [`ERD_DOCUMENT.md`](ERD_DOCUMENT.md) — Visual Entity Relationship Diagram and 5-domain data dictionary.
