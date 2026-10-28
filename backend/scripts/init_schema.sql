-- ==============================================================================
-- Monkspaces Shared Product & Packaging Data Platform
-- PostgreSQL 16+ Canonical Database Initialization Script
-- Supports 17 Core Tables, Multi-Tenancy Schemas, and Canonical DP01-DP45 Fields
-- ==============================================================================

-- 1. Global Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Master Platform Schema
CREATE SCHEMA IF NOT EXISTS platform;

-- Table 1: Master Tenants Registry
CREATE TABLE IF NOT EXISTS platform.tenants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sector VARCHAR(100) NOT NULL,
    tier VARCHAR(50) DEFAULT 'enterprise',
    primary_currency VARCHAR(3) DEFAULT 'EUR',
    rpd_organisation_id VARCHAR(64),
    organisation_size VARCHAR(20) DEFAULT 'L',
    primary_jurisdiction VARCHAR(8) DEFAULT 'GB',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table 2: User Accounts
CREATE TABLE IF NOT EXISTS platform.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_superuser BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table 3: Tenant User Membership
CREATE TABLE IF NOT EXISTS platform.tenant_user_membership (
    tenant_id VARCHAR(64) REFERENCES platform.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES platform.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'CONSULTANT',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, user_id)
);

-- Table 4: Upstream Source Systems
CREATE TABLE IF NOT EXISTS platform.source_systems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(64) REFERENCES platform.tenants(id) ON DELETE CASCADE,
    system_type VARCHAR(50) NOT NULL, -- TRACE_ONE, SAP_S4, SNOWFLAKE, EXCEL
    system_name VARCHAR(120) NOT NULL,
    is_read_only BOOLEAN DEFAULT TRUE,
    connection_status VARCHAR(50) DEFAULT 'HEALTHY',
    last_synced_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table 5: Ingestion Batches & Audit Log
CREATE TABLE IF NOT EXISTS platform.ingestion_batches (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) REFERENCES platform.tenants(id) ON DELETE CASCADE,
    source_system_id UUID REFERENCES platform.source_systems(id),
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    records_received INT DEFAULT 0,
    records_canonicalized INT DEFAULT 0,
    records_rejected INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table 6: Canonical Products (DP01-DP06)
CREATE TABLE IF NOT EXISTS platform.canonical_products (
    sku VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) REFERENCES platform.tenants(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    brand VARCHAR(120),
    category VARCHAR(100),
    ean_barcode VARCHAR(32),
    net_weight_g NUMERIC(10, 3) NOT NULL,
    consumer_sales_unit_volume_ml NUMERIC(10, 3),
    source_batch_id VARCHAR(64) REFERENCES platform.ingestion_batches(id),
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sku, tenant_id)
);

-- Table 7: Packaging Components (DP07-DP16)
CREATE TABLE IF NOT EXISTS platform.packaging_components (
    id VARCHAR(64) NOT NULL,
    sku VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    packaging_level VARCHAR(20) NOT NULL, -- PRIMARY, SECONDARY, TERTIARY
    component_name VARCHAR(120) NOT NULL,
    material_category VARCHAR(60) NOT NULL,
    weight_g NUMERIC(10, 3) NOT NULL,
    is_separable BOOLEAN DEFAULT TRUE,
    is_food_contact BOOLEAN DEFAULT TRUE,
    color_opacity VARCHAR(50),
    closure_type VARCHAR(60),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, tenant_id),
    FOREIGN KEY (sku, tenant_id) REFERENCES platform.canonical_products(sku, tenant_id) ON DELETE CASCADE
);

-- Table 8: Component Material Layers & PCR (DP17-DP24)
CREATE TABLE IF NOT EXISTS platform.component_material_layers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    layer_sequence INT NOT NULL DEFAULT 1,
    polymer_code VARCHAR(30) NOT NULL,
    thickness_microns NUMERIC(8, 2),
    weight_pct NUMERIC(5, 2) NOT NULL DEFAULT 100.0,
    pcr_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    barrier_coating_type VARCHAR(60),
    certificate_id VARCHAR(64),
    FOREIGN KEY (component_id, tenant_id) REFERENCES platform.packaging_components(id, tenant_id) ON DELETE CASCADE
);

