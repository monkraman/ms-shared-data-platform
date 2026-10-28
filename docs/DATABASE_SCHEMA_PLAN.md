# Monkspaces Compliance Platform — Scalable Database Architecture & Schema Plan

> **Version:** 1.0 | **Status:** Draft for Team Review  
> **Source References:**  
> - `reference-docs-teams/compliance-hub-demo-screens-v4 (1).pdf` (Screens 1 to 23, especially Screen 8: Column Mapping & Screen 5: Packaging Tree)  
> - `reference-docs-teams/page-priority-map-v3.png` (4-Module Architecture)  
> - `reference-docs-teams/EPR PPWR Data Points.xlsx` (DP01 to DP45)  
> - `reference-docs-teams/packaging_data_example_file_2025_LP_submission_v4.csv` (UK Defra RPD Format)

---

## 1. Architectural Strategy: Relational Core + Hybrid JSONB

To ensure enterprise-grade scalability, query performance, and flexibility without requiring frequent database migrations:
1. **Relational Core (Structured):** Canonical business entities (Tenants, Products, Packaging Components, Materials, Fee Calculations, Quality Issues) are strongly-typed relational tables with indexed foreign keys.
2. **PostgreSQL JSONB (Flexible Attributes):** Proprietary external system metadata (SAP custom flags, raw source payloads, future PPWR extension attributes) are stored in `JSONB` columns with GIN indexing.
3. **Multi-Tenant Isolation:** Every tenant-owned table enforces `tenant_id` as the primary scoping filter (ready for PostgreSQL Row-Level Security `RLS`).
4. **Modular Domains:** Tables are grouped into 6 decoupled domains, making extraction into microservices straightforward if load warrants it.

---

## 2. Entity-Relationship Overview

```
[Tenancy & Onboarding]
   ├── tenants
   ├── tenant_markets_enabled (UK, DE, FR, etc.)
   └── tenant_integrations (Devex, Snowflake, SAP)

[Ingestion & Mapping Engine]
   ├── ingestion_batches
   ├── mapping_templates (e.g. 'Heinz_Devex_v1')
   │     └── mapping_template_fields (source_column -> target_dp_id, unit conversions)
   └── raw_staged_records

[Layer 1: Shared Canonical Data Foundation]
   ├── products (SKU, GTIN, Brand, Category)
   ├── packaging_components (BOM hierarchy: Primary, Secondary, Tertiary)
   │     └── component_materials_split (Multi-material composition %)
   ├── suppliers
   └── sales_placed_on_market (Units sold per country/period)

[Layer 2: Data Quality & Gap Resolution]
   ├── data_quality_rules (Country & Sector requirements matrix)
   ├── data_quality_issues (€ at risk, severity, target country)
   ├── source_correction_tickets (Sync with Devex/SAP)
   └── locked_snapshots (Four-eyes reviewed, immutable baseline)

[Layer 3: Compliance & Fee Plugins]
   ├── jurisdiction_rule_sets (Versioned tariffs & RAM multipliers)
   ├── calculation_runs
   ├── calculation_line_items (Tonnage x Tariff x Modulation)
   └── uk_rpd_export_lines (Official Defra submission aggregation)
```

---

## 3. Detailed Domain Schema Specifications

### Domain 1: Tenancy, Onboarding & Workspace Access

