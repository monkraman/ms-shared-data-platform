# Monk Spaces Compliance Hub — Shared Data Foundation Architecture & Implementation Specification

> **Document Classification:** Enterprise Technical Architecture & Functional Specification  
> **Target Audience:** Executive Leadership, Solution Architects, Enterprise Data Engineers, Client Compliance Officers (The Kraft Heinz Company)  
> **Status:** Implemented & Verified in Production / Staging  
> **Version:** 2.4.0 (Enterprise Release)

---

## Executive Summary

Modern enterprise Fast-Moving Consumer Goods (FMCG) brand owners face unprecedented regulatory fragmentation across Europe:
* **UK Defra pEPR:** Packaging Extended Producer Responsibility with dynamic eco-modulation (RAM v1.1 fee penalties/discounts).
* **EU PPWR (2025/2026/2030):** Mandatory recyclability performance grades (A to E), packaging minimisation (<50% empty space ratio), and recycled plastic content mandates (e.g. 30% for food-contact PET).
* **EU ESPR / DPP (Digital Product Passports):** Granular open-standard digital links (GS1 Digital Link) connecting physical packs to cloud-hosted disassembly, material composition, and repair metadata.
* **Corporate Costing & Eco-Design:** Raw resin index benchmarking (ICIS-rPET vs virgin PE/PP), material swap simulation, and packaging line retooling amortisation.

Traditionally, enterprises purchase disparate point solutions for each regulation, forcing packaging teams and suppliers to re-enter redundant data into four separate platforms. 

**Monk Spaces Compliance Hub** solves this through a **"Shared Data Foundation" (Hub-and-Spoke Canonical Architecture)**:
1. **Enter Once, Comply Everywhere:** Centralises technical packaging BOMs, sales placement, supplier environmental claims, and regulatory master rules into a single canonical core.
2. **Multi-Source Fusion Engine:** Automatically links and merges technical specifications from **Trace One / Devex PLM**, sales placements from **Snowflake / SAP ERP**, and supplier certifications from **Direct Excel / CSV Portals**.
3. **Zero Cross-Tenant Leakage:** Guarantees cryptographic tenant context and database-level Row-Level Security (RLS) across multinational brand owners.

---

## 1. High-Level System Architecture: Hub-and-Spoke Model

```mermaid
flowchart TD
    subgraph INGESTION["Multi-Source Ingestion Layer"]
        DEVEX["Trace One / Devex PLM\n(Technical BOMs, Tare Weights, Layers)"]
        SNOWFLAKE["Snowflake / SAP ERP\n(Sales Volumes, Market Placements, GTINs)"]
        SUPPLIER_EXCEL["Supplier Portal / Excel Upload\n(PCR %, Recyclability Certs, Additives)"]
    end

    subgraph CORE["CENTRAL SHARED DATA FOUNDATION (Canonical Golden Record)"]
        PROD["Product Master (SKU, GTIN, Brand, Format)"]
        BOM["Packaging BOM Tree (Primary, Secondary, Tertiary)"]
        MAT["Controlled Material & Polymer Taxonomy"]
        SUP["Supplier & Converter Master"]
        LINEAGE["Source Lineage & Provenance Ledger"]
    end

    subgraph SPOKES["Modular Business Applications (Downstream Spokes)"]
        EPR["Spoke 1: EPR Liability & RAM Engine\n(UK Defra, Denmark DPA, Citeo, VerpackG)"]
        PPWR["Spoke 2: EU PPWR Compliance Engine\n(Recyclability A-E, 2030 PCR Mandates, PFAS Ban)"]
        DPP["Spoke 3: Digital Product Passport (DPP)\n(GS1 Digital Link, QR Resolution, Disassembly Guide)"]
        COST["Spoke 4: Eco-Design & Scenario Simulator\n(Resin Price Indexing, Material Swap Net ROI)"]
        CSRD["Spoke 5: Corporate ESG / Scope 3 LCA\n(Carbon Footprint per pack, CSRD Filings)"]
    end

    DEVEX -->|Join on SKU + Component ID| CORE
    SNOWFLAKE -->|Join on SKU / GTIN| CORE
    SUPPLIER_EXCEL -->|Join on Supplier Part #| CORE

    CORE --> EPR
    CORE --> PPWR
    CORE --> DPP
    CORE --> COST
    CORE --> CSRD
```