-- Table 9: Placed on Market Sales Data (DP25-DP30)
CREATE TABLE IF NOT EXISTS platform.placed_on_market_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(64) REFERENCES platform.tenants(id) ON DELETE CASCADE,
    sku VARCHAR(64) NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    reporting_period VARCHAR(20) NOT NULL,
    units_sold BIGINT NOT NULL,
    gross_tonnage NUMERIC(12, 4) NOT NULL,
    FOREIGN KEY (sku, tenant_id) REFERENCES platform.canonical_products(sku, tenant_id) ON DELETE CASCADE
);

-- Table 10: Regulatory Rule Sets (Fee Tariffs & EPR Schemes)
CREATE TABLE IF NOT EXISTS platform.regulatory_rule_sets (
    id VARCHAR(64) PRIMARY KEY,
    jurisdiction VARCHAR(8) NOT NULL,
    scheme_name VARCHAR(120) NOT NULL,
    reporting_year INT NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    version VARCHAR(30) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE NOT NULL
);

-- Table 11: Tariff Rates & Modulation Schedule
CREATE TABLE IF NOT EXISTS platform.tariff_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_set_id VARCHAR(64) REFERENCES platform.regulatory_rule_sets(id) ON DELETE CASCADE,
    material VARCHAR(60) NOT NULL,
    base_rate_per_tonne NUMERIC(10, 2) NOT NULL,
    pcr_threshold_pct NUMERIC(5, 2) DEFAULT 30.0,
    recycled_discount_pct NUMERIC(5, 2) DEFAULT 0.0,
    disruptor_malus_pct NUMERIC(5, 2) DEFAULT 0.0,
    description TEXT
);

-- Table 12: Source Lineage & Hash Tracking
CREATE TABLE IF NOT EXISTS platform.source_lineage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(64) REFERENCES platform.tenants(id) ON DELETE CASCADE,
    entity_type VARCHAR(60) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    source_system VARCHAR(60) NOT NULL,
    source_spec_id VARCHAR(120) NOT NULL,
    raw_hash VARCHAR(64) NOT NULL,
    extracted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table 13: Data Quality Issues (Engine Findings)
CREATE TABLE IF NOT EXISTS platform.dq_issues (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) REFERENCES platform.tenants(id) ON DELETE CASCADE,
    rule_code VARCHAR(60) NOT NULL,
    rule_title VARCHAR(255) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- BLOCKER, WARNING, INFO
    entity_type VARCHAR(60) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    field_name VARCHAR(60) NOT NULL,
    current_value TEXT,
    suggested_source_action TEXT,
    status VARCHAR(30) DEFAULT 'OPEN',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table 14: Source Correction Tickets (PLM/ERP Single Source of Truth)
CREATE TABLE IF NOT EXISTS platform.source_correction_tickets (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) REFERENCES platform.tenants(id) ON DELETE CASCADE,
    issue_id VARCHAR(64) REFERENCES platform.dq_issues(id),
    target_system VARCHAR(60) NOT NULL,
    spec_reference VARCHAR(120) NOT NULL,
    status VARCHAR(50) DEFAULT 'DISPATCHED_TO_PLM',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table 15: EPR Fee Calculation Runs
CREATE TABLE IF NOT EXISTS platform.calculation_runs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) REFERENCES platform.tenants(id) ON DELETE CASCADE,
    jurisdiction VARCHAR(8) NOT NULL,
    rule_set_id VARCHAR(64) REFERENCES platform.regulatory_rule_sets(id),
    total_fee NUMERIC(14, 2) NOT NULL,
    uncertainty_margin NUMERIC(14, 2) NOT NULL,
    total_tonnage NUMERIC(12, 4) NOT NULL,
    skus_evaluated INT NOT NULL,
    executed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
