import os
import psycopg
from dotenv import load_dotenv

load_dotenv('backend/.env')
db_url = os.getenv('DATABASE_URL')
print('Connecting to Neon PostgreSQL to seed canonical benchmark data...')

with psycopg.connect(db_url) as conn:
    with conn.cursor() as cur:
        # 1. COMPANIES (Nordhavn Spirits ApS + The Kraft Heinz Company)
        cur.execute("""
        INSERT INTO companies (
            company_id, legal_name, trading_name, company_number, vat_number,
            country_of_establishment, registered_address, contact_name, contact_email,
            contact_phone, reporting_markets, annual_turnover, turnover_currency,
            packaging_tonnage_prev_year, organisation_size
        ) VALUES 
        (
            'nordhavn-spirits', 'Nordhavn Spirits ApS', 'Nordhavn', '12345678', 'DK12345678',
            'DK', 'Havnegade 1, 2150 Nordhavn, Denmark', 'Jane Smith', 'jane.smith@nordhavn-spirits.dk',
            '+45 32 00 11 22', '{"DK", "UK", "DE"}', 350000000.00, 'DKK',
            2150.000, 'Large'
        ),
        (
            'khc-europe', 'The Kraft Heinz Company Europe', 'Heinz', '00084532', 'GB987654321',
            'GB', 'The Shard, 32 London Bridge St, London SE1 9SG', 'Sarah Mitchell', 'compliance.officer@kraftheinz.com',
            '+44 20 8234 5000', '{"GB", "DK"}', 350000000.00, 'EUR',
            2150.000, 'Large'
        )
        ON CONFLICT (company_id) DO UPDATE SET
            legal_name = EXCLUDED.legal_name,
            trading_name = EXCLUDED.trading_name,
            reporting_markets = EXCLUDED.reporting_markets,
            annual_turnover = EXCLUDED.annual_turnover,
            updated_at = NOW();
        """)
        print("✓ Companies seeded.")

        # 2. MARKET REGISTRATIONS
        cur.execute("""
        INSERT INTO market_registrations (
            company_id, market_code, producer_role, epr_registration_number,
            compliance_scheme, reporting_frequency, sign_off_owner
        ) VALUES 
        ('nordhavn-spirits', 'DK', 'Brand owner', 'DPA-000001', 'Collective scheme A (VANA)', 'Yearly', 'Head of Packaging Compliance'),
        ('nordhavn-spirits', 'GB', 'Importer', 'RPD-998877', 'Valpak UK', 'Yearly', 'Head of Packaging Compliance'),
        ('khc-europe', 'GB', 'Brand owner', 'RPD-100004', 'Valpak UK EPR Scheme', 'Yearly', 'Head of Packaging Compliance'),
        ('khc-europe', 'DK', 'Brand owner', 'DPA-DK-004812', 'VANA Danish Collective Scheme', 'Yearly', 'Head of Packaging Compliance')
        ON CONFLICT (company_id, market_code) DO NOTHING;
        """)
        print("✓ Market registrations seeded.")

        # 3. PRODUCTS (SKUs)
        cur.execute("""
        INSERT INTO products (
            sku_id, company_id, product_name, brand, gtin,
            container_volume_ml, reusable, minimisation_assessment_ref, empty_space_ratio_pct,
            doc_reference, doc_version, technical_file_refs
        ) VALUES 
        (
            'NH-WHS-70', 'nordhavn-spirits', 'Nordhavn Single Malt 70cl', 'Nordhavn', '5012345678900',
            700.0, FALSE, 'MIN-NH-WHS-70-v1', 18.0,
            'DOC-NH-WHS-70', 'v1', '{"TR-GL-001", "PFAS-CL-003"}'
        ),
        (
            'KHC-BEANS-415G', 'khc-europe', 'Heinz Baked Beans in Tomato Sauce 415g', 'Heinz', '5000157024671',
            415.0, FALSE, 'MIN-KHC-BEAN-415', 5.0,
            'DOC-BEANS-415-v1', 'v1', '{"TR-STEEL-001", "FOOD-CONTACT-CAN"}'
        ),
        (
            'KHC-KETCHUP-570G', 'khc-europe', 'Heinz Tomato Ketchup Top-Down 570g', 'Heinz', '5000157075673',
            500.0, FALSE, 'MIN-KHC-KET-570', 8.0,
            'DOC-KETCHUP-570-v2', 'v2', '{"TR-PET-881", "ISCC-PLUS-041"}'
        ),
        (
            'KHC-SOUP-400G', 'khc-europe', 'Heinz Cream of Tomato Soup 400g', 'Heinz', '5000157004611',
            400.0, FALSE, 'MIN-KHC-SOUP-400', 4.0,
            'DOC-SOUP-400-v1', 'v1', '{"TR-STEEL-002", "FOOD-CONTACT-CAN"}'
        )
        ON CONFLICT (sku_id) DO NOTHING;
        """)
        print("✓ Products seeded.")

        # 4. PACKAGING COMPONENTS (BOM Levels)
        cur.execute("""
        INSERT INTO packaging_components (
            component_id, company_id, sku_id, component_name, packaging_level,
            units_per_pack, material, polymer, weight_g, recyclability_result,
            recycled_content_pct, recycled_content_cert, food_contact, pfas_declaration_ref,
            heavy_metals_mgkg, soc_declaration_ref, supplier_id
        ) VALUES 
        (
            'NH-WHS-70-01', 'nordhavn-spirits', 'NH-WHS-70', 'Glass bottle', 'Primary',
            1, 'Glass', NULL, 520.0, 'Green',
            40.0, 'ISCC-PLUS-2026-0012', TRUE, 'PFAS-CL-003',
            12.0, 'SOC-LB-002', 'SUP-GLASS-01'
        ),
        (
            'NH-WHS-70-02', 'nordhavn-spirits', 'NH-WHS-70', 'Polymer Closure & Cork', 'Primary',
            1, 'Plastic', 'PP', 8.5, 'Amber',
            0.0, NULL, TRUE, 'PFAS-CL-003',
            5.0, 'SOC-LB-002', 'SUP-CLOSURE-03'
        ),
        (
            'NH-WHS-70-03', 'nordhavn-spirits', 'NH-WHS-70', 'Embossed Paper Label', 'Primary',
            1, 'Paper/board', NULL, 2.8, 'Green',
            100.0, 'FSC-MIX-2026', FALSE, NULL,
            2.0, 'SOC-LB-002', 'SUP-LABEL-02'
        ),
        (
            'NH-WHS-70-04', 'nordhavn-spirits', 'NH-WHS-70', 'Outer Corrugated Shipping Box (6pk)', 'Secondary',
            6, 'Paper/board', NULL, 180.0, 'Green',
            80.0, 'FSC-RECYCLED-2026', FALSE, NULL,
            0.0, 'SOC-LB-002', 'SUP-CORR-04'
        ),
        -- Heinz Components
        (
            'KHC-BEANS-CAN', 'khc-europe', 'KHC-BEANS-415G', 'Tinplate Steel Can Body', 'Primary',
            1, 'Steel', NULL, 48.5, 'Green',
            58.0, 'STEEL-REC-CERT', TRUE, 'PFAS-FREE-01',
            0.0, 'SOC-STEEL-01', 'SUP-CROWN-01'
        ),
        (
            'KHC-BEANS-LID', 'khc-europe', 'KHC-BEANS-415G', 'Easy-Open Steel Lid', 'Primary',
            1, 'Steel', NULL, 12.2, 'Green',
            58.0, 'STEEL-REC-CERT', TRUE, 'PFAS-FREE-01',
            0.0, 'SOC-STEEL-01', 'SUP-CROWN-01'
        ),
        (
            'KHC-BEANS-LBL', 'khc-europe', 'KHC-BEANS-415G', 'Paper Wrap Label', 'Primary',
            1, 'Paper/board', NULL, 3.4, 'Green',
            100.0, 'FSC-100-CERT', FALSE, NULL,
            0.0, 'SOC-PAPER-01', 'SUP-LABEL-02'
        ),
        (
            'KHC-KET-BTL', 'khc-europe', 'KHC-KETCHUP-570G', 'PET Squeezy Bottle', 'Primary',
            1, 'Plastic', 'PET', 34.0, 'Green',
            30.0, 'ISCC-PLUS-041', TRUE, 'PFAS-FREE-02',
            0.0, 'SOC-PLAST-01', 'SUP-ALPLA-01'
        ),
        (
            'KHC-KET-CAP', 'khc-europe', 'KHC-KETCHUP-570G', 'PP Flip-Top Dispensing Closure', 'Primary',
            1, 'Plastic', 'PP', 8.6, 'Amber',
            0.0, NULL, TRUE, 'PFAS-FREE-02',
            0.0, 'SOC-PLAST-01', 'SUP-BERICAP-02'
        )
        ON CONFLICT (component_id) DO NOTHING;
        """)
        print("✓ Packaging components seeded.")

        # 5. SALES MARKET (Including Denmark Benchmark Filing Volumes)
        cur.execute("""
        INSERT INTO sales_market (
            company_id, sku_id, market_code, period, channel,
            units_placed, units_exported, uk_nation
        ) VALUES 
        ('nordhavn-spirits', 'NH-WHS-70', 'DK', '2026', 'Household', 40000, 0, NULL),
        ('nordhavn-spirits', 'NH-WHS-70', 'DK', '2026', 'Non-household', 15000, 0, NULL),
        ('nordhavn-spirits', 'NH-WHS-70', 'GB', '2026', 'Household', 25000, 0, 'Scotland'),
        ('khc-europe', 'KHC-BEANS-415G', 'GB', '2026', 'Household', 12500000, 45000, 'England'),
        ('khc-europe', 'KHC-BEANS-415G', 'DK', '2026', 'Household', 140000, 0, NULL),
        ('khc-europe', 'KHC-KETCHUP-570G', 'GB', '2026', 'Household', 8900000, 20000, 'England'),
        ('khc-europe', 'KHC-KETCHUP-570G', 'DK', '2026', 'Household', 210000, 0, NULL);
        """)
        print("✓ Sales market volumes seeded.")

        # 6. DATA QUALITY AUDIT ISSUES
        cur.execute("""
        INSERT INTO data_quality_issues (
            issue_id, company_id, sku_id, data_point_id, field_name,
            issue_type, severity, status, description, proposed_fix, source_system
        ) VALUES 
        (
            'ISS-DK-001', 'nordhavn-spirits', 'NH-WHS-70', 'DP10', 'colour',
            'missing_optical_spec', 'medium', 'open',
            'Glass colour specification is clear flint; optical transmission curve not verified.',
            'Confirm transmission under 10% or supply laboratory transmission curve.', 'SUP-GLASS-01'
        ),
        (
            'ISS-KHC-002', 'khc-europe', 'KHC-KETCHUP-570G', 'DP13', 'recycled_content_cert',
            'missing_certificate', 'high', 'open',
            'PET bottle claims 30% recycled content but ISCC-PLUS-041 certificate expired.',
            'Request renewed ISCC+ certificate from Alpla packaging.', 'Trace One Devex'
        )
        ON CONFLICT (issue_id) DO NOTHING;
        """)
        print("✓ Data quality issues seeded.")

        # 7. EPR TARIFFS
        cur.execute("""
        INSERT INTO epr_tariffs (
            jurisdiction, material_code, currency, base_rate_per_tonne,
            ram_green_discount_pct, ram_amber_rate_pct, ram_red_penalty_pct, source_citation
        ) VALUES 
        ('UK', 'PLASTIC', 'GBP', 455.00, -10.00, 0.00, 30.00, 'Defra Illustrative Base Fees 2025/2026 Table 2'),
        ('UK', 'STEEL', 'GBP', 285.00, -10.00, 0.00, 0.00, 'Defra Illustrative Base Fees 2025/2026 Table 2'),
        ('UK', 'ALUMINIUM', 'GBP', 320.00, -10.00, 0.00, 0.00, 'Defra Illustrative Base Fees 2025/2026 Table 2'),
        ('UK', 'GLASS', 'GBP', 195.00, -10.00, 0.00, 0.00, 'Defra Illustrative Base Fees 2025/2026 Table 2'),
        ('UK', 'PAPER/BOARD', 'GBP', 235.00, -10.00, 0.00, 0.00, 'Defra Illustrative Base Fees 2025/2026 Table 2'),
        ('DK', 'PLASTIC', 'DKK', 3200.00, 0.00, 0.00, 25.00, 'DPA / VANA Tariff Notification 2026'),
        ('DK', 'GLASS', 'DKK', 950.00, 0.00, 0.00, 0.00, 'DPA / VANA Tariff Notification 2026'),
        ('DK', 'STEEL', 'DKK', 1400.00, 0.00, 0.00, 0.00, 'DPA / VANA Tariff Notification 2026'),
        ('DK', 'PAPER/BOARD', 'DKK', 1600.00, 0.00, 0.00, 0.00, 'DPA / VANA Tariff Notification 2026'),
        ('DK', 'ALUMINIUM', 'DKK', 2100.00, 0.00, 0.00, 0.00, 'DPA / VANA Tariff Notification 2026')
        ON CONFLICT DO NOTHING;
        """)
        print("✓ EPR tariffs seeded.")

        conn.commit()
        print("\n🎉 ALL CANONICAL BENCHMARK DATA SEEDED SUCCESSFULLY INTO NEON POSTGRESQL!")

