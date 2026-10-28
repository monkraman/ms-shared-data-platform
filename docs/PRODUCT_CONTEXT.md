# Product Context — Shared Product & Packaging Data Platform

## 1. Executive Summary & Vision

Compliance Hub is a multi-tenant shared data foundation designed for enterprise FMCG brand owners, manufacturers, and importers. Instead of treating every emerging environmental regulation (UK Defra RPD, France CITEO, Germany VerpackG, EU PPWR, Digital Product Passports) as a disconnected silo with repetitive data collection, the platform establishes a **single authoritative packaging foundation**.

Packaging specifications (Bill of Materials) and sales volumes are ingested once, normalized into a canonical model, audited for missing data and financial risk, and then leveraged across modular compliance and fee calculation engines.

---

## 2. Core Operational Workflow (The 5-Stage Loop)

```text
[ Client ERP / PLM / Excel Source ]
                 │
                 ▼
    ┌─────────────────────────────┐
    │  Stage 1: Ingestion & Map   │  (One-time mapping template saved per supplier/feed)
    └──────────────┬──────────────┘
                   │
                   ▼
    ┌─────────────────────────────┐
    │  Stage 2: Canonical Storage │  (Products, Packaging Components BOM, Market Sales)
    └──────────────┬──────────────┘
                   │
                   ▼
    ┌─────────────────────────────┐
    │  Stage 3: Data Quality Gate │  (Identifies missing tare weights, unverified PCR%, € risk)
    └──────────────┬──────────────┘
                   │
                   ▼
    ┌─────────────────────────────┐
    │  Stage 4: Source Correction │  (Read-only principle: tickets sent to client for SAP/PLM fix)
    │           & Auto Re-Sync    │  (Re-import matches saved template; zero manual re-mapping)
    └──────────────┬──────────────┘
                   │
                   ▼
    ┌─────────────────────────────┐
    │  Stage 5: Pluggable Modules │  (EPR Calculations, PPWR Dossiers, DPP QR Passports)
    └─────────────────────────────┘
```

---

## 3. Key Architecture Principles

1. **Shared Foundation, Decoupled Modules:**
   - Common master entities (`products`, `packaging_components`, `sales_volumes`) are stored once in canonical relational tables.
   - Compliance-specific logic, tax formulas, and export mappings live exclusively in isolated plugin modules (EPR, PPWR, DPP).

2. **Read-Only Upstream Integration Boundary:**
   - The platform acts as an analytical governance engine and **never overwrites** authoritative client ERP (SAP S/4HANA) or PLM (Trace One Devex) databases directly.
   - When gaps are discovered, a `source_correction_ticket` is dispatched. Client teams update the authoritative record at source, followed by an automated re-sync.

3. **Reusable Mapping Templates:**
   - Upstream field mappings are stored once as versioned templates (`mapping_templates`). Subsequent file uploads or automated API syncs require zero repetitive manual mapping.

4. **Zero Silent Guessing or Zero-Defaulting:**
   - Missing fields (e.g. unknown component weight, missing PCR%, unspecified polymer) are never silently converted to `0` or `false`.
   - Gaps generate explicit blockers or warnings and increase the calculation **Uncertainty Margin (±€)** to protect clients from statutory audit penalties.

5. **Multi-Tenancy Defense-in-Depth:**
   - Client workspaces and consultant assignments are strictly isolated across backend APIs, relational tables, file storage, and audit logs.

---

## 4. Business Modules Roadmap

| Module Code | Module Name | Primary Output | Regulatory Standard |
| :--- | :--- | :--- | :--- |
| **MOD-EPR** | EPR Fee & Compliance Engine | Detailed tonnage breakdowns, RAM eco-modulation fee runs, official Defra RPD CSV export | UK Defra RPD, France CITEO, Germany LUCID |
| **MOD-PPWR** | EU PPWR Compliance Module | Recyclability performance grades (A–E), minimum PCR mandate tracking | EU Packaging & Packaging Waste Regulation |
| **MOD-DPP** | Digital Product Passport | Public consumer QR code resolution, battery/textile digital passport payload | EU ESPR / Battery Regulation |
| **MOD-COST** | Packaging Cost Hotspots | Material cost per 1,000 units, alternative substrate scenario comparisons | Internal procurement & sustainability |