```sql
-- 1. Tenant / Client Workspace
CREATE TABLE tenants (
    id VARCHAR(50) PRIMARY KEY,                    -- e.g. 'khc-europe', 'northfield-foods'
    name VARCHAR(255) NOT NULL,
    sector VARCHAR(100) NOT NULL,                  -- 'Food & beverage', 'Cosmetics', etc.
    organisation_size VARCHAR(10) DEFAULT 'L',     -- 'L' (Large), 'S' (Small)
    rpd_organisation_id VARCHAR(50),               -- DP29: UK Defra RPD ID (e.g. '100004')
    primary_currency VARCHAR(3) DEFAULT 'EUR',     -- 'EUR', 'GBP'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enabled Markets / Jurisdictions per Tenant (From Onboarding Wizard Screen 2)
CREATE TABLE tenant_markets_enabled (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
    country_code VARCHAR(10) NOT NULL,             -- 'UK', 'FR', 'DE', 'ES', 'IT', 'NL', 'DK', 'CA-ON'
    regulation_code VARCHAR(50) NOT NULL,          -- 'UK_PEPR', 'CITEO_EPR', 'VERPACKG', 'SB54'
    is_active BOOLEAN DEFAULT TRUE,
    producer_role VARCHAR(50) DEFAULT 'BRAND_OWNER', -- DP28: Brand Owner, Packer/Filler, Importer
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, country_code, regulation_code)
);

-- 3. External System Connectors Config
CREATE TABLE tenant_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
    system_type VARCHAR(50) NOT NULL,              -- 'TRACE_ONE_DEVEX', 'SNOWFLAKE', 'SAP_S4HANA', 'MANUAL_EXCEL'
    status VARCHAR(50) DEFAULT 'active',           -- 'connected', 'mocked', 'failing'
    connection_config JSONB,                       -- Host, endpoint, secret_ref (no plaintext credentials)
    last_synced_at TIMESTAMPTZ
);
```

---

### Domain 2: Ingestion & Column Mapping Engine (Mockup Screen 8)

Stores user-confirmed column mappings, AI suggestions, and unit transformation rules so future syncs run automatically.

```sql
-- 4. Ingestion Batches
CREATE TABLE ingestion_batches (
    id VARCHAR(50) PRIMARY KEY,                    -- e.g. 'BATCH-2026-03-001'
    tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
    source_system VARCHAR(50) NOT NULL,            -- 'TRACE_ONE_DEVEX', 'SUPPLIER_PORTAL', 'EXCEL_UPLOAD'
    filename VARCHAR(255),
    total_rows INT DEFAULT 0,
    accepted_rows INT DEFAULT 0,
    flagged_rows INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'processing',       -- 'staged', 'mapped', 'completed', 'failed'
    uploaded_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Mapping Templates (Reusable mapping per supplier / ERP feed)
CREATE TABLE mapping_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
    template_name VARCHAR(100) NOT NULL,           -- e.g. 'FlexiPak_Supplier_Specs_v1', 'SAP_MARA_STPO_Export'
    source_type VARCHAR(50) NOT NULL,              -- 'SUPPLIER_SHEET', 'ERP_SPEC', 'SALES_FEED'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Column Mapping Rules (Their Column -> Our Canonical DP Field)
CREATE TABLE mapping_template_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES mapping_templates(id) ON DELETE CASCADE,
    source_column_name VARCHAR(100) NOT NULL,      -- e.g. 'Wt (kg)', 'Part desc.', 'Item_No'
    target_data_point_id VARCHAR(20) NOT NULL,     -- e.g. 'DP09', 'DP04', 'DP01'
    target_canonical_field VARCHAR(100) NOT NULL,  -- e.g. 'weight_grams', 'component_type', 'sku'
    confidence_score DECIMAL(5,2),                 -- e.g. 92.00 (92% confidence from AI suggestion)
    unit_transformation VARCHAR(50),               -- e.g. 'KG_TO_GRAMS', 'LBS_TO_GRAMS', 'UPPERCASE', 'NONE'
    default_fallback_value TEXT,
    is_user_confirmed BOOLEAN DEFAULT TRUE
);
```

---

### Domain 3: Layer 1 — Shared Canonical Data Foundation

Stores normalized master products, packaging trees (BOM), materials, and sales quantities.

