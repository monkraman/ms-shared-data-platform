# Monkspaces Platform: Enterprise Team Work Breakdown & Delivery Planner

This task board defines the cross-functional backlog for taking the **Monkspaces Shared Product & Packaging Data Platform** from functional prototype into full production enterprise rollout.

---

## Track 1: Packaging Engineering & R&D Team (Packaging Specialists)

| Task ID | Task Title | Description & Acceptance Criteria | Priority | Dependency |
| :--- | :--- | :--- | :---: | :---: |
| **RND-101** | **Trace One PLM Spec Baseline Audit** | Audit the existing 1,400+ Kraft Heinz / client packaging specs in Trace One Devex. Identify components missing gross tare weight (DP08) or component material layer breakdown (DP17). | **P0 (Critical)** | None |
| **RND-102** | **PCR Certificate Verification (ISO 14021)** | Collect and upload supplier certificates for all components claiming $\ge$30% Post-Consumer Recycled (PCR) resin. Validate testing standard against CITEO and UK Plastic Packaging Tax criteria. | **P0 (Critical)** | RND-101 |
| **RND-103** | **Secondary & Tertiary BOM Mapping** | Complete secondary packaging allocation (corrugated cases, shrink film) and tertiary pallet allocation (stretch wrap, corner boards) in SAP/Devex so compliance engine reflects true total gross tonnage. | **P1 (High)** | RND-101 |
| **RND-104** | **Disruptor Pigment & Laminate Review** | Screen multi-material laminate lids (e.g., Philadelphia tub foil) and opaque colorants (carbon black) attracting $+50\%$ CITEO disruptor malus. Evaluate monomaterial PP or clear alternative specs. | **P2 (Medium)** | RND-101 |
| **RND-105** | **PPWR Recyclability Grade Testing (Design for Recycling)** | Prepare laboratory test reports for CEN/CENELEC recyclability grading (A, B, C) ahead of EU PPWR 2030 mandatory design-for-recycling obligations. | **P2 (Medium)** | RND-104 |

---

## Track 2: Regulatory & EPR Compliance Team (Domain Specialists)

| Task ID | Task Title | Description & Acceptance Criteria | Priority | Dependency |
| :--- | :--- | :--- | :---: | :---: |
| **REG-201** | **2025/2026 PRO Tariff Rate Sheets Ingestion** | Ingest and verify latest published packaging fee schedules: France (CITEO/Adelphe), Germany (VerpackG LUCID), UK (Defra RPD), Spain (Real Decreto 1055), and Italy (CONAI). | **P0 (Critical)** | None |
| **REG-202** | **Producer Role Determination Matrix** | Map client legal entities across jurisdictions to determine statutory reporting roles (`BRAND_OWNER`, `PACKER_FILLER`, `IMPORTER`) under UK RPD and EU EPR directives. | **P0 (Critical)** | None |
| **REG-203** | **Defra RPD Packaging Data File Schema Audit** | Validate Monkspaces CSV export against official UK Environment Agency RPD 2026 specification (`packaging_data_example_file_2025_LP_submission_v4.csv`), including Nation data and waste streams. | **P0 (Critical)** | REG-201 |
| **REG-204** | **Eco-Modulation Bonus/Malus Rule Verification** | Formulate automated rules for bonus discounts (e.g. 15% discount for clear PET with certified $\ge$30% PCR) and penalty surcharges (composites, non-separable caps). | **P1 (High)** | REG-201 |
| **REG-205** | **Uncertainty Margin Confidence Scoring Matrix** | Define mathematical threshold formula for uncertainty margin ($\pm$€ liability band) based on unverified supplier certificates or missing secondary BOMs. | **P1 (High)** | REG-204 |

---

## Track 3: Backend & Data Engineering Team (FastAPI / Pipelines)

| Task ID | Task Title | Description & Acceptance Criteria | Priority | Dependency |
| :--- | :--- | :--- | :---: | :---: |
| **BE-301** | **PostgreSQL Persistence & Migration Runner** | Execute `backend/scripts/setup_postgres.py` against staging AWS RDS / Azure PostgreSQL. Transition from in-memory fallback to live PostgreSQL with Asyncpg and SQLAlchemy 2.0. | **P0 (Critical)** | None |
| **BE-302** | **Multi-Tenant Schema Isolation & RLS** | Implement schema-per-tenant (`tenant_khc_europe`, `tenant_aurora_pack`) and Row-Level Security (RLS) policies to guarantee strict data isolation between competing brand clients. | **P0 (Critical)** | BE-301 |
| **BE-303** | **Trace One PLM Read-Only Connector** | Implement scheduled delta extraction pipeline from Trace One Devex API/SFTP with SHA-256 raw payload hashing and audit lineage tracking (DP36–DP40). | **P1 (High)** | BE-301 |
| **BE-304** | **Snowflake / ERP Sales Data ETL** | Build batch ingestion job to extract quarterly Placed-on-Market sales volume (units sold $\times$ gross packaging weight = tonnage) partitioned by ISO country code. | **P1 (High)** | BE-302 |
| **BE-305** | **Automated DQ Engine & Correction Ticket Webhook** | Expand rule engine to execute 15 validation rules on batch ingestion; implement webhook dispatch when correction tickets are routed to PLM teams. | **P1 (High)** | BE-303 |
| **BE-306** | **Streaming Defra RPD CSV Export API** | Implement high-performance streaming response for generating 100,000+ line Defra RPD compliance CSV files with automated checksum validation. | **P2 (Medium)** | REG-203 |

