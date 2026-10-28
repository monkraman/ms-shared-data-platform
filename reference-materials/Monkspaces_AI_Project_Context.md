# Monkspaces Product Platform — Persistent Project Context & AI Vibe-Coding Guide

> Version 1.0 | Prepared 26 October 2026

> **Purpose:** Keep AI coding assistants aligned on product vision, architecture, scope, data, integrations, testing, and delivery. This is a working baseline; unverified assumptions are explicitly marked.


## 1. Purpose of this document

This document is the durable context pack for AI coding assistants used to build the Monkspaces product platform. Add it to the coding tool's project knowledge/context, or paste the “Master AI Instruction” section into the assistant's project instructions.

It describes the product vision, confirmed decisions, proposed architecture, MVP scope, data concepts, workflows, delivery approach, testing rules, and open questions. Treat it as the current working baseline—not as proof that unverified client systems or regulatory assumptions are confirmed.

Keep this file in the repository (for example, /docs/PRODUCT_CONTEXT.md) and update it when product decisions change. The repository and approved product decisions should be the source of truth.


## 2. Product vision

Build a shared product and packaging data platform for Monkspaces. The platform collects product/packaging information from files and external business systems, standardizes it into a central data foundation, continuously checks data quality, supports correction/review workflows, and enables separate business modules to reuse the same trusted data.

Initial business module: EPR (Extended Producer Responsibility) calculation and analysis for one agreed jurisdiction. Future modules may include PPWR, Digital Product Passport (DPP), costing, and other product-compliance workflows.

The platform is not just an EPR calculator. Its differentiator is the shared data foundation plus data-quality improvement and traceable workflows that support multiple modules.


## 3. Core product principles

One canonical shared data foundation; multiple independently scoped business modules.

Separate raw source data, normalized/canonical records, quality findings, approved corrections, rule versions, and calculation runs.

Preserve source lineage: where a value came from, when it was imported, the source record/file, any transformation, and who changed or approved it.

Never silently guess missing material categories, units, weights, markets, exemptions, or regulatory rates. Flag uncertainty and make it visible.

Data quality status is distinct from regulatory/compliance status. A complete record is not automatically compliant.

Approved calculations must be reproducible using the exact input snapshot and version of the rules used at calculation time.

Start with a modular monolith, not microservices. Keep clear module boundaries so extraction is possible later if justified.

Use CSV/Excel imports first to unblock product development. Prove one external read-only integration when access and documentation are available.

Do not include bidirectional sync or write-back in MVP unless explicitly agreed and verified with the client/source-system owner.

Build thin end-to-end vertical slices and test continuously; do not wait for every frontend or backend component to be complete before integration.


## 4. Users and roles (provisional)

Platform/Super Admin: manages platform-level configuration and tenant onboarding; exact responsibilities require confirmation.

Organisation Admin: manages users and settings within an organisation/tenant.

Data Steward / Analyst: imports data, reviews quality issues, proposes corrections, and examines calculation results.

Approver / Compliance Reviewer: reviews and approves changes or rule sets where authorized.

Read-only Stakeholder: views approved data, reports, and calculation results.

Role names and permission boundaries are provisional. Enforce permissions on the backend, not only by hiding frontend controls.


## 5. Main end-to-end workflow

1. Collect product master, packaging/BOM, material, market/sales volume, supplier and supporting evidence data from client files or verified integrations.

2. Preserve original files and source references securely; create an import batch and report parse/validation errors.

3. Map source fields to canonical fields; normalize known units and controlled vocabularies while preserving original values and transformation metadata.

4. Store canonical records in PostgreSQL and flexible, source-specific attributes in JSONB only where appropriate.

5. Run data-quality rules and create issues with affected record, field, rule ID, severity, explanation, and suggested next action.

6. Assign issues to owners; submit corrections; route approvals when required; retain before/after values, actor, timestamp, reason and evidence.

7. Re-run relevant validations after a correction and retain the issue history.

8. Select jurisdiction and reporting period; use an approved, versioned rule set and required input data to calculate EPR estimates.

9. Persist the calculation run, input snapshot/reference, rule version, line-item breakdown, exclusions, warnings and totals.

10. Show results and data-quality hotspots; add simple scenario comparisons only after the baseline calculation is validated.

11. Export reports or share results with appropriate access controls. External write-back is a later decision, not assumed.


## 6. Proposed architecture and technology stack

Frontend: Angular + TypeScript. Use feature areas for product/packaging, imports, data quality/issues, rule administration, EPR calculations, analytics, and administration.