```sql
-- 7. Products (Canonical Master)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,                     -- DP01: SKU Code (e.g. 'NF-SO-400')
    gtin VARCHAR(50),                              -- DP02: Barcode / EAN-13 (e.g. '05012345678900')
    name VARCHAR(255) NOT NULL,                    -- Product Commercial Name
    brand VARCHAR(100) NOT NULL,                   -- e.g. 'Heinz', 'Northfield'
    category VARCHAR(100) NOT NULL,                -- e.g. 'Food & beverage · Soups & sauces'
    status VARCHAR(50) DEFAULT 'active',
    source_metadata JSONB,                         -- Extra unmapped fields from SAP/Devex preserved losslessly
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, sku)
);

-- 8. Packaging Components (BOM Tree - Primary, Secondary, Tertiary)
CREATE TABLE packaging_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    component_code VARCHAR(50),                    -- Internal or Supplier part number
    name VARCHAR(255) NOT NULL,                    -- DP03: 'Retort pouch body', 'Closure HDPE'
    packaging_level VARCHAR(20) NOT NULL,          -- DP04: 'PRIMARY', 'SECONDARY', 'TERTIARY'
    units_per_pack INT DEFAULT 1,                  -- DP05: e.g. 24 for secondary 24-pack tray
    main_material VARCHAR(50) NOT NULL,            -- DP06: 'PLASTIC', 'PAPER_CARDBOARD', 'GLASS', 'ALUMINIUM', 'STEEL'
    polymer_type VARCHAR(50),                      -- DP07: 'PET', 'HDPE', 'PP', 'LDPE', 'PVC'
    weight_grams NUMERIC(12,4),                    -- DP09: Empty weight in grams (NULL if missing -> Gap!)
    recycled_content_pct NUMERIC(5,2) DEFAULT 0,   -- DP13: PCR % (0-100)
    ram_rag_rating VARCHAR(10),                    -- DP12: UK RAM Rating ('RED', 'AMBER', 'GREEN', 'RED_MODULATED')
    colour_opacity VARCHAR(100),                   -- DP10: e.g. 'Clear / Light Blue', 'Carbon Black'
    has_disruptor_pigment BOOLEAN DEFAULT FALSE,   -- DP11: NIR sortation inhibitor
    is_reusable BOOLEAN DEFAULT FALSE,             -- DP15: Reusable vs single-use
    is_food_contact BOOLEAN DEFAULT TRUE,          -- DP16: Food contact declaration flag
    supplier_id UUID,                              -- DP43: Supplier link
    evidence_document_id UUID,                     -- DP14: Linked test cert / ISO spec sheet
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Multi-Material Splits (For Composites / Laminates like Retort Pouch PET/Alu/PP)
CREATE TABLE component_materials_split (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID REFERENCES packaging_components(id) ON DELETE CASCADE,
    layer_order INT NOT NULL,                      -- 1 (Outer), 2 (Barrier), 3 (Sealant)
    material_name VARCHAR(100) NOT NULL,           -- e.g. 'PET 12 µm', 'Aluminium foil 9 µm', 'Cast PP 70 µm'
    percentage_by_weight NUMERIC(5,2) NOT NULL,    -- DP08: e.g. 45.00%, 15.00%, 40.00%
    thickness_microns NUMERIC(8,2)
);

-- 10. Commercial Sales & Volume Placed on Market
CREATE TABLE sales_placed_on_market (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    country_code VARCHAR(10) NOT NULL,             -- DP24: 'UK', 'FR', 'DE', 'ES', etc.
    reporting_period VARCHAR(20) NOT NULL,         -- DP33: '2025-H1', '2025-H2', '2026-ANNUAL'
    units_sold BIGINT NOT NULL,                    -- DP22: Number of sales units placed on market
    sales_channel VARCHAR(50) DEFAULT 'HOUSEHOLD', -- DP23: 'HOUSEHOLD', 'COMMERCIAL_ON_TRADE'
    is_exempt_export BOOLEAN DEFAULT FALSE,        -- DP25: Deducted if exported outside country
    source_reference VARCHAR(100)                  -- Snowflake / SAP Billing Document Ref
);
```

