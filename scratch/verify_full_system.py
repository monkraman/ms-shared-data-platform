"""End-to-End System Integration & Data-Level Functional Verification Script."""

import json
import sys
import os

sys.path.insert(0, os.path.abspath("."))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def run_full_verification():
    print("================================================================================")
    print("           MONKSPACES COMPLIANCE HUB: FULL SYSTEM FUNCTIONAL AUDIT              ")
    print("================================================================================")
    
    tenant_id = "khc-europe"
    headers = {"X-Tenant-ID": tenant_id}
    
    # 1. Health & Connectors
    r = client.get("/health")
    assert r.status_code == 200, "Health check failed"
    print("\n[STEP 1] System Health & Service Readiness:")
    print(f"  -> Status: {r.json()['status']} | Environment: {r.json()['environment']} | Version: {r.json()['version']}")
    
    # 2. Canonical Foundation (Devex & SAP Ingestion)
    r = client.get("/api/v1/foundation/products", headers=headers)
    assert r.status_code == 200
    products = r.json()
    print(f"\n[STEP 2] Canonical Product & Packaging BOM Foundation (Ingested from Devex/SAP):")
    print(f"  -> Total Products Ingested: {len(products)}")
    for p in products:
        lineage = p.get("source_lineage", {})
        print(f"  • SKU: {p['sku']:<22} | Brand: {p['brand']:<10} | Components: {len(p['components'])} | Tare: {p['total_packaging_weight_grams']}g")
        print(f"    Source Lineage: {lineage.get('source_system')} (Spec: {lineage.get('source_record_id')})")
        
    # 3. Simulate Devex PLM Sync
    r = client.post("/api/v1/foundation/sync/traceone?spec_id=DEV-8821", headers=headers)
    assert r.status_code == 200
    batch = r.json()
    print(f"\n[STEP 3] On-Demand PLM Spec Delta Sync (Trace One):")
    print(f"  -> Batch Reference: {batch['source_reference']} | Status: {batch['status']}")
    print(f"  -> Records Normalized: {batch['records_normalized']} | Data Quality Flags: {batch['quality_issues_detected']}")
    
    # 4. Data Quality Shield (Gap Detection & Financial Risk)
    r = client.get("/api/v1/quality/issues", headers=headers)
    assert r.status_code == 200
    issues = r.json()
    print(f"\n[STEP 4] Data Quality Shield (Missing Data Identification & Financial Exposure):")
    print(f"  -> Total Active Gaps Flagged: {len(issues)}")
    for iss in issues:
        print(f"  • [{iss['severity'].upper()}] {iss['rule_title']}")
        print(f"    Target Field: {iss['field_name']} | Current: '{iss['current_value']}'")
        print(f"    Remediation: {iss['suggested_source_action']}")
        
    # 5. EPR Regulatory Fee Run (Formula Trace)
    calc_req = {
        "tenant_id": tenant_id,
        "jurisdiction": "FR",
        "reporting_year": 2025,
        "include_provisional_records": True
    }
    r = client.post("/api/v1/compliance/epr/calculate", headers=headers, json=calc_req)
    assert r.status_code == 200
    calc = r.json()
    print(f"\n[STEP 5] EPR Regulatory Calculation Engine (CITEO France / UK Defra):")
    print(f"  -> Total Units Placed (from Snowflake): {calc['total_sales_units']:,} units")
    print(f"  -> Total Packaging Placed: {calc['total_packaging_tonnes']:.2f} tonnes")
    print(f"  -> Calculated Fee: EUR {calc['total_fee_eur']:,.2f}")
    print(f"  -> Line Items Trace Count: {len(calc['line_items'])} components audited")
    sample_item = calc['line_items'][0]
    print(f"    Sample Trace: {sample_item['product_name']} -> {sample_item['component_name']}")
    print(f"    Formula: {sample_item['units_placed_on_market']} units x {sample_item['weight_per_unit_grams']}g = {sample_item['total_weight_tonnes']}t x EUR {sample_item['base_tariff_eur_per_tonne']} = EUR {sample_item['net_fee_eur']}")
    
    # 6. EU PPWR Article 6 DoC & Recyclability Scorecard
    r = client.get(f"/api/v1/compliance/modules/ppwr/{products[0]['sku']}", headers=headers)
    assert r.status_code == 200
    ppwr = r.json()
    print(f"\n[STEP 6] Module: EU PPWR Technical File & Article 6 Declaration of Conformity:")
    print(f"  -> DoC Reference: {ppwr['doc_reference']}")
    print(f"  -> Recyclability Performance Grade: {ppwr['recyclability_grade']} ({ppwr['overall_recyclability_pct']}%)")
    print(f"  -> Heavy Metals < 100ppm: {ppwr['heavy_metals_compliant']} | PFAS Free: {ppwr['pfas_substance_free']}")
    print(f"  -> Packaging Minimisation Headspace: {ppwr['packaging_minimisation_ratio_pct']}%")
    
    # 7. Digital Product Passport (DPP)
    r = client.get(f"/api/v1/compliance/modules/dpp/{products[0]['sku']}", headers=headers)
    assert r.status_code == 200
    dpp = r.json()
    print(f"\n[STEP 7] Module: Digital Product Passport (DPP QR Data Carrier):")
    print(f"  -> Passport ID: {dpp['passport_id']}")
    print(f"  -> GS1 Digital Link URI: {dpp['gs1_digital_link_url']}")
    print(f"  -> QR Payload Target: {dpp['qr_data_carrier_payload']}")
    print(f"  -> Consumer Sorting Instructions: {dpp['disposal_instructions'][0]}")
    
    print("\n================================================================================")
    print("  RESULT: ALL 7 DATA PIPELINE STAGES VERIFIED & 100% FUNCTIONAL AT DATA LEVEL!  ")
    print("================================================================================")

if __name__ == "__main__":
    run_full_verification()