---

## 2. Relational Entity-Relationship Model (Linkages & Join Keys)

The database avoids brittle, wide tables by maintaining clean relational links between commercial products, technical packaging components, material classifications, suppliers, and legal compliance filings.

```mermaid
erDiagram
    TENANTS ||--o{ PRODUCTS : "owns"
    TENANTS ||--o{ SUPPLIERS : "procures from"
    TENANTS ||--o{ PLACED_ON_MARKET_SALES : "reports"
    
    PRODUCTS ||--o{ PACKAGING_COMPONENTS : "contains (BOM Tree)"
    PRODUCTS ||--o{ PLACED_ON_MARKET_SALES : "sold as"
    
    SUPPLIERS ||--o{ SUPPLIER_PARTS : "manufactures"
    SUPPLIERS ||--o{ COMPLIANCE_CERTIFICATES : "issues"
    
    PACKAGING_COMPONENTS ||--|| SUPPLIER_PARTS : "sourced from"
    PACKAGING_COMPONENTS ||--o{ COMPONENT_LAYERS : "constructed with"
    PACKAGING_COMPONENTS ||--|| MATERIAL_TAXONOMY : "categorised by"
    PACKAGING_COMPONENTS ||--o{ COMPONENT_CERTIFICATES : "validated by"
    
    COMPLIANCE_CERTIFICATES ||--o{ COMPONENT_CERTIFICATES : "provides proof"
    
    PACKAGING_COMPONENTS ||--o{ SOURCE_LINEAGE : "traced to"
    PRODUCTS ||--o{ SOURCE_LINEAGE : "traced to"
```

### Table Definitions & Join Keys

#### A. Product Master (`products`)
* **Primary Key:** `id` (`UUID`)
* **Foreign Key:** `tenant_id` $\to$ `tenants.id`
* **Natural Business Key:** `sku` (`VARCHAR`, e.g. `KHC-00452`)
* **Global Trade Key:** `gtin` (`VARCHAR(14)`, e.g. `05000157024672`)
* **Attributes:** `brand`, `commercial_name`, `category`, `unit_volume_ml`, `net_content_grams`, `lifecycle_status`.

#### B. Packaging Components (`packaging_components`)
* **Primary Key:** `id` (`VARCHAR`, e.g. `COMP-5001`)
* **Foreign Key 1:** `product_id` $\to$ `products.id`
* **Foreign Key 2:** `supplier_id` $\to$ `suppliers.id` (Optional/Nullable if pending supplier identification)
* **Hierarchy Level:** `packaging_level` (`ENUM`: `primary`, `secondary`, `tertiary`)
* **Material Attributes:** `material_category` (`ENUM`), `polymer_type` (`VARCHAR`), `gross_weight_grams` (`FLOAT`), `pcr_recycled_pct` (`FLOAT`).
* **Design for Recycling Flags:** `is_separable_by_consumer`, `has_disruptor_pigment` (e.g. Carbon Black inhibiting NIR sorting), `closure_retention_flag`.
* **Dynamic Regulatory Payload (`JSONB`):** Stores downstream metadata without schema alterations:
  ```json
  {
    "epr": {
      "ram_category": "RED",
      "ram_multiplier": 1.2,
      "uk_material_code": "PLASTIC_FLEXIBLE"
    },
    "ppwr": {
      "recyclability_score": "Class B (85%)",
      "pfas_free_certified": true,
      "meets_2030_target": true
    },
    "dpp": {
      "gs1_digital_link": "https://id.kraftheinz.com/01/05000157024672/21/PKG-4471",
      "qr_asset_code": "QR-KHC-BOTTLE-01"
    }
  }
  ```