---

### Domain 4: Layer 2 — Data Quality & Gap Resolution Engine

Tracks gaps ranked by € impact, source mismatches (Devex vs Supplier), and corrections.

```sql
-- 11. Jurisdiction Data Quality Requirements Matrix
CREATE TABLE compliance_data_point_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code VARCHAR(10) NOT NULL,             -- 'UK', 'DE', 'FR'
    regulation_code VARCHAR(50) NOT NULL,          -- 'UK_PEPR', 'CITEO_EPR', 'PPWR'
    required_data_point_id VARCHAR(20) NOT NULL,   -- 'DP09' (Weight), 'DP07' (Polymer), 'DP12' (RAM)
    severity VARCHAR(20) NOT NULL,                 -- 'BLOCKER', 'WARNING', 'INFO'
    impact_description TEXT NOT NULL
);

-- 12. Active Data Quality Issues (Screen 6 & 11)
CREATE TABLE data_quality_issues (
    id VARCHAR(50) PRIMARY KEY,                    -- e.g. 'DQI-1042'
    tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,              -- 'PRODUCT', 'COMPONENT', 'SALES'
    entity_id VARCHAR(100) NOT NULL,               -- SKU or Component ID
    country_code VARCHAR(10) NOT NULL,             -- Which country's rule was violated
    field_name VARCHAR(100) NOT NULL,              -- e.g. 'weight_grams', 'polymer_type'
    data_point_id VARCHAR(20),                     -- 'DP09'
    severity VARCHAR(20) NOT NULL,                 -- 'BLOCKER', 'WARNING'
    estimated_money_at_risk NUMERIC(12,2),         -- e.g. 1900.00 (€1.9k at risk)
    problem_summary TEXT NOT NULL,                 -- e.g. 'Devex spec 12.0 g != supplier spec 10.5 g'
    suggested_action TEXT,                         -- e.g. 'Raise spec change request in Trace One Devex'
    status VARCHAR(50) DEFAULT 'OPEN',             -- 'OPEN', 'PENDING_SOURCE_UPDATE', 'RESOLVED'
    assigned_owner VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- 13. Source Correction Tickets (Screen 12: Trace One / Snowflake sync queue)
CREATE TABLE source_correction_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
    issue_id VARCHAR(50) REFERENCES data_quality_issues(id),
    target_system VARCHAR(50) NOT NULL,            -- 'TRACE_ONE_DEVEX', 'SNOWFLAKE', 'SAP'
    spec_reference VARCHAR(100),                   -- e.g. 'PKG-4471'
    source_current_value TEXT,                     -- '12.0 g'
    verified_value TEXT,                           -- '10.5 g'
    evidence_reference VARCHAR(255),               -- 'FlexiPak_retort_spec_v4.pdf'
    fee_impact NUMERIC(12,2),                      -- -1900.00 (-€1.9k)
    status VARCHAR(50) DEFAULT 'PENDING_APPROVAL', -- 'APPROVED_IN_DEVEX', 'WRITTEN_TO_CORRECTIONS_TABLE'
    approved_by VARCHAR(100),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Locked Snapshots (Screen 13: Four-eyes reviewed immutable data pack)
CREATE TABLE locked_snapshots (
    id VARCHAR(50) PRIMARY KEY,                    -- e.g. 'SNAPSHOT-2026-R1'
    tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
    reporting_period VARCHAR(20) NOT NULL,
    rule_set_version VARCHAR(50) NOT NULL,
    total_skus_reviewed INT,
    completeness_pct NUMERIC(5,2),                 -- e.g. 94.00%
    fee_uncertainty_amount NUMERIC(12,2),          -- e.g. 9000.00 (€9.0k)
    reviewed_by VARCHAR(100) NOT NULL,
    approved_by VARCHAR(100) NOT NULL,
    locked_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Domain 5: Layer 3 — Compliance & Fee Engine (Screens 15, 17)

```sql
-- 15. Fee Calculation Runs
CREATE TABLE calculation_runs (
    id VARCHAR(50) PRIMARY KEY,                    -- e.g. 'CALC-UK-2026-001'
    tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
    snapshot_id VARCHAR(50) REFERENCES locked_snapshots(id),
    jurisdiction_code VARCHAR(10) NOT NULL,        -- 'UK', 'FR', 'DE'
    reporting_period VARCHAR(20) NOT NULL,         -- '2025'
    total_tonnage NUMERIC(12,4) NOT NULL,          -- e.g. 412.0000 tonnes
    total_estimated_fee NUMERIC(14,2) NOT NULL,    -- e.g. £118,400.00
    currency VARCHAR(3) DEFAULT 'GBP',
    rule_version VARCHAR(50) NOT NULL,             -- 'PackUK illustrative 2026/27 · RAM v1.1'
    calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Detailed Calculation Line Items (Calculation Trace Screen 17)
CREATE TABLE calculation_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id VARCHAR(50) REFERENCES calculation_runs(id) ON DELETE CASCADE,
    component_id UUID REFERENCES packaging_components(id),
    material_category VARCHAR(50) NOT NULL,        -- 'PLASTIC', 'PAPER'
    tonnage NUMERIC(12,4) NOT NULL,                -- e.g. 22.05 tonnes
    base_tariff_per_tonne NUMERIC(10,2) NOT NULL,  -- £455.00
    modulation_multiplier NUMERIC(4,2) DEFAULT 1.0,-- 1.20 (RAM Red Multiplier)
    line_total_fee NUMERIC(14,2) NOT NULL,         -- £12,039.00
    rating_applied VARCHAR(20),                    -- 'RED', 'AMBER', 'GREEN'
    calculation_formula_text TEXT                  -- '2.10m units x 10.5g = 22.05t x £455/t x 1.2x = £12,039'
);

