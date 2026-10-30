-- ============================================================================
-- MONK SPACES COMPLIANCE HUB: POSTGRESQL PRODUCTION DDL SCHEMA
-- Canonical Data Foundation (DP01 to DP45) & Multi-Tenant Isolation
-- Target Database: Neon Serverless PostgreSQL
-- ============================================================================

-- Clean setup
DROP TABLE IF EXISTS sales_market CASCADE;
DROP TABLE IF EXISTS packaging_components CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS market_registrations CASCADE;
DROP TABLE IF EXISTS data_quality_issues CASCADE;
DROP TABLE IF EXISTS epr_tariffs CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

-- 1. COMPANIES (Master Tenant & Legal Entity Table)
CREATE TABLE companies (
    company_id VARCHAR(64) PRIMARY KEY, -- e.g. 'khc-europe'
    legal_name VARCHAR(255) NOT NULL, -- 'The Kraft Heinz Company Europe'
    trading_name VARCHAR(255),
    company_number VARCHAR(64) NOT NULL, -- National Reg / CVR
    vat_number VARCHAR(64),
    country_of_establishment VARCHAR(2) NOT NULL DEFAULT 'GB', -- ISO 3166-1 alpha-2
    registered_address TEXT NOT NULL,
    parent_company_id VARCHAR(64),
    contact_name VARCHAR(128) NOT NULL,
    contact_email VARCHAR(128) NOT NULL,
    contact_phone VARCHAR(64),
    reporting_markets TEXT[] NOT NULL DEFAULT '{"GB", "DK"}', -- Array of active market codes
    annual_turnover NUMERIC(15, 2) NOT NULL DEFAULT 350000000.00,
    turnover_currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    packaging_tonnage_prev_year NUMERIC(12, 3) NOT NULL DEFAULT 2150.000,
    organisation_size VARCHAR(32) NOT NULL DEFAULT 'Large', -- 'Large', 'Small', 'Not obligated'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. MARKET REGISTRATIONS (Per-Jurisdiction EPR & PRO Schemes)
CREATE TABLE market_registrations (
    registration_id SERIAL PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    market_code VARCHAR(2) NOT NULL, -- 'GB', 'DK', 'FR', 'DE'
    producer_role VARCHAR(64) NOT NULL DEFAULT 'Brand owner', -- 'Brand owner', 'Packer/filler', 'Importer'
    epr_registration_number VARCHAR(64) NOT NULL, -- DP29 e.g. Defra RPD ID or DPA-000001
    compliance_scheme VARCHAR(128) NOT NULL, -- DP30 e.g. 'Valpak UK' or 'Collective scheme A'
    authorised_rep_name VARCHAR(128), -- DP31
    reporting_frequency VARCHAR(32) NOT NULL DEFAULT 'Yearly', -- 'Half-yearly', 'Yearly', 'Quarterly'
    completeness_declaration_required BOOLEAN NOT NULL DEFAULT FALSE,
    sign_off_owner VARCHAR(128) NOT NULL DEFAULT 'Compliance Lead', -- DP45
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_company_market UNIQUE (company_id, market_code)
);

-- 3. PRODUCTS (Canonical SKU & Packaging Master)
CREATE TABLE products (
    sku_id VARCHAR(64) PRIMARY KEY, -- DP01 e.g. 'KHC-BEANS-415G'
    company_id VARCHAR(64) NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    brand VARCHAR(128) DEFAULT 'Heinz',
    gtin VARCHAR(14), -- DP02 Barcode
    container_volume_ml NUMERIC(10, 2), -- DP26 Liquid volume for DRS scope
    reusable BOOLEAN NOT NULL DEFAULT FALSE, -- DP15
    minimisation_assessment_ref VARCHAR(128), -- DP20
    empty_space_ratio_pct NUMERIC(5, 2) DEFAULT 18.00, -- DP21
    doc_reference VARCHAR(128), -- DP41 EU Declaration of Conformity
    doc_version VARCHAR(16) DEFAULT 'v1',
    technical_file_refs TEXT[], -- DP42 Array of test reports
    harmonised_label_status VARCHAR(32) DEFAULT 'Planned', -- DP39
    data_carrier_url VARCHAR(512), -- DP40 QR link
    triman_on_pack BOOLEAN DEFAULT TRUE, -- DP35
    it_environmental_label VARCHAR(32) DEFAULT 'On pack', -- DP36
    drs_status VARCHAR(32) DEFAULT 'Not in scheme', -- DP26
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PACKAGING COMPONENTS (Bill of Materials & Material Attributes)
CREATE TABLE packaging_components (
    component_id VARCHAR(64) PRIMARY KEY, -- DP03 e.g. 'KHC-BEANS-415G-CAN'
    company_id VARCHAR(64) NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    sku_id VARCHAR(64) NOT NULL REFERENCES products(sku_id) ON DELETE CASCADE,
    component_name VARCHAR(128) NOT NULL,
    packaging_level VARCHAR(32) NOT NULL DEFAULT 'Primary', -- DP04 'Primary', 'Secondary', 'Transit'
    units_per_pack INT NOT NULL DEFAULT 1, -- DP05
    material VARCHAR(64) NOT NULL, -- DP06 'Steel', 'Plastic', 'Glass', 'Paper/board', 'Aluminium'
    polymer VARCHAR(32), -- DP07 'PET', 'HDPE', 'PP', etc.
    material_split VARCHAR(128), -- DP08
    weight_g NUMERIC(10, 2) NOT NULL, -- DP09 Component empty weight in grams
    weight_source VARCHAR(32) NOT NULL DEFAULT 'Measured', -- DP44 'Measured', 'Supplier', 'Spec'
    colour VARCHAR(64) DEFAULT 'Clear', -- DP10
    additives TEXT, -- DP11
    recyclability_result VARCHAR(32) NOT NULL DEFAULT 'Green', -- DP12 'Green', 'Amber', 'Red'
    recycled_content_pct NUMERIC(5, 2) DEFAULT 0.00, -- DP13 (0 to 100%)
    recycled_content_cert VARCHAR(128), -- DP14
    food_contact BOOLEAN NOT NULL DEFAULT TRUE, -- DP16
    pfas_declaration_ref VARCHAR(128), -- DP17
    heavy_metals_mgkg NUMERIC(8, 2) DEFAULT 12.00, -- DP18 (<= 100 limit)
    soc_declaration_ref VARCHAR(128), -- DP19
    supplier_id VARCHAR(64) NOT NULL, -- DP43
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. SALES MARKET (Units Placed on Market by Period & Channel)
CREATE TABLE sales_market (
    sale_id SERIAL PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    sku_id VARCHAR(64) NOT NULL REFERENCES products(sku_id) ON DELETE CASCADE,
    market_code VARCHAR(2) NOT NULL, -- DP22 'GB', 'DK'
    period VARCHAR(32) NOT NULL, -- DP33 '2026', '2026-H1'
    channel VARCHAR(32) NOT NULL DEFAULT 'Household', -- DP23 'Household', 'Non-household'
    units_placed BIGINT NOT NULL DEFAULT 0, -- DP22
    units_exported BIGINT NOT NULL DEFAULT 0, -- DP25
    uk_nation VARCHAR(32), -- DP24 'England', 'Scotland', 'Wales', 'Northern Ireland'
    import_origin_country VARCHAR(2), -- DP27
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. DATA QUALITY ISSUES (Automated Gap Audit & Reconciliation Table)
CREATE TABLE data_quality_issues (
    issue_id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    sku_id VARCHAR(64) NOT NULL REFERENCES products(sku_id) ON DELETE CASCADE,
    data_point_id VARCHAR(16) NOT NULL, -- e.g. 'DP13', 'DP14', 'DP17'
    field_name VARCHAR(64) NOT NULL,
    issue_type VARCHAR(64) NOT NULL, -- 'missing_certificate', 'unverified_weight', 'pfas_check'
    severity VARCHAR(16) NOT NULL DEFAULT 'medium', -- 'critical', 'high', 'medium', 'low'
    status VARCHAR(32) NOT NULL DEFAULT 'open', -- 'open', 'approved', 'dismissed', 'synced'
    description TEXT NOT NULL,
    proposed_fix TEXT,
    source_system VARCHAR(64) DEFAULT 'Trace One Devex',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. EPR TARIFFS & RULES (Versioned Regulatory Rate Schedules)
CREATE TABLE epr_tariffs (
    tariff_id SERIAL PRIMARY KEY,
    jurisdiction VARCHAR(8) NOT NULL, -- 'UK', 'DK', 'DE', 'FR'
    material_code VARCHAR(32) NOT NULL, -- 'PLASTIC', 'GLASS', 'STEEL', 'PAPER'
    currency VARCHAR(3) NOT NULL, -- 'GBP', 'EUR', 'DKK'
    base_rate_per_tonne NUMERIC(10, 2) NOT NULL,
    ram_green_discount_pct NUMERIC(5, 2) DEFAULT 0.00,
    ram_amber_rate_pct NUMERIC(5, 2) DEFAULT 0.00,
    ram_red_penalty_pct NUMERIC(5, 2) DEFAULT 0.00,
    effective_year VARCHAR(16) NOT NULL DEFAULT '2025/2026',
    source_citation TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INITIAL SEED DATA (Kraft Heinz Enterprise & Benchmark Fixtures)
-- ============================================================================

INSERT INTO companies (company_id, legal_name, company_number, country_of_establishment, registered_address, contact_name, contact_email, reporting_markets, annual_turnover, packaging_tonnage_prev_year, organisation_size)
VALUES (
    'khc-europe',
    'The Kraft Heinz Company Europe',
    '00084532',
    'GB',
    'The Shard, 32 London Bridge St, London SE1 9SG',
    'Jane Smith',
    'compliance.officer@kraftheinz.com',
    '{"GB", "DK"}',
    350000000.00,
    2150.000,
    'Large'
) ON CONFLICT (company_id) DO NOTHING;

INSERT INTO market_registrations (company_id, market_code, producer_role, epr_registration_number, compliance_scheme, reporting_frequency, sign_off_owner)
VALUES 
    ('khc-europe', 'GB', 'Brand owner', 'RPD-100004', 'Valpak UK EPR Scheme', 'Yearly', 'Head of Packaging Compliance'),
    ('khc-europe', 'DK', 'Brand owner', 'DPA-DK-004812', 'VANA Danish Collective Scheme', 'Yearly', 'Head of Packaging Compliance')
ON CONFLICT (company_id, market_code) DO NOTHING;

INSERT INTO products (sku_id, company_id, product_name, brand, gtin, container_volume_ml, reusable, doc_reference, doc_version, technical_file_refs)
VALUES 
    ('KHC-BEANS-415G', 'khc-europe', 'Heinz Baked Beans in Tomato Sauce 415g', 'Heinz', '5000157024671', 415.0, FALSE, 'DOC-BEANS-415-v1', 'v1', '{"TR-STEEL-001", "FOOD-CONTACT-CAN"}'),
    ('KHC-KETCHUP-570G', 'khc-europe', 'Heinz Tomato Ketchup Top-Down 570g', 'Heinz', '5000157075673', 500.0, FALSE, 'DOC-KETCHUP-570-v2', 'v2', '{"TR-PET-881", "ISCC-PLUS-041"}'),
    ('KHC-SOUP-400G', 'khc-europe', 'Heinz Cream of Tomato Soup 400g', 'Heinz', '5000157004611', 400.0, FALSE, 'DOC-SOUP-400-v1', 'v1', '{"TR-STEEL-002", "FOOD-CONTACT-CAN"}')
ON CONFLICT (sku_id) DO NOTHING;

INSERT INTO packaging_components (component_id, company_id, sku_id, component_name, packaging_level, units_per_pack, material, polymer, weight_g, recyclability_result, recycled_content_pct, supplier_id)
VALUES 
    ('KHC-BEANS-CAN', 'khc-europe', 'KHC-BEANS-415G', 'Tinplate Steel Can Body', 'Primary', 1, 'Steel', NULL, 48.50, 'Green', 58.00, 'SUP-CROWN-01'),
    ('KHC-BEANS-LID', 'khc-europe', 'KHC-BEANS-415G', 'Easy-Open Steel Lid', 'Primary', 1, 'Steel', NULL, 12.20, 'Green', 58.00, 'SUP-CROWN-01'),
    ('KHC-BEANS-LBL', 'khc-europe', 'KHC-BEANS-415G', 'Paper Wrap Label', 'Primary', 1, 'Paper/board', NULL, 3.40, 'Green', 100.00, 'SUP-LABEL-02'),
    ('KHC-KET-BTL', 'khc-europe', 'KHC-KETCHUP-570G', 'PET Squeezy Bottle', 'Primary', 1, 'Plastic', 'PET', 34.00, 'Green', 30.00, 'SUP-ALPLA-01'),
    ('KHC-KET-CAP', 'khc-europe', 'KHC-KETCHUP-570G', 'PP Flip-Top Dispensing Closure', 'Primary', 1, 'Plastic', 'PP', 8.60, 'Amber', 0.00, 'SUP-BERICAP-02')
ON CONFLICT (component_id) DO NOTHING;

INSERT INTO sales_market (company_id, sku_id, market_code, period, channel, units_placed, units_exported, uk_nation)
VALUES 
    ('khc-europe', 'KHC-BEANS-415G', 'GB', '2026', 'Household', 12500000, 45000, 'England'),
    ('khc-europe', 'KHC-BEANS-415G', 'DK', '2026', 'Household', 140000, 0, NULL),
    ('khc-europe', 'KHC-KETCHUP-570G', 'GB', '2026', 'Household', 8900000, 20000, 'England'),
    ('khc-europe', 'KHC-KETCHUP-570G', 'DK', '2026', 'Household', 210000, 0, NULL);

INSERT INTO epr_tariffs (jurisdiction, material_code, currency, base_rate_per_tonne, ram_green_discount_pct, ram_amber_rate_pct, ram_red_penalty_pct, source_citation)
VALUES 
    ('UK', 'PLASTIC', 'GBP', 455.00, -10.00, 0.00, 30.00, 'Defra Illustrative Base Fees 2025/2026 Table 2'),
    ('UK', 'STEEL', 'GBP', 285.00, -10.00, 0.00, 0.00, 'Defra Illustrative Base Fees 2025/2026 Table 2'),
    ('UK', 'ALUMINIUM', 'GBP', 320.00, -10.00, 0.00, 0.00, 'Defra Illustrative Base Fees 2025/2026 Table 2'),
    ('UK', 'GLASS', 'GBP', 195.00, -10.00, 0.00, 0.00, 'Defra Illustrative Base Fees 2025/2026 Table 2'),
    ('UK', 'PAPER/BOARD', 'GBP', 235.00, -10.00, 0.00, 0.00, 'Defra Illustrative Base Fees 2025/2026 Table 2'),
    ('DK', 'PLASTIC', 'DKK', 3200.00, 0.00, 0.00, 25.00, 'DPA / VANA Tariff Notification 2026'),
    ('DK', 'GLASS', 'DKK', 950.00, 0.00, 0.00, 0.00, 'DPA / VANA Tariff Notification 2026'),
    ('DK', 'STEEL', 'DKK', 1400.00, 0.00, 0.00, 0.00, 'DPA / VANA Tariff Notification 2026');