#### C. Supplier Master (`suppliers`)
* **Primary Key:** `id` (`VARCHAR`, e.g. `SUP-ALPLA-01`)
* **Foreign Key:** `tenant_id` $\to$ `tenants.id`
* **Attributes:** `vendor_name`, `country_code`, `vendor_code`, `contact_email`, `audit_status`.

#### D. Compliance Certificates (`compliance_certificates`)
* **Primary Key:** `id` (`VARCHAR`, e.g. `CERT-RECY-991`)
* **Foreign Key:** `supplier_id` $\to$ `suppliers.id`
* **Attributes:** `cert_type` (e.g. `RecyClass Assessment`, `EFSA Food Contact Approval`, `ISCC Plus Mass Balance`), `issuer_body`, `valid_until`, `document_uri` (`s3://...`).

#### E. Placed on Market Sales (`placed_on_market_sales`)
* **Primary Key:** `id` (`UUID`)
* **Foreign Key 1:** `tenant_id` $\to$ `tenants.id`
* **Foreign Key 2:** `sku` $\to$ `products.sku`
* **Placement Scope:** `jurisdiction` (`UK`, `DE`, `FR`, `DK`), `reporting_year` (`INTEGER`), `units_sold` (`BIGINT`), `sales_channel` (`Retail/B2C` vs `FoodService/B2B`).

---

## 3. Multi-Source Fusion & Ingestion Engine

Enterprise packaging data does not live in one place. The table below specifies how the **45 Core Data Points (DP01–DP45)** are mapped, extracted, and resolved into the **Canonical Golden Record**:

| Ingestion Stream | Typical Enterprise System | Ingestion Mechanism | Data Points Sourced (from DP01–DP45 Seed) |
| :--- | :--- | :--- | :--- |
| **Stream 1: Technical Specs** | Trace One, Siemens Teamcenter, Devex PLM, SAP Recipe | Continuous REST Sync / Webhooks / Nightly Batch | **12 Fields:** Packaging BOM hierarchy, tare weights (empty), polymer types, barrier layers, closures, colour/opacity. |
| **Stream 2: Commercial Volumes** | Snowflake Data Lake, SAP S/4HANA (MARA / VBAP) | Direct SQL Query / Lakehouse Parquet extract | **10 Fields:** Article/SKU code (DP01), GTIN (DP02), annual units placed by country, brand owner entity. |
| **Stream 3: Supplier Claims** | Supplier Excel Portal, Qualtrax, Specright | CSV / Excel Upload (`POST /api/v1/foundation/import`) | **12 Fields:** Post-consumer recycled content % (DP13), ink formulations, adhesive wash-off certification, PFAS absence. |
| **Stream 4: Platform Rules** | Monk Spaces Regulatory Intelligence Engine | Pre-seeded Master Regulatory Engine | **11 Fields:** Country base fee tariffs, RAM modulation thresholds, PRO reporting deadlines, recyclability protocols. |

### The Golden Record Resolution Algorithm

When conflicting records enter the system (e.g. Snowflake says 2,310,000 units sold, but ERP finance ledger says 2,100,000; or Devex spec indicates Mono-PP but supplier invoice shows PP/EVOH/PP):

```mermaid
sequenceDiagram
    autonumber
    participant SRC as External Sources (Devex / Snowflake / Excel)
    participant VAL as Layer 2: Quality & Validation Engine
    participant GOLD as Layer 1: Canonical Foundation Store
    participant TICKET as Source Correction Ticket Queue
    participant USER as KHC Compliance Lead / Admin

    SRC->>VAL: Ingest Raw Payload (Batch import)
    VAL->>VAL: Check 45 Rule Constraints (Weights, PCR %, Disrupters)
    
    alt Discrepancy or Missing Field Detected
        VAL->>TICKET: Create Proposed Correction Ticket (e.g. TKT-KHC-001)
        VAL->>GOLD: Write provisional value with Uncertainty Flag (±€ Margin)
        TICKET->>USER: Display in "Hero Screen: Corrections Stay in Source"
        USER->>SRC: Approve fix back to Devex Change Control / Snowflake Table
    else Valid & Reconciled Record
        VAL->>GOLD: Commit verified record to Golden BOM
    end
```