Backend: Python + FastAPI for REST APIs, validation, ingestion and calculation logic. Keep business logic out of route handlers and organize it into domain/service modules.

Database: PostgreSQL for tenant/orgs, products, packaging components, materials, suppliers, markets, reporting periods, import batches, quality issues, workflow, rule versions, and calculation runs.

Flexible attributes: PostgreSQL JSONB only for variable or source-specific fields; do not put the entire data model into one JSON blob.

Files/evidence: private object storage such as S3-compatible storage or Azure Blob, selected according to Monkspaces/client hosting and security requirements.

Authentication: OAuth 2.0 / OpenID Connect using an approved identity provider. Prefer an existing company/client identity provider where feasible.

Testing: pytest for backend unit tests; API integration tests; Angular unit and end-to-end tests using the team's chosen supported framework; automated build/lint/test in CI.

Delivery: Docker and managed hosting. Use the company's approved Git platform/CI service. Kubernetes is not required for the initial MVP unless an existing platform standard requires it.

Observability: structured logs, health checks, import status, correlation/request IDs and operational metrics. Never log secrets; minimize sensitive client data in logs.

Architecture style: modular monolith with explicit boundaries between ingestion, canonical data, quality workflow, regulatory rules, EPR calculation, reporting, identity and audit.


## 7. Conceptual data model

Organisation/Tenant: customer boundary, settings and lifecycle.

User and Role/Permission: identity mapping and authorized actions.

SourceSystem: source name/type, connection metadata reference, integration status and sync policy; secrets must live in a secret manager, not ordinary DB fields.

ImportBatch: source/file, upload actor/time, status, row counts, errors, mapping version and source checksum/reference.

SourceRecord / Lineage: source system, source record key, import batch, original values and canonical mapping provenance.

Product: tenant, source identifiers, SKU/product code, name, category, brand/owner and lifecycle/status.

PackagingComponent: component identifier, parent product or packaging structure, packaging level, material reference, weight/value and unit, market applicability where relevant.

Material: controlled material code/name, category/subcategory and jurisdiction-specific attributes as required.

Supplier: supplier identity and relevant product/packaging relationships.

Market / Jurisdiction and ReportingPeriod: market/country/scheme and reporting period; the exact taxonomy needs product/regulatory approval.

DataQualityRule and DataQualityIssue: rule/version, affected entity/field, severity, status, owner, explanation and timestamps.

CorrectionRequest / ApprovalEvent: proposed changes, old/new values, reason/evidence, submitter, reviewer, decision and audit history.

RuleSet / RuleVersion / FeeSchedule: jurisdiction, effective dates, source/evidence, status, version and approval. Approved versions should be immutable.

CalculationRun / CalculationLine: run ID, tenant, jurisdiction, reporting period, input snapshot/version, rule version, calculation timestamp, line-item amounts, assumptions, exclusions, warnings and total.

AuditEvent: actor, action, entity, timestamp, reason/correlation ID and before/after reference where appropriate.

This is a conceptual starting point, not a final database schema. Finalize it using representative client data, reporting requirements, query patterns, tenancy/security needs and approved jurisdiction rules.


## 8. Data ingestion and integration approach

Stage 1: CSV/Excel upload with import batch tracking, field mapping, validation, duplicate handling and actionable error reporting.

Stage 2: One verified read-only integration proof with a selected source system (ERP, PLM/Trace One or Snowflake) after API/export options, authentication, permissions, rate limits, pagination, network access and data ownership are confirmed.

Stage 3: Scheduled sync or event-driven updates only if the source supports them and the client approves cadence, conflict rules and operational ownership.

Stage 4: Consider write-back only after explicit requirements, source API capability, authorization, conflict resolution, audit and rollback strategy are agreed.

Do not assume Trace One or any ERP exposes the required API or that Snowflake access is immediately available. Use mock responses/CSV while access is pending.

Store connection secrets in an approved secret manager. Use least-privilege, read-only credentials for initial connectors and document data retention/deletion requirements.


## 9. MVP scope and exclusions

In scope for the 8-week focused proof-of-value target: one selected EPR jurisdiction; sample/approved representative product and packaging data; CSV/Excel import; core canonical records; baseline data-quality rules; issue/correction/approval history; one versioned rule set; explainable EPR calculations; calculation history; simple hotspot view; basic scenario comparison if time permits; automated tests; staging deployment and demo.

