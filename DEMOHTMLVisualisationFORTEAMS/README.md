# Monkspaces — Visual Architecture & Database Design Interactive Demo

> **Audience:** Monkspaces Engineering, Architecture, Product, and Domain Teams  
> **Purpose:** Single, self-contained interactive visual showcase of the proposed Monkspaces Shared Product & Packaging Data Platform.  
> **Source Documents of Truth:** `docs/ARCHITECTURE.md`, `docs/DATABASE_SCHEMA_PLAN.md`, `docs/DATA_MODEL.md`, `docs/INGESTION_AND_DATA_QUALITY.md`, `docs/DECISIONS.md`, `docs/PRODUCT_CONTEXT.md`, and `reference-docs-teams/`.

---

## 🚀 How to Open and Run

This visualization is **100% self-contained** in a single file with embedded styles, vector SVGs, and responsive JavaScript. It has **zero external CDN dependencies**, requires no API keys, and runs completely offline in any modern web browser.

### Option 1: Direct File Launch
Double-click `index.html` or open it directly in your browser:
```text
f:\compliance tool\DEMOHTMLVisualisationFORTEAMS\index.html
```
- In Chrome/Edge: Right-click `index.html` → **Open with** → **Google Chrome** (or Microsoft Edge).
- In PowerShell:
  ```powershell
  Start-Process "f:\compliance tool\DEMOHTMLVisualisationFORTEAMS\index.html"
  ```

### Option 2: Local HTTP Server (Optional)
If presenting via a local dev server:
```powershell
# From the DEMOHTMLVisualisationFORTEAMS directory:
python -m http.server 3000
# Open http://localhost:3000 in your browser
```

---

## 🧭 Navigation & Core Capabilities

The showcase is organised into **6 interactive views** via the top navigation bar:

### 1. System Architecture (`1. System Architecture`)
- Visual, layered architecture diagram showing:
  - **Client Layer:** Angular 17+ standalone web application with Signals state management.
  - **Gateway & Ingestion:** OIDC identity provider, S3-compatible private object storage, and async background workers.
  - **Modular Monolith Backend:** Python FastAPI services organized into Layer 1 (Canonical Foundation), Layer 2 (Data Quality & Gaps), Layer 3 (EPR Compliance), and future extension points for PPWR and Digital Product Passport (DPP).
  - **Persistence Layer:** PostgreSQL 15+ relational core (17 tables), hybrid JSONB for lossless ERP metadata, and Row-Level Security (RLS) policies.
- **Interactive:** Click any node to slide open the right-hand **Inspector Panel** with detailed inputs, outputs, responsibilities, and source document links.

### 2. Database ER Diagram (`2. Database ERD (Interactive)`)
- Native interactive SVG canvas with all **17 relational tables** from `docs/DATABASE_SCHEMA_PLAN.md` arranged across 5 domains:
  1. *Domain 1: Tenancy & Integrations* (`tenants`, `tenant_markets_enabled`, `tenant_integrations`)
  2. *Domain 2: Ingestion & Column Mapping* (`ingestion_batches`, `mapping_templates`, `mapping_template_fields`)
  3. *Domain 3: Layer 1 Canonical Foundation* (`products`, `packaging_components`, `component_materials_split`, `sales_placed_on_market`)
  4. *Domain 4: Layer 2 Data Quality & Gaps* (`compliance_data_point_rules`, `data_quality_issues`, `source_correction_tickets`, `locked_snapshots`)
  5. *Domain 5: Layer 3 EPR Engine & Defra Exports* (`calculation_runs`, `calculation_line_items`, `uk_rpd_export_lines`)
- **Controls:**
  - **Zoom & Pan:** Use mouse-wheel to zoom in/out, click and drag canvas to pan across the schema.
  - **Toolbar:** `+` / `−` zoom buttons, `1:1` reset, and `⛶` fit-to-screen.
  - **Real-Time Search:** Type any table or column name (e.g. `weight_grams`, `ram_rag_rating`, `sku`) to instantly highlight matching tables.
  - **Domain Filter:** Cycle through domain layers (Tenancy, Ingestion, Canonical, Quality, Compliance).
  - **Click to Inspect & Connect:** Clicking any table highlights all its 1:N foreign-key connections and populates the Inspector with full DDL types and cardinalities.