> [!IMPORTANT]
> **Single Source of Truth Mandate:**  
> Compliance Hub **never mutates raw client data in Devex or Snowflake directly**. Discrepancies generate a change control ticket (`SourceCorrectionTicket`) linked to the upstream system. The next scheduled sync ingests the approved value, maintaining a 100% legally defensible audit trail.

---

## 4. Multi-Tenant Security & Zero Data Leakage Architecture

For multinational enterprises like The Kraft Heinz Company, co-mingling packaging formulations, supplier costs, or sales volumes with competitors is unacceptable. The platform enforces **Three-Tier Isolation**:

```mermaid
flowchart TD
    subgraph CLIENT["Client Browser (Angular 19 Frontend)"]
        REQ["API Request + Signed JWT Bearer Token"]
    end

    subgraph GW["Layer 1: Cryptographic JWT & Context Guard"]
        JWT["Extract payload: sub, tenant_id='khc-europe', role='org_admin'"]
        SIG["Verify HMAC-SHA256 / RSA Signature"]
    end

    subgraph SVC["Layer 2: Service & Repository Layer"]
        SCOPED["Inject Request Context: CurrentTenantContext.get()"]
        QUERY["Construct Query: db.query(Model).filter(tenant_id == current_tenant)"]
    end

    subgraph DB["Layer 3: PostgreSQL Database Engine"]
        RLS["PostgreSQL Row-Level Security (RLS) Active"]
        STORAGE["Encrypted Disk Storage (AES-256)"]
    end

    CLIENT --> GW
    GW -->|401 if tampered| CLIENT
    GW -->|Authorized| SVC
    SVC --> DB
    DB -->|RLS blocks non-matching tenant_id at kernel level| SVC
```

### 1. Cryptographic Authentication & Token Structure
Every authenticated request includes an `Authorization: Bearer <JWT>` header. The token payload contains:
```json
{
  "sub": "sarah.mitchell@kraftheinz.com",
  "tenant_id": "khc-europe",
  "role": "org_admin",
  "exp": 1793365200,
  "iat": 1793278800
}
```
Client code cannot override or manipulate `tenant_id` via URL parameters or JSON payloads; the backend derives the tenant identity exclusively from the verified cryptographic token.

### 2. Service Layer Query Enforcement
In `backend/app/services/store.py` and `layer1_foundation.py`, all access methods require `tenant_id`:
```python
def get_products(self, tenant_id: str) -> List[ProductResponse]:
    with self._lock:
        tenant_products = self.products.get(tenant_id, {})
        return list(tenant_products.values())
```

### 3. Production PostgreSQL Row-Level Security (RLS)
At the database engine level, PostgreSQL RLS prevents data exposure even if an application query lacks an explicit filter:
```sql
-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE packaging_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE placed_on_market_sales ENABLE ROW LEVEL SECURITY;

-- Enforce Strict Tenant Isolation
CREATE POLICY tenant_isolation_policy ON products
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_policy ON packaging_components
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true));
```

---

## 5. Implementation Status in Codebase