Explicitly not guaranteed in 8 weeks: complete production SaaS hardening, multi-jurisdiction regulatory coverage, all ERP/PLM/Snowflake connectors, bidirectional sync, automated regulatory interpretation, full PPWR/DPP/costing modules, advanced forecasting, large-scale enterprise performance or independent certification.

Treat the 8-week plan as a target for a narrow proof-of-value, not a commitment until team capacity, client data, rulebook, source access and acceptance criteria are confirmed.


## 10. Delivery plan and parallel workstreams

Day 0: kick-off; define first jurisdiction and MVP; assign owners; request sample data, data dictionary, approved EPR rules, reference calculation cases, API docs and sandbox access; create repository, environments, decision log and test strategy.

Week 1: architecture and API contracts; schema draft; Angular shell; FastAPI skeleton; CI and test framework; client data profiling starts.

Week 2: import staging and mapping; product/packaging APIs and UI; first end-to-end vertical slice (file → validation → database → API → UI).

Week 3: data-quality rules and issue queue; continue regulatory discovery; start validation and integration tests.

Week 4: correction submission/review/approval, revalidation and audit trail; finalize versioned rule model.

Week 5: implement one-jurisdiction EPR engine using approved rules and expected outputs.

Week 6: persist reproducible calculation runs; fee breakdown UI; complete integration feasibility findings.

Week 7: simple hotspot dashboard/scenario comparison; tenant/permission checks; regression and operational hardening.

Week 8: UAT, reconciliation, defect closure, demo, known-limitations list, pilot go/no-go and next-phase backlog.

Parallel tracks: (A) architecture/data/client discovery, (B) backend/import, (C) frontend, (D) data quality/workflow, (E) EPR rules/calculation, (F) QA/DevOps/security. Keep shared API contracts and weekly integration demos to avoid silos.

Weekly governance: demo working software, review blockers/risks, record decisions, update task owners/status and show test evidence. Daily stand-up should focus on progress, next action and blockers.


## 11. Testing and acceptance standards

Every feature has acceptance criteria before implementation and tests before it is considered done.

Every pull request: formatting/lint/build and relevant automated tests pass.

Import tests cover valid files, missing columns, malformed rows, duplicate records, encoding, unknown units and partial failures.

Normalization tests cover conversions and controlled vocabulary mappings; retain original source values and conversion evidence.

Data-quality tests cover issue creation, severity, assignment, correction, approval/rejection, revalidation and audit history.

Security tests include unauthorized actions and cross-tenant access attempts; backend must enforce tenant boundaries.

EPR tests must use SME/client-approved expected results for at least three representative cases. Test missing inputs, boundary conditions, effective dates, exclusions and repeatability.

Each calculation result must identify the rule version, reporting period, inputs, assumptions, warnings and line-item breakdown.

Dashboard aggregates must reconcile to the underlying calculation totals. Scenario outputs must not mutate the baseline run.

Release readiness includes regression tests, UAT evidence, known defects, backup/restore expectations, monitoring/logging checks and explicit go/no-go decision.


## 12. Security, privacy and governance

Enforce tenant isolation at the API and data-access layers; evaluate PostgreSQL row-level security with security review.

Use least privilege, role-based authorization, secure secret storage, TLS, encryption at rest where supported, and approved retention/deletion policies.

Keep audit events for imports, data changes, approvals, rule changes and calculation runs.

Do not put real client data, credentials, access tokens or secrets into public AI tools, source control, sample prompts or logs unless expressly approved under company policy.

Use synthetic or anonymized sample data for development where possible.

Approved regulatory rule versions and calculation evidence must be retained according to the agreed audit and retention requirements.


## 13. Open questions that must not be guessed

Which jurisdiction, EPR scheme and reporting year are first?

Who is the regulatory/compliance subject-matter expert and who approves rule interpretations?

What exact products, packaging levels, materials, weights, units, sales volumes and markets are available?

What are the client systems and exact products/versions involved (ERP, PLM/Trace One, Snowflake or others)?

Are APIs available? Which endpoints, authentication method, scopes, rate limits, network restrictions and sandbox credentials exist?

How often should data refresh? What is the source of truth when systems disagree? Is write-back required at all?

What hosting/cloud, identity provider, CI/CD, data residency, retention and security standards are mandatory?

Which tenant model and user roles are required?

What output formats and calculation breakdowns does the client expect?

What is the team's actual capacity and who owns each workstream?

Which scope is mandatory for the demo versus a later production release?


## 14. Working instructions for AI coding assistants

Read this context document and the existing repository before proposing or changing code. Identify the current state and report relevant files, existing patterns and gaps.

