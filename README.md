# Monkspaces Shared Product & Packaging Data Platform

A multi-tenant SaaS platform for collecting, normalising, governing, and reusing product and packaging data across compliance workflows.

- **Initial vertical slice:** One validated EPR reporting workflow for one explicitly selected jurisdiction.
- **Future modules:** PPWR (Packaging and Packaging Waste Regulation), Digital Product Passport (DPP), and other compliance workflows.
- **Stack:** Angular + TypeScript (Frontend), Python + FastAPI (Backend), PostgreSQL (Database).

---

## Architecture Principles

1. **Shared Foundation, Decoupled Modules:** Product master data, packaging specifications, BOM components, and materials are stored once in canonical relational tables; compliance-specific logic and rule-sets reside in separate modules.
2. **Strict Multi-Tenancy:** Tenant isolation is enforced at every backend route, query, background job, file access, and export. Monkspaces consultants only access assigned client workspaces. Frontend checks are never trusted alone for security.
3. **Auditability & Lineage:** Every import retains source file lineage, raw values, and mapped units. Missing values are never converted to zero or silently overwritten.
4. **Reproducibility:** Compliance runs link to an immutable snapshot of input data and versioned rule-sets, ensuring reports are reproducible over time.
5. **Quality vs. Compliance Separation:** Data-quality issues (missing fields, unverified supplier evidence) are managed separately from regulatory compliance status.

---

## Repository Structure

```text
├── backend/                        # FastAPI modular monolith application
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   └── health.py       # Health check endpoint (/api/v1/health)
│   │   │   └── router.py           # Combined API router
│   │   ├── core/
│   │   │   └── config.py           # Application settings using pydantic-settings
│   │   ├── modules/                # Domain boundaries (tenants, products, packaging, ingestion, etc.)
│   │   │   └── __init__.py
│   │   ├── __init__.py
│   │   └── main.py                 # FastAPI application factory and entry point
│   ├── tests/
│   │   ├── conftest.py             # Test fixtures and TestClient
│   │   └── test_health.py          # Automated tests for health and CORS
│   ├── .env.example                # Backend environment configuration template
│   ├── pyproject.toml              # Build tool and pytest configuration
│   └── requirements.txt            # Backend dependencies manifest
├── frontend/                       # Modern Angular standalone application
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.ts              # Root standalone component with signal state
│   │   │   ├── app.html            # Premium interface, health monitoring, tenant selector
│   │   │   ├── app.css             # Glassmorphism and dark mode styling
│   │   │   └── app.spec.ts         # Angular unit tests
│   │   ├── index.html              # HTML shell with Google Fonts
│   │   ├── main.ts                 # Angular bootstrap
│   │   └── styles.css              # Global design tokens and typography
│   ├── angular.json                # Angular CLI workspace configuration
│   ├── package.json                # Frontend dependencies and npm scripts
│   └── tsconfig.json               # TypeScript configuration
├── docs/                           # Architecture, data model, security & decision logs
├── .gitignore                      # Git ignore rules for Python, Node, and secrets
├── .env.example                    # Root environment variable template
└── README.md                       # Platform overview and setup instructions
```

---

## Local Development Guide

### Prerequisites

- **Python:** 3.11+
- **Node.js:** 20+ (Node 24 tested)
- **npm:** 10+ (npm 11 tested)

---

### Backend Setup (FastAPI)

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Start the development server:**
   ```bash
   python -m uvicorn app.main:app --reload --port 8000
   ```

5. **Verify API endpoints:**
   - Health check: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)
   - Interactive Swagger API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

6. **Run backend automated tests:**
   ```bash
   pytest tests
   ```

---

### Frontend Setup (Angular)

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```
   *The application will be accessible at [http://localhost:4200](http://localhost:4200).*

4. **Run frontend unit tests:**
   ```bash
   npm run test:ci
   ```

5. **Build production bundle:**
   ```bash
   npm run build
   ```

---

## Verification & Automated Test Status

| Component | Test Suite | Command | Status |
| :--- | :--- | :--- | :--- |
| **Backend** | Health checks, CORS headers | `python -m pytest backend/tests` | **3 / 3 PASSED** |
| **Frontend** | Component creation, headings, tenant switching | `npm run test:ci` | **4 / 4 PASSED** |
| **Frontend Build** | Production bundle generation | `npm run build` | **SUCCESS** |