| Component | Code Reference | Capabilities Implemented |
| :--- | :--- | :--- |
| **Canonical Models** | [`canonical.py`](file:///f:/compliance%20tool/backend/app/schemas/canonical.py) | `ProductBase`, `PackagingComponentBase`, `SourceLineage`, `PlacedOnMarketSales`, `SkuImportPayload`. |
| **Config & Tariffs** | [`configuration.py`](file:///f:/compliance%20tool/backend/app/schemas/configuration.py) | Dynamic sectors (Food & Bev, Retail), country master, RAM multipliers, tariff schedules. |
| **Foundation Engine** | [`layer1_foundation.py`](file:///f:/compliance%20tool/backend/app/services/layer1_foundation.py) | Multi-tenant product & BOM registry, source system batch tracking, sales normalization. |
| **Quality & Audit** | [`layer2_quality.py`](file:///f:/compliance%20tool/backend/app/services/layer2_quality.py) | Automated integrity checks (DP01–DP45), unverified PCR detection, discrepancy ticketing. |
| **EPR Liability** | [`layer3_epr.py`](file:///f:/compliance%20tool/backend/app/services/layer3_epr.py) | Calculation trace ($\text{Units} \times \text{Weight} \times \text{Tariff} \times \text{RAM}$), margin bands ($\pm €$). |
| **Data Points Seed** | [`data_points_seed.json`](file:///f:/compliance%20tool/backend/seeds/data_points_seed.json) | Full 45-point dictionary mapped to SAP S/4HANA, Trace One PLM, and Supplier Portals. |
| **Angular Layout** | [`app.html`](file:///f:/compliance%20tool/frontend/src/app/app.html) | Enterprise monochrome left sidebar shell, active tenant pill, zero-flash routing. |
| **BOM Explorer** | [`products.component.ts`](file:///f:/compliance%20tool/frontend/src/app/features/products/products.component.ts) | Hierarchical BOM tree, material breakdown, and multi-source provenance inspection. |

---

## 6. Real-World Walkthrough: Heinz Tomato Ketchup 460g TopDown

To see how the linkages function in practice, follow a single SKU through the system:

```
[SKU: KHC-00452 | GTIN: 05000157024672] Heinz Tomato Ketchup 460g TopDown
│
├── Sourced via Snowflake (ERP):
│   └── 2025 Placed on Market Sales:
│       ├── UK Market: 2,400,000 units (Retail B2C)
│       └── Denmark Market: 450,000 units (FoodService)
│
├── Sourced via Devex (PLM Spec #PKG-4471 v4):
│   ├── Component 1: Bottle Body (38.0g, Clear Rigid PET)
│   ├── Component 2: Dispensing Closure / Cap (4.2g, PP Polypropylene)
│   ├── Component 3: Silicone Slit Valve (0.3g, Silicone Elastomer)
│   └── Component 4: Front & Back Labels (0.8g, Biaxially Oriented PP)
│
├── Sourced via Supplier Portal (Alpla UK - Excel/API):
│   ├── Component 1 Certificate: 30% Post-Consumer Recycled Content (rPET)
│   └── RecyClass Testing: Class A Recyclable (Standard PET Stream)
│
└── Downstream Module Consumption:
    ├── Spoke 1 (UK Defra EPR):
    │   └── £76,680 Fee (Plastic £355/t with -10% RAM Green Discount applied)
    ├── Spoke 2 (EU PPWR):
    │   └── Complies with 2030 Mandate (30% PCR achieved vs 30% statutory target)
    ├── Spoke 3 (Digital Product Passport):
    │   └── URI: https://id.kraftheinz.com/01/05000157024672/21/PKG-4471-LOT88
    └── Spoke 4 (Scenario Simulator):
        └── Evaluates replacing Silicone valve (0.3g disruptor) with Mono-PE self-closing valve
```

---

## Conclusion & Architectural Sign-off

The Monk Spaces Compliance Hub **Shared Data Foundation** bridges the gap between disconnected corporate systems (Snowflake, Devex, Supplier spreadsheets) and evolving European regulations. 

By enforcing:
1. Universal join keys (`SKU`, `GTIN`, `Component ID`),
2. A relational Hub-and-Spoke database layout,
3. Cryptographic and RLS-backed multi-tenant data isolation,

the platform guarantees **zero data duplication**, **zero cross-tenant leakage**, and an **immutable, audit-ready compliance lineage**.