---

## Track 4: Frontend & UI/UX Engineering Team (Angular 19+)

| Task ID | Task Title | Description & Acceptance Criteria | Priority | Dependency |
| :--- | :--- | :--- | :---: | :---: |
| **FE-401** | **Enterprise SSO & JWT Authentication Handshake** | Integrate OAuth2 / PKCE flow with Microsoft Azure Active Directory and Okta SAML so corporate users authenticate into their respective tenant automatically. | **P0 (Critical)** | BE-302 |
| **FE-402** | **Single Point Client Theme Engine Expansion** | Expand `client-theme.config.ts` to allow dynamic client white-labeling (logo, primary colors, currency symbols, and jurisdictional defaults) via tenant API. | **P1 (High)** | None |
| **FE-403** | **Interactive Packaging BOM Tree Canvas** | Enhance `/products` view with interactive visual tree nodes (D3.js or SVG hierarchy) showing component connectivity (Bottle $\rightarrow$ Cap $\rightarrow$ Valve $\rightarrow$ Label). | **P1 (High)** | None |
| **FE-404** | **What-If Scenario Financial Waterfall Chart** | Integrate interactive waterfall chart into `/simulator` displaying: Baseline Fee $\rightarrow$ PCR Bonus $\rightarrow$ Monomaterial Savings $\rightarrow$ Optimized Net Liability. | **P1 (High)** | None |
| **FE-405** | **Responsive Mobile/Tablet Executive Views** | Optimize home dashboard KPI metrics and audit queues for iPad / tablet viewing during executive regulatory sign-off meetings. | **P2 (Medium)** | None |

---

## Track 5: DevOps, Cloud Infrastructure & Security Team

| Task ID | Task Title | Description & Acceptance Criteria | Priority | Dependency |
| :--- | :--- | :--- | :---: | :---: |
| **OPS-501** | **Docker Compose & Container Registry Setup** | Create multi-container Docker Compose definition (`backend`, `frontend`, `postgres`, `redis`) and publish container images to private registry. | **P0 (Critical)** | BE-301 |
| **OPS-502** | **CI/CD Automated Test & Lint Pipeline** | Configure GitHub Actions / GitLab CI pipeline to run Pytest (16 tests) and Angular Vitest (all specs) on every pull request with zero tolerance for build regressions. | **P0 (Critical)** | None |
| **OPS-503** | **SOC 2 Type II Compliance & Audit Trail Logging** | Implement immutable audit logging for all data access, export generation, and user role changes to satisfy SOC 2 and client security audits. | **P1 (High)** | BE-302 |
| **OPS-504** | **Read-Only Network Isolation Controls** | Configure AWS Security Groups / Azure Virtual Network service endpoints ensuring connector workers cannot write back into client PLM systems. | **P1 (High)** | BE-303 |

---

## Track 6: Quality Assurance & Reconciliation Testing (QA Team)

| Task ID | Task Title | Description & Acceptance Criteria | Priority | Dependency |
| :--- | :--- | :--- | :---: | :---: |
| **QA-601** | **PLM Spec vs Canonical Data Reconciliation** | Execute automated diff comparisons between raw Trace One JSON extracts and canonical DP01–DP45 entities; verify zero field truncation or rounding errors. | **P0 (Critical)** | BE-303 |
| **QA-602** | **Fee Calculation Verification against Historical Filing** | Compare Monkspaces calculation engine output against actual 2024 CITEO and Defra fee paid invoices for Kraft Heinz flagship products; variance must be $\le 0.5\%$. | **P0 (Critical)** | REG-201 |
| **QA-603** | **Multi-Tenant Isolation Penetration Test** | Verify that Tenant A (Kraft Heinz) cannot query or observe any product, spec, or calculation belonging to Tenant B (Aurora Packaging) under any circumstance. | **P0 (Critical)** | BE-302 |
| **QA-604** | **End-to-End Onboarding & Simulator Workflow Test** | Execute automated Playwright/Cypress end-to-end tests from client onboarding $\rightarrow$ BOM inspection $\rightarrow$ DQ ticket dispatch $\rightarrow$ fee export. | **P1 (High)** | FE-401 |