### 3. End-to-End Data Flow (`3. End-to-End Data Flow`)
- Step-by-step 10-stage pipeline tracing data from raw source systems to regulatory submissions:
  1. *Source File & Export Collection* (Read-only Excel, SAP MARA/STPO, Devex Specs)
  2. *Batch Ingestion & File Health Checks* (Raw JSONB preservation in staging)
  3. *Column Mapping & Unit Normalization* (AI suggestions with confidence scores + user confirmation)
  4. *Shared Canonical Data Foundation* (Normalized BOM hierarchy and sales)
  5. *Data-Quality Engine & Gap Resolution* (Country matrix DP rules and € risk calculation)
  6. *Source Correction & Re-Import Loop* (**Critical Architecture Rule:** Read-only source; corrections happen in client systems before re-import)
  7. *Four-Eyes Review & Locked Baseline* (Immutable baseline snapshot)
  8. *EPR Regulatory Fee Calculation* (Tonnage × Base Tariff × RAM RAG modulation multiplier)
  9. *Regulatory Submission Export* (UK Defra RPD CSV in official LP submission format)
  10. *Future Module Reuse* (EU PPWR Technical File and Digital Product Passport)

### 4. Architecture & Data Risks (`4. Architecture & Data Risks`)
- 9 critical architecture review findings and design considerations:
  - Multi-Tenant Isolation Across All Tiers (Backend auth, DB queries, RLS, S3 paths).
  - Unknown Values Must Never Silently Default to Zero (Avoid legal fee underpayment).
  - Field-Level Source Lineage & Evidence Traceability (Supplier test certs, batch IDs).
  - Specification & BOM Versioning Drift (Locked snapshots protect prior approved filings).
  - Controlled Material Taxonomy & Composite Splits (Retort pouch multi-material layers).
  - Mapping Template Governance & AI Confirmation (Human signoff on unit conversions).
  - Versioned Regulatory Tariffs & Multipliers (Annual PackUK schedule changes).
  - Data Quality Lifecycle vs Compliance Status (Completeness does not equal legality).
  - Permissive Staging vs Strict Relational Core (Two-tier ingestion architecture).
- **Interactive:** Filter by category (Security, Data Integrity, Regulatory, Architecture) or click to inspect mitigations.

### 5. Roadmap & Decisions (`5. Roadmap & Decisions`)
- **5-Phase Delivery Strategy:** Phase 1 (Jurisdiction Baseline) → Phase 2 (Canonical Model) → Phase 3 (Working EPR Slice) → Phase 4 (Reference Verification) → Phase 5 (PPWR & DPP).
- **Decisions Log:** Full tracking of project decisions `D-001` through `D-008` directly from `docs/DECISIONS.md`.

### 6. Canonical Data Points Reference (`6. Canonical Data Points (DP01–DP45)`)
- Complete reference table of all **45 canonical data points** (DP01 to DP45) from `reference-docs-teams/EPR PPWR Data Points.xlsx` and `docs/DATA_MODEL.md`.
- Searchable by Data Point ID, field name, or regulation; filterable by category (Product Master, Materials & Supplier, Commercial Sales, Governance).

---

## 📋 Implementation Status & Legend

| Badge | Meaning |
|---|---|
| `[PROTOTYPE]` | Currently running in backend prototype (`backend/app/services/store.py` in-memory data store with Kraft Heinz demo data). |
| `[DRAFT SCHEMA]` | Fully specified DDL and relational architecture in `docs/DATABASE_SCHEMA_PLAN.md`, pending team review and PostgreSQL deployment. |
| `[OPEN DECISION]` | Unresolved architectural or product decision recorded in `docs/DECISIONS.md` (e.g. D-004 first jurisdiction signoff, D-006 OIDC identity provider). |
| `[FUTURE SCOPE]` | Planned capability deferred to Phase 5 (EU PPWR Technical File, Digital Product Passport QR resolution). |