-- 17. UK Defra Official RPD Export Schema (From Example CSV)
CREATE TABLE uk_rpd_export_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id VARCHAR(50) REFERENCES calculation_runs(id) ON DELETE CASCADE,
    organisation_id VARCHAR(50) NOT NULL,          -- '100004'
    subsidiary_id VARCHAR(50),
    organisation_size VARCHAR(10) NOT NULL,        -- 'L'
    submission_period VARCHAR(20) NOT NULL,        -- '2025-H1'
    packaging_activity VARCHAR(10) NOT NULL,       -- 'SO', 'PF', 'IM'
    packaging_type VARCHAR(10) NOT NULL,           -- 'HH', 'NH', 'HDC'
    packaging_class VARCHAR(10) NOT NULL,          -- 'P1', 'P3'
    packaging_material VARCHAR(10) NOT NULL,       -- 'PL', 'PC', 'GL', 'AL'
    packaging_material_subtype VARCHAR(50),        -- 'Flexible', 'Rigid'
    from_country VARCHAR(10),                      -- 'EN'
    to_country VARCHAR(10),                        -- 'SC', 'WS'
    packaging_material_weight BIGINT NOT NULL,     -- In grams (e.g. 20000000)
    ram_rag_rating VARCHAR(10)                     -- 'A', 'R', 'G', 'A-M', 'R-M'
);
```

---

## 4. Key Takeaways for Scaling & Maintainability

1. **Zero Data Loss on Ingestion:** `source_metadata` and `raw_staged_records` preserve all raw JSON columns from client systems without failing or altering the schema.
2. **Deterministic Lineage:** Any fee in Screen 17 can trace back: `Fee -> Calculation Line -> Locked Snapshot -> Packaging Component -> Ingestion Batch -> Source File/API`.
3. **Multi-Regulation Ready:** Supporting France (Citeo) or Germany (VerpackG) simply requires adding records into `compliance_data_point_rules` and a new calculation runner function, reusing the exact same `products` and `packaging_components` tables.