Do not blindly replace working code or scaffold a new app if the repository already contains useful implementation. Reuse relevant code, components, API clients, types, tests and configuration.

Before coding a feature: state the goal, acceptance criteria, files likely to change, data/API assumptions and tests. If an assumption materially changes architecture or business behavior, ask for confirmation rather than inventing it.

Make small, reviewable changes. Preserve unrelated behavior. Do not delete existing documentation, migrations, configuration or assets unless explicitly asked and the impact is understood.

Use typed request/response schemas, server-side validation, explicit error handling, authorization and tests. Avoid business logic inside Angular components or FastAPI route handlers.

Keep API contracts, database migrations, docs and tests in sync. Never silently rename public fields or break existing endpoints.

Never invent EPR formulas, rates, exemptions, classifications, units or legal requirements. Implement only approved rule specifications and encode known examples as regression tests.

Never claim an integration works without running it against a real approved sandbox or clearly labeling a mock. When credentials/access are missing, build a documented adapter interface and mock implementation.

After each task, report: files changed, behavior implemented, tests run and results, assumptions, remaining risks, and next recommended task.

Update this context and the relevant docs when an approved architecture, scope, data contract or product decision changes. Record material decisions in an ADR/decision log.

Do not expose secrets. Use environment variables and the approved secret manager; include only placeholder values in examples.

Prefer accessible, consistent UI and practical workflows over unnecessary AI-generated copy or decorative complexity. Show only information users need for their task.


## 15. Master AI Instruction (copy into your coding assistant)

```text
You are the implementation partner for the Monkspaces shared product and packaging data platform. First read this entire project context and inspect the existing repository. The platform centralizes product/packaging data, improves data quality through traceable correction and approval workflows, and supports separate modules. The initial target is a focused EPR proof-of-value for one client-approved jurisdiction. Use Angular + TypeScript, FastAPI + Python, PostgreSQL, private object storage and OIDC/OAuth2 as the proposed baseline, subject to existing repository and company standards. Build a modular monolith with explicit domain boundaries. Start with CSV/Excel import and prove one external read-only connector only when access is verified. Preserve source lineage, audit history, tenant isolation, versioned regulatory rules and reproducible calculation runs. Keep data quality separate from compliance status. Do not invent client APIs, data fields, regulatory rules or expected calculations. Use approved sample data and SME-approved reference cases. Implement small vertical slices with tests, clear acceptance criteria, secure defaults and documentation. Before coding, summarize current repository state, the next smallest valuable slice, assumptions and test plan. After coding, report changed files, tests and results, unresolved questions and next steps. Ask before making irreversible, broad, or architecture-changing edits. Treat this document as a working baseline; newer explicit product decisions and repository evidence supersede it.
```


## 16. Recommended repository documentation

- `/docs/PRODUCT_CONTEXT.md — this persistent product context.`

- `/docs/ARCHITECTURE.md — component diagram, module boundaries, runtime/deployment and security model.`

- `/docs/DATA_MODEL.md — ERD, field definitions, relationships, lineage and canonical vocabulary.`

- `/docs/API_CONTRACTS.md or generated OpenAPI docs — endpoints, schemas, errors and auth requirements.`

- `/docs/INTEGRATIONS.md — connector status, setup, permissions, mapping and known limitations.`

- `/docs/EPR_RULES.md — jurisdiction-specific approved rule specification, effective dates and evidence.`

- `/docs/TEST_STRATEGY.md — test layers, fixtures, reference cases and release gates.`

- `/docs/DECISIONS.md — dated architecture/product decisions, rationale and consequences.`

- `/docs/CHANGELOG.md — user-visible changes and migrations.`

Keep credentials out of docs. Link to approved secret-management instructions instead.


## 17. Change log and authority

Version 1.0 — 26 October 2026: Initial working context created from the product vision and planning decisions discussed so far.

Confirmed working direction: shared product/packaging data foundation; data-quality and correction workflows; EPR as the initial business module; future PPWR/DPP/costing modules; Angular frontend; FastAPI/Python and PostgreSQL proposed; CSV-first integration approach; parallel workstreams and continuous testing.

Still to confirm: exact jurisdiction/rules, final schema, source-system APIs, hosting, identity provider, tenancy/security design, team allocation and client acceptance criteria.

Authority order when information conflicts: (1) latest explicit approved product decision, (2) accepted repository implementation/specification, (3) this context document, (4) assistant assumptions. Surface conflicts instead of silently resolving them.
