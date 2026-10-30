-- ============================================================================
-- MONK SPACES COMPLIANCE HUB: BENCHMARK SEED DATA
-- Target: Neon PostgreSQL (Run this in Neon SQL Editor if you want initial demo data)
-- ============================================================================

-- 1. COMPANIES
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

-- 2. MARKET REGISTRATIONS
INSERT INTO market_registrations (company_id, market_code, producer_role, epr_registration_number, compliance_scheme, reporting_frequency, sign_off_owner)
VALUES 
    ('khc-europe', 'GB', 'Brand owner', 'RPD-100004', 'Valpak UK EPR Scheme', 'Yearly', 'Head of Packaging Compliance'),
    ('khc-europe', 'DK', 'Brand owner', 'DPA-DK-004812', 'VANA Danish Collective Scheme', 'Yearly', 'Head of Packaging Compliance')
ON CONFLICT (company_id, market_code) DO NOTHING;

-- 3. PRODUCTS (Canonical SKUs)
INSERT INTO products (sku_id, company_id, product_name, brand, gtin, container_volume_ml, reusable, doc_reference, doc_version, technical_file_refs)
VALUES 
    ('KHC-BEANS-415G', 'khc-europe', 'Heinz Baked Beans in Tomato Sauce 415g', 'Heinz', '5000157024671', 415.0, FALSE, 'DOC-BEANS-415-v1', 'v1', '{"TR-STEEL-001", "FOOD-CONTACT-CAN"}'),
    ('KHC-KETCHUP-570G', 'khc-europe', 'Heinz Tomato Ketchup Top-Down 570g', 'Heinz', '5000157075673', 500.0, FALSE, 'DOC-KETCHUP-570-v2', 'v2', '{"TR-PET-881", "ISCC-PLUS-041"}'),
    ('KHC-SOUP-400G', 'khc-europe', 'Heinz Cream of Tomato Soup 400g', 'Heinz', '5000157004611', 400.0, FALSE, 'DOC-SOUP-400-v1', 'v1', '{"TR-STEEL-002", "FOOD-CONTACT-CAN"}')
ON CONFLICT (sku_id) DO NOTHING;

-- 4. PACKAGING COMPONENTS (BOM Specifications)
INSERT INTO packaging_components (component_id, company_id, sku_id, component_name, packaging_level, units_per_pack, material, polymer, weight_g, recyclability_result, recycled_content_pct, supplier_id)
VALUES 
    ('KHC-BEANS-CAN', 'khc-europe', 'KHC-BEANS-415G', 'Tinplate Steel Can Body', 'Primary', 1, 'Steel', NULL, 48.50, 'Green', 58.00, 'SUP-CROWN-01'),
    ('KHC-BEANS-LID', 'khc-europe', 'KHC-BEANS-415G', 'Easy-Open Steel Lid', 'Primary', 1, 'Steel', NULL, 12.20, 'Green', 58.00, 'SUP-CROWN-01'),
    ('KHC-BEANS-LBL', 'khc-europe', 'KHC-BEANS-415G', 'Paper Wrap Label', 'Primary', 1, 'Paper/board', NULL, 3.40, 'Green', 100.00, 'SUP-LABEL-02'),
    ('KHC-KET-BTL', 'khc-europe', 'KHC-KETCHUP-570G', 'PET Squeezy Bottle', 'Primary', 1, 'Plastic', 'PET', 34.00, 'Green', 30.00, 'SUP-ALPLA-01'),
    ('KHC-KET-CAP', 'khc-europe', 'KHC-KETCHUP-570G', 'PP Flip-Top Dispensing Closure', 'Primary', 1, 'Plastic', 'PP', 8.60, 'Amber', 0.00, 'SUP-BERICAP-02')
ON CONFLICT (component_id) DO NOTHING;

-- 5. SALES MARKET (Quantities Placed on Market)
INSERT INTO sales_market (company_id, sku_id, market_code, period, channel, units_placed, units_exported, uk_nation)
VALUES 
    ('khc-europe', 'KHC-BEANS-415G', 'GB', '2026', 'Household', 12500000, 45000, 'England'),
    ('khc-europe', 'KHC-BEANS-415G', 'DK', '2026', 'Household', 140000, 0, NULL),
    ('khc-europe', 'KHC-KETCHUP-570G', 'GB', '2026', 'Household', 8900000, 20000, 'England'),
    ('khc-europe', 'KHC-KETCHUP-570G', 'DK', '2026', 'Household', 210000, 0, NULL);

-- 6. EPR TARIFFS (UK Defra & Denmark DPA Illustrative Rates)
INSERT INTO epr_tariffs (jurisdiction, material_code, currency, base_rate_per_tonne, ram_green_discount_pct, ram_amber_rate_pct, ram_red_penalty_pct, source_citation)
VALUES 
    ('UK', 'PLASTIC', 'GBP', 455.00, -10.00, 0.00, 30.00, 'Defra Illustrative Base Fees 2025/2026 Table 2'),
    ('UK', 'STEEL', 'GBP', 285.00, -10.00, 0.00, 0.00, 'Defra Illustrative Base Fees 2025/2026 Table 2'),
    ('UK', 'ALUMINIUM', 'GBP', 320.00, -10.00, 0.00, 0.00, 'Defra Illustrative Base Fees 2025/2026 Table 2'),
    ('UK', 'GLASS', 'GBP', 195.00, -10.00, 0.00, 0.00, 'Defra Illustrative Base Fees 2025/2026 Table 2'),
    ('UK', 'PAPER/BOARD', 'GBP', 235.00, -10.00, 0.00, 0.00, 'Defra Illustrative Base Fees 2025/2026 Table 2'),
    ('DK', 'PLASTIC', 'DKK', 3200.00, 0.00, 0.00, 25.00, 'DPA / VANA Tariff Notification 2026'),
    ('DK', 'GLASS', 'DKK', 950.00, 0.00, 0.00, 0.00, 'DPA / VANA Tariff Notification 2026'),
    ('DK', 'STEEL', 'DKK', 1400.00, 0.00, 0.00, 0.00, 'DPA / VANA Tariff Notification 2026')
ON CONFLICT DO NOTHING;
