import os
import sys
import psycopg
from dotenv import load_dotenv

load_dotenv('backend/.env')
db_url = os.getenv('DATABASE_URL')

print("Connecting...", flush=True)
conn = psycopg.connect(db_url, connect_timeout=10, autocommit=True)
print("Connected!", flush=True)

with conn.cursor() as cur:
    print("Inserting companies...", flush=True)
    cur.execute("""
    INSERT INTO companies (company_id, legal_name, company_number, country_of_establishment, registered_address, contact_name, contact_email, reporting_markets, annual_turnover, packaging_tonnage_prev_year, organisation_size)
    VALUES 
    ('nordhavn-spirits', 'Nordhavn Spirits ApS', '12345678', 'DK', 'Havnegade 1, 2150 Nordhavn', 'Jane Smith', 'jane.smith@nordhavn.dk', '{"DK", "UK"}', 350000000, 2150, 'Large'),
    ('khc-europe', 'The Kraft Heinz Company Europe', '00084532', 'GB', 'The Shard, London', 'Sarah Mitchell', 'compliance@kraftheinz.com', '{"GB", "DK"}', 350000000, 2150, 'Large')
    ON CONFLICT (company_id) DO NOTHING;
    """)
    print("Companies inserted!", flush=True)

    print("Inserting market registrations...", flush=True)
    cur.execute("""
    INSERT INTO market_registrations (company_id, market_code, producer_role, epr_registration_number, compliance_scheme, reporting_frequency, sign_off_owner)
    VALUES 
    ('nordhavn-spirits', 'DK', 'Brand owner', 'DPA-000001', 'Collective scheme A', 'Yearly', 'Head of Packaging Compliance'),
    ('nordhavn-spirits', 'GB', 'Importer', 'RPD-998877', 'Valpak UK', 'Yearly', 'Head of Packaging Compliance'),
    ('khc-europe', 'GB', 'Brand owner', 'RPD-100004', 'Valpak UK EPR Scheme', 'Yearly', 'Head of Packaging Compliance'),
    ('khc-europe', 'DK', 'Brand owner', 'DPA-DK-004812', 'VANA Danish Collective Scheme', 'Yearly', 'Head of Packaging Compliance')
    ON CONFLICT (company_id, market_code) DO NOTHING;
    """)
    print("Registrations inserted!", flush=True)

    print("Inserting products...", flush=True)
    cur.execute("""
    INSERT INTO products (sku_id, company_id, product_name, brand, gtin, container_volume_ml, reusable, doc_reference, doc_version, technical_file_refs)
    VALUES 
    ('NH-WHS-70', 'nordhavn-spirits', 'Nordhavn Single Malt 70cl', 'Nordhavn', '5012345678900', 700.0, FALSE, 'DOC-NH-WHS-70', 'v1', '{"TR-GL-001"}'),
    ('KHC-BEANS-415G', 'khc-europe', 'Heinz Baked Beans in Tomato Sauce 415g', 'Heinz', '5000157024671', 415.0, FALSE, 'DOC-BEANS-415-v1', 'v1', '{"TR-STEEL-001"}'),
    ('KHC-KETCHUP-570G', 'khc-europe', 'Heinz Tomato Ketchup Top-Down 570g', 'Heinz', '5000157075673', 500.0, FALSE, 'DOC-KETCHUP-570-v2', 'v2', '{"TR-PET-881"}')
    ON CONFLICT (sku_id) DO NOTHING;
    """)
    print("Products inserted!", flush=True)

    print("Inserting packaging components...", flush=True)
    cur.execute("""
    INSERT INTO packaging_components (component_id, company_id, sku_id, component_name, packaging_level, units_per_pack, material, polymer, weight_g, recyclability_result, recycled_content_pct, supplier_id)
    VALUES 
    ('NH-WHS-70-01', 'nordhavn-spirits', 'NH-WHS-70', 'Glass bottle', 'Primary', 1, 'Glass', NULL, 520.0, 'Green', 40.0, 'SUP-GLASS-01'),
    ('NH-WHS-70-02', 'nordhavn-spirits', 'NH-WHS-70', 'Polymer Closure & Cork', 'Primary', 1, 'Plastic', 'PP', 8.5, 'Amber', 0.0, 'SUP-CLOSURE-03'),
    ('NH-WHS-70-03', 'nordhavn-spirits', 'NH-WHS-70', 'Embossed Paper Label', 'Primary', 1, 'Paper/board', NULL, 2.8, 'Green', 100.0, 'SUP-LABEL-02'),
    ('KHC-BEANS-CAN', 'khc-europe', 'KHC-BEANS-415G', 'Tinplate Steel Can Body', 'Primary', 1, 'Steel', NULL, 48.5, 'Green', 58.0, 'SUP-CROWN-01'),
    ('KHC-BEANS-LID', 'khc-europe', 'KHC-BEANS-415G', 'Easy-Open Steel Lid', 'Primary', 1, 'Steel', NULL, 12.2, 'Green', 58.0, 'SUP-CROWN-01'),
    ('KHC-KET-BTL', 'khc-europe', 'KHC-KETCHUP-570G', 'PET Squeezy Bottle', 'Primary', 1, 'Plastic', 'PET', 34.0, 'Green', 30.0, 'SUP-ALPLA-01')
    ON CONFLICT (component_id) DO NOTHING;
    """)
    print("Components inserted!", flush=True)

    print("Inserting sales...", flush=True)
    cur.execute("""
    INSERT INTO sales_market (company_id, sku_id, market_code, period, channel, units_placed, units_exported, uk_nation)
    VALUES 
    ('nordhavn-spirits', 'NH-WHS-70', 'DK', '2026', 'Household', 40000, 0, NULL),
    ('nordhavn-spirits', 'NH-WHS-70', 'DK', '2026', 'Non-household', 15000, 0, NULL),
    ('khc-europe', 'KHC-BEANS-415G', 'GB', '2026', 'Household', 12500000, 45000, 'England'),
    ('khc-europe', 'KHC-BEANS-415G', 'DK', '2026', 'Household', 140000, 0, NULL);
    """)
    print("Sales inserted!", flush=True)

    print("Inserting tariffs...", flush=True)
    cur.execute("""
    INSERT INTO epr_tariffs (jurisdiction, material_code, currency, base_rate_per_tonne, ram_green_discount_pct, ram_amber_rate_pct, ram_red_penalty_pct, source_citation)
    VALUES 
    ('UK', 'PLASTIC', 'GBP', 455.00, -10.00, 0.00, 30.00, 'Defra Illustrative Base Fees 2025/2026 Table 2'),
    ('UK', 'STEEL', 'GBP', 285.00, -10.00, 0.00, 0.00, 'Defra Illustrative Base Fees 2025/2026 Table 2'),
    ('UK', 'GLASS', 'GBP', 195.00, -10.00, 0.00, 0.00, 'Defra Illustrative Base Fees 2025/2026 Table 2'),
    ('DK', 'PLASTIC', 'DKK', 3200.00, 0.00, 0.00, 25.00, 'DPA / VANA Tariff Notification 2026'),
    ('DK', 'GLASS', 'DKK', 950.00, 0.00, 0.00, 0.00, 'DPA / VANA Tariff Notification 2026'),
    ('DK', 'STEEL', 'DKK', 1400.00, 0.00, 0.00, 0.00, 'DPA / VANA Tariff Notification 2026');
    """)
    print("Tariffs inserted!", flush=True)

conn.close()
print("DONE SEEDING!", flush=True)

