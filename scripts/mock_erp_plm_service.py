"""Standalone Mock ERP (SAP/Snowflake) & PLM (Trace One Devex) Server.

Run standalone to simulate enterprise upstream client systems:
    python scripts/mock_erp_plm_service.py --port 8090

Or deploy to Render / Railway / AWS Lambda as an isolated client mock API.
"""

from typing import List, Dict, Any, Optional
import os
import sys
import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx

app = FastAPI(
    title="Mock Client Enterprise Systems API (Snowflake & Trace One Devex)",
    version="1.0.0",
    description="Simulates upstream enterprise IT systems for Kraft Heinz and FMCG packaging clients."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Mock Devex PLM Specifications Database ───
DEVEX_SPECS = [
    {
        "specification_id": "DEV-8821",
        "sku": "KHC-HTK-500G-GL",
        "product_name": "Heinz Tomato Ketchup 500g Glass Bottle",
        "brand": "The Kraft Heinz Company",
        "net_fill_mass_g": 500,
        "components": [
            {
                "component_id": "COMP-HK-001",
                "name": "Flint Glass Bottle",
                "packaging_level": "Primary",
                "material": "Glass",
                "tare_weight_grams": 285.0,
                "recycled_content_pct": 0.0,
                "is_recyclable": True
            },
            {
                "component_id": "COMP-HK-002",
                "name": "Tinplate Steel Lug Cap 43mm",
                "packaging_level": "Primary",
                "material": "Steel / Tinplate",
                "tare_weight_grams": 12.0,
                "recycled_content_pct": 25.0,
                "is_recyclable": True
            },
            {
                "component_id": "COMP-HK-003",
                "name": "Paper Neck & Body Label (Washable Adhesive)",
                "packaging_level": "Primary",
                "material": "Paper / Cardboard",
                "tare_weight_grams": 2.5,
                "recycled_content_pct": 0.0,
                "is_recyclable": True
            }
        ],
        "lab_test_references": {
            "recyclass_cert": "RC-2025-EU-889",
            "pfas_free_tested": True,
            "heavy_metals_pass": True
        }
    },
    {
        "specification_id": "DEV-9104",
        "sku": "KHC-SQUEEZY-400G",
        "product_name": "Heinz Ketchup Top-Down Squeezy 400g",
        "brand": "The Kraft Heinz Company",
        "net_fill_mass_g": 400,
        "components": [
            {
                "component_id": "COMP-HK-SQ-01",
                "name": "Multi-layer Barrier PET Bottle",
                "packaging_level": "Primary",
                "material": "Plastic Rigid (PET)",
                "tare_weight_grams": 38.0,
                "recycled_content_pct": 30.0,
                "is_recyclable": True
            },
            {
                "component_id": "COMP-HK-SQ-02",
                "name": "Polypropylene Dispensing Closure",
                "packaging_level": "Primary",
                "material": "Plastic Rigid (PP)",
                "tare_weight_grams": 8.5,
                "recycled_content_pct": 0.0,
                "is_recyclable": True
            }
        ],
        "lab_test_references": {
            "recyclass_cert": "RC-2025-EU-944",
            "pfas_free_tested": True,
            "heavy_metals_pass": True
        }
    }
]

# ─── Mock Snowflake Data Warehouse Sales Records ───
SNOWFLAKE_SALES = [
    {
        "sku": "KHC-HTK-500G-GL",
        "gtin": "05000157024672",
        "reporting_year": 2026,
        "market_code": "GB",
        "market_name": "United Kingdom",
        "annual_units_invoiced": 4200000,
        "gross_revenue_gbp": 9660000.0,
        "sales_channel": "Retail Grocery (Tesco, Sainsbury's, Asda)"
    },
    {
        "sku": "KHC-HTK-500G-GL",
        "gtin": "05000157024672",
        "reporting_year": 2026,
        "market_code": "DK",
        "market_name": "Denmark",
        "annual_units_invoiced": 450000,
        "gross_revenue_gbp": 1035000.0,
        "sales_channel": "Nordic Retail (Salling Group, Coop DK)"
    },
    {
        "sku": "KHC-SQUEEZY-400G",
        "gtin": "05000157028915",
        "reporting_year": 2026,
        "market_code": "GB",
        "market_name": "United Kingdom",
        "annual_units_invoiced": 8500000,
        "gross_revenue_gbp": 17850000.0,
        "sales_channel": "Retail Grocery"
    }
]


@app.get("/")
def root():
    return {
        "service": "Mock Client Enterprise Systems API",
        "connected_systems": ["Snowflake Data Cloud", "Trace One Devex PLM", "SAP S/4HANA"],
        "status": "ONLINE",
        "endpoints": {
            "devex_specs": "/api/devex/v2/packaging-specs",
            "snowflake_sales": "/api/snowflake/v1/sales-by-market",
            "trigger_push_to_platform": "/api/webhook/push-to-compliance-hub"
        }
    }


@app.get("/health")
def health():
    return {"status": "healthy", "uptime_pct": 99.98}


# ─── 1. Trace One Devex PLM Endpoint ───
@app.get("/api/devex/v2/packaging-specs")
def get_devex_packaging_specs(
    spec_id: Optional[str] = Query(None, description="Optional specification filter")
):
    """Simulates Trace One Devex PLM REST API returning multi-level packaging BOMs."""
    if spec_id:
        match = next((s for s in DEVEX_SPECS if s["specification_id"] == spec_id or s["sku"] == spec_id), None)
        if not match:
            raise HTTPException(status_code=404, detail=f"Trace One specification '{spec_id}' not found.")
        return match
    return {
        "total_specifications": len(DEVEX_SPECS),
        "source_system": "Trace One PLM (Devex Enterprise Server)",
        "results": DEVEX_SPECS
    }


# ─── 2. Snowflake Data Cloud Endpoint ───
@app.get("/api/snowflake/v1/sales-by-market")
def get_snowflake_sales_by_market(
    year: int = 2026,
    market: Optional[str] = None
):
    """Simulates Snowflake Data Cloud analytics query returning sales volume by jurisdiction."""
    filtered = [s for s in SNOWFLAKE_SALES if s["reporting_year"] == year]
    if market:
        filtered = [s for s in filtered if s["market_code"] == market.upper()]
    return {
        "query_id": "QRY-SNOW-9921-EU",
        "reporting_year": year,
        "total_records": len(filtered),
        "warehouse_cluster": "COMPUTE_WH (AWS eu-west-1)",
        "results": filtered
    }


# ─── 3. Webhook: Push live batch into Monk Spaces Compliance Hub ───
class PushRequest(BaseModel):
    compliance_hub_url: str = "http://localhost:8000"
    tenant_id: str = "khc-europe"
    spec_id: str = "DEV-8821"

@app.post("/api/webhook/push-to-compliance-hub")
def trigger_push_to_compliance_hub(req: PushRequest):
    """Pushes a simulated delta extraction into the main platform via REST webhook."""
    spec = next((s for s in DEVEX_SPECS if s["specification_id"] == req.spec_id), DEVEX_SPECS[0])
    
    # Format canonical import payload
    total_weight = sum(c["tare_weight_grams"] for c in spec["components"])
    pcr_weighted = sum(c["tare_weight_grams"] * c["recycled_content_pct"] for c in spec["components"]) / max(total_weight, 1)

    payload = {
        "tenant_id": req.tenant_id,
        "source_name": f"TraceOne_AutoPush_{spec['specification_id']}.csv",
        "items": [
            {
                "sku": spec["sku"],
                "name": spec["product_name"],
                "brand": spec["brand"],
                "category": "Condiments & Sauces",
                "material": spec["components"][0]["material"],
                "packaging_weight_grams": total_weight,
                "recycled_content_pct": round(pcr_weighted, 1),
                "is_recyclable": True,
                "units_sold": 4200000,
                "jurisdiction": "GB"
            }
        ]
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                f"{req.compliance_hub_url}/api/v1/foundation/import",
                json=payload
            )
            return {
                "status": "pushed_successfully",
                "http_status": resp.status_code,
                "platform_response": resp.json() if resp.status_code in [200, 201] else resp.text
            }
    except Exception as e:
        return {
            "status": "simulated_local_only",
            "note": "Could not connect to external URL, returning local validated payload",
            "simulated_payload": payload,
            "error_detail": str(e)
        }


if __name__ == "__main__":
    port = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[1] == "--port" else 8090
    print(f"Starting Mock Enterprise PLM & Snowflake Server on port {port}...")
    uvicorn.run("mock_erp_plm_service:app", host="0.0.0.0", port=port, reload=True)

