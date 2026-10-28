# Monkspaces Platform — Architectural Assumptions & Unresolved Decisions

> **Document Status:** Architectural Review Baseline  
> **Source of Truth:** Workspace documentation (`docs/ARCHITECTURE.md`, `docs/DATABASE_SCHEMA_PLAN.md`, `docs/DATA_MODEL.md`, `docs/DECISIONS.md`, `docs/PRODUCT_CONTEXT.md`, and `reference-docs-teams/`).

This document records the explicit architectural assumptions, prototype implementation boundaries, and currently open decisions identified during the technical review.

---

## 1. Prototype vs. Proposed Production Architecture

To maintain engineering integrity, the current state of implementation must be distinguished from the proposed target design:

| Architectural Tier | Current Prototype Implementation | Proposed Production Design (docs/DATABASE_SCHEMA_PLAN.md) |
|---|---|---|
| **Database Persistence** | In-memory Python data store (`backend/app/services/store.py`) pre-seeded with Kraft Heinz Europe demo portfolio. | PostgreSQL 15+ database with 17 strongly-typed relational tables and GIN-indexed `JSONB` extension columns. |
| **Multi-Tenant Security** | Request dependency extracting `X-Tenant-ID` header; in-memory dictionary filtering. | Backend authentication + PostgreSQL Row-Level Security (`RLS`) policies enforcing tenant boundary at the SQL engine level. |
| **Object & Evidence Storage** | Mock file references in local JSON fixtures. | Private, encrypted, tenant-scoped S3-compatible / Azure Blob storage with presigned URLs and immutable retention. |
| **Background Processing** | Synchronous REST endpoints. | Asynchronous Celery / Redis worker queue for multi-thousand row spreadsheet parsing and bulk calculation runs. |
| **EPR Regulatory Engine** | Python calculation service with illustrative PackUK 2026/27 and CITEO tariffs. | Versioned regulatory rule sets (`jurisdiction_rule_sets`) with immutable frozen calculation snapshots (`locked_snapshots`). |

---

## 2. Key Working Assumptions

1. **Read-Only Source System Boundary:**
   - Monkspaces acts strictly as an analytical and regulatory aggregation engine.
   - It **does not write back** directly into client ERP (SAP S/4HANA) or PLM (Trace One Devex) systems.
   - When data quality gaps or spec mismatches are discovered, Monkspaces issues a `source_correction_ticket`. The client team updates the authoritative record in their source system, followed by a controlled re-import into Monkspaces.

2. **Decoupled Canonical Foundation vs. Compliance Modules:**
   - Core packaging and product master data (`products`, `packaging_components`, `component_materials_split`, `sales_placed_on_market`) must remain agnostic to specific country regulations.
   - Regulatory fee schedules, eco-modulation formulas, and export mappings live exclusively in compliance modules (EPR, PPWR, DPP).

3. **No Silent Guessing or Zero-Defaulting:**
   - Missing data (e.g., component weight, recycled content percentage, polymer type) must **never** be silently converted to `0` or `false`.
   - Missing required data is treated as an explicit gap in Layer 2, generating a `BLOCKER` or `WARNING` and adding to the calculation fee uncertainty margin.

4. **Reproducibility Through Immutability:**
   - Every official compliance calculation must link to an immutable snapshot (`locked_snapshots`) that freezes the exact BOM and sales state at filing time.
   - Subsequent changes to packaging specifications or ERP master data will not alter historical filings.

5. **Multi-Tenancy Defense-in-Depth:**
   - Client workspaces and consultant assignments must be isolated at every level (routes, queries, background jobs, object storage, exports).
   - Frontend UI filtering is purely for user experience and is never relied upon for data isolation.

---

## 3. Unresolved Decisions Log (Direct from docs/DECISIONS.md)

The following architectural and product decisions are currently **Open** or **Proposed** and require formal domain and executive sign-off:

### Decision D-004: First EPR Jurisdiction & Reporting Workflow
- **Status:** Open
- **Owner:** Product Owner + Domain Reviewer
- **Context:** The platform architecture supports UK Defra RPD, France CITEO, and Germany VerpackG. The MVP vertical slice proposes UK Defra RPD as the first jurisdiction.
- **Unresolved Aspect:** Formal agreement on the exact reporting period (2025-H1/H2) and authoritative tariff schedule baseline (PackUK illustrative 2026/27 vs 2025 interim rates) is required before freezing calculation validation tests.

### Decision D-005: Consultant-Only vs. Direct Client Contributor Logins
- **Status:** Open
- **Owner:** Product Owner
- **Context:** The initial operational model is tailored for Monkspaces consultants managing multiple client workspaces.
- **Unresolved Aspect:** Whether direct client users (contributors, approvers) will be granted portal logins in the MVP release or restricted to consultant-mediated operations.

### Decision D-006: Hosting, OIDC Identity Provider, Data Residency & Retention
- **Status:** Open
- **Owner:** IT & Security Leads
- **Context:** Enterprise client contracts (FMCG sector) require strict data residency and access controls.
- **Unresolved Aspect:** Selection of the primary corporate OIDC identity provider (Okta, Azure AD, Auth0), cloud region (UK vs EU data residency), S3 object lifecycle policies, and evidence document retention timelines.

### Decision D-007: Canonical Schema & Polymer Taxonomies
- **Status:** Open
- **Owner:** Engineering + Domain Reviewer
- **Context:** Harmonizing material classifications across SAP material groups, PLM classes, and national EPR recyclability guides (DP01–DP45).
- **Unresolved Aspect:** Validation of the standard polymer taxonomy (PET, HDPE, PP, LDPE, PVC, etc.) against real-world client SAP MARA/STPO extracts to avoid unmapped material exceptions.

### Decision D-008: Client Sample Dataset & Verified Reference Case
- **Status:** Open
- **Owner:** Client Lead
- **Context:** Automated acceptance testing requires reconciling calculation outputs against an independently reviewed, known-good reference report.
- **Unresolved Aspect:** Securing an approved, verified client benchmark dataset (with audited tonnage and fee numbers) to serve as the golden test suite for the calculation engine.

---

## 4. Database Schema Design Review Findings

From the review of `docs/DATABASE_SCHEMA_PLAN.md`:

1. **Two-Tier Ingestion Design:**
   - `raw_staged_records` uses `JSONB` with loose constraints during initial upload to prevent file upload failures.
   - Strict relational foreign keys are enforced only upon transformation into Layer 1 canonical tables (`products`, `packaging_components`).

2. **Composite Packaging Handling:**
   - The `component_materials_split` table correctly resolves the N-layer laminate problem (e.g., retort pouches with PET/Alu/PP layers), allowing granular RAM eco-modulation without corrupting the parent component entity.

3. **Line-Item Explainability:**
   - `calculation_line_items.calculation_formula_text` persists the human-readable calculation formula (`Units × Weight = Tonnage × Base Tariff × Multiplier = Line Fee`), providing full transparency for regulatory audit inquiries.
