# Canonical Data Model & Data Points Specification

Based on team reference documents (`reference-docs-teams/EPR PPWR Data Points.xlsx`, `UK EPR Data Flowchart 3.docx`, and `packaging_data_example_file_2025_LP_submission_v4.csv`), this document defines the verified canonical data model for Monkspaces.

---

## 1. Core Architecture Layers

```
Layer 3: Compliance Plugin Modules (UK EPR, DE VerpackG, FR Citeo, PPWR DoC & Technical File)
             ▲
             │ Reads clean, governed canonical data
Layer 2: Data Quality & Gap Resolution Engine (Country/Market-specific rules, issue queue, source tickets)
             ▲
             │ Normalizes & Maps
Layer 1: Shared Canonical Data Foundation (Products, BOM Components, Materials, Suppliers, Sales)
             ▲
             │ Ingests (Read-only, no write-back)
Source Systems (SAP ERP S/4HANA, PLM / Trace One Devex, Supplier Declarations, Manual Client Entry)
```

---

## 2. Confirmed 45 Canonical Data Points (DP01 – DP45)

All ingested records map into these standardized data points across four originating source systems:

### A. Product Master & BOM (Origin: ERP - SAP S/4HANA & PLM Specs)
| ID | Data Point | Primary Source | Example Source Field | Scope / Used In |
|---|---|---|---|---|
| **DP01** | Article / SKU Number | SAP S/4HANA | `MARA-MATNR` | PPWR, Audit & Lineage |
| **DP02** | GTIN / Barcode | SAP S/4HANA | `MARA-EAN11` | PPWR, Product Passport |
| **DP03** | Packaging Component List (BOM) | SAP S/4HANA | `STKO / STPO` | National EPR, Fee Calc, PPWR |
| **DP04** | Packaging Level (Primary, Secondary, Tertiary) | PLM Specs | `PLM component attribute` | National EPR, Fee Calc |
| **DP05** | Units Per Pack | SAP S/4HANA | `STPO-MENGE` | National EPR, Fee Calc |
| **DP06** | Component Material (Main) | PLM Specs | `PLM material class` | National EPR, Fee Calc, PPWR |
| **DP09** | Component Weight (Empty, grams) | PLM Specs | `PLM net weight (g)` | National EPR, Fee Calc, PPWR |
| **DP15** | Reusable vs Single-Use Flag | PLM Specs | `PLM packaging attribute` | National EPR, Fee Calc, PPWR |
| **DP16** | Food-Contact Packaging Flag | PLM Specs | `PLM food contact cert` | PPWR Technical File |
| **DP20** | Minimisation Evidence | PLM Specs | `Design optimization spec`| PPWR Technical File |
| **DP21** | Empty Space Ratio (%) | PLM Specs | `Headspace calculation` | PPWR Technical File |
| **DP35** | Triman Logo & Info-Tri Specs | PLM Specs | `Label artwork spec` | French EPR (Citeo) |
| **DP36** | Environmental Label Codes | PLM Specs | `E-label registry` | National Labeling |
| **DP39** | Harmonised Material Label | PLM Specs | `EU label standard` | PPWR |
| **DP40** | QR Code / Data Carrier Reference | PLM Specs | `Digital carrier link` | PPWR / DPP |
| **DP44** | Weight Source & Scale Calibration | PLM Specs | `Measurement log` | Audit File |

### B. Material Composition & Supplier Declarations (Origin: Supplier)
| ID | Data Point | Primary Source | Example Source Field | Scope / Used In |
|---|---|---|---|---|
| **DP07** | Polymer Type (PET, HDPE, PP, LDPE) | Supplier | `Polymer spec sheet` | National EPR, Fee Modulation |
| **DP08** | Multi-Material Composition Split (%) | Supplier | `Component breakdown %`| National EPR, Fee Calc, PPWR |
| **DP10** | Colour and Opacity | Supplier | `Colorant / masterbatch` | Fee Eco-modulation, PPWR |
| **DP11** | Additives, Inks and Adhesives (Disruptors) | Supplier | `Disruptor declaration` | Fee Eco-modulation, PPWR |
| **DP12** | Recyclability Test / RAM Rating | Supplier / Lab | `Recyclability cert` | Fee Modulation (UK RAM, Citeo) |
| **DP13** | Recycled Content % (PCR) | Supplier | `PCR % declaration` | Fee Modulation, Plastic Tax, PPWR |
| **DP14** | Recycled Content Certificate | Supplier | `ISO / EN certificate` | Audit Evidence |
| **DP17** | PFAS Declaration | Supplier | `Chemical safety sheet` | PPWR Chemical Safety |
| **DP18** | Heavy Metals Content (<100ppm) | Supplier | `Heavy metal test cert` | PPWR Technical File |
| **DP19** | Substances of Concern | Supplier | `SVHC / REACH list` | PPWR Technical File |
| **DP38** | Non-Recycled Plastic Weight | Supplier | `Virgin resin calculation`| Plastic Packaging Tax |
| **DP42** | Technical File References | Supplier | `Document archive link` | PPWR Technical File |
| **DP43** | Supplier Per Component | SAP ERP | `Vendor master (LFA1)` | Supplier Registry & PPWR |

### C. Commercial, Sales & Distribution (Origin: ERP - SAP S/4HANA)
| ID | Data Point | Primary Source | Example Source Field | Scope / Used In |
|---|---|---|---|---|
| **DP22** | Units Placed on Market | SAP S/4HANA | `Billing doc (VBRK/VBRP)`| National EPR, Fee Calculation |
| **DP23** | Sales Channel (Retail / On-Trade / Online) | SAP S/4HANA | `Distribution channel` | EPR Household vs Commercial |
| **DP24** | Delivery Nation (EN, SC, WS, NI, etc.) | SAP S/4HANA | `Ship-to country/region` | Nation-specific allocation |
| **DP25** | Exports Out of Country | SAP S/4HANA | `Export invoice` | EPR Exemptions |
| **DP27** | Import Country of Origin | SAP S/4HANA | `Customs import record` | National EPR Activity (IM) |

### D. Compliance, Scheme & Organizational Governance (Origin: Client Team / Manual)
| ID | Data Point | Primary Source | Purpose |
|---|---|---|---|
| **DP26** | Deposit Return Scheme (DRS) Status | Client Team | DRS exemption from EPR fees |
| **DP28** | Producer Role (Brand Owner, Packer/Filler, Importer) | Client Team | Obligation determination (SO, PF, IM) |
| **DP29** | National EPR Registration Number (e.g., RPD Org ID) | Client Team | Regulatory reporting identity |
| **DP30** | Compliance Scheme Membership (PRO) | Client Team | Compliance Producer Responsibility Org |
| **DP31** | Authorised Representative (EU / UK) | Client Team | Cross-border legal entity |
| **DP32** | Organisation Size & Thresholds (Large / Small) | Client Team | Obligation thresholds (UK Defra: Large/Small) |
| **DP33** | Reporting Period (e.g., 2025-H1, 2025-H2) | Client Team | Calculation time window |
| **DP34** | Declaration of Completeness | Client Team | Formal regulatory sign-off |
| **DP37** | CONAI Plastic Band (Italy) | Client Team | Italian eco-modulation tier |
| **DP41** | DoC Reference and Version | Client Team | PPWR Declaration of Conformity version |
| **DP45** | Sign-Off Owner | Client Team | Audit accountability |

---

## 3. Country-Specific Target Mappings (By Country)

The platform evaluates data completeness and fee calculations for the following 7 jurisdictions:
1. **United Kingdom (UK):** Defra / RPD submission file, PackUK eco-modulated fees based on RAM ratings (Red, Amber, Green), household vs non-household.
2. **Germany (DE):** VerpackG, LUCID registration, Dual System participation, recyclability guidelines.
3. **France (FR):** Citeo / Léko, Triman logo & Info-tri validation, eco-modulation bonuses/maluses.
4. **Italy (IT):** CONAI registration, environmental labeling, plastic contribution bands.
5. **Spain (ES):** Real Decreto 1055/2022, plastic tax non-recycled reporting.
6. **Netherlands (NL):** Afvalfonds Verpakkingen, tariefdifferentiatie.
7. **Denmark (DK):** DPA system, producer responsibility scheme.

---

## 4. UK Defra RPD Standard Submission Schema

For the initial UK EPR vertical slice, exports must reconcile to the official Defra RPD specification:
- `organisation_id` (string): Producer registered ID (e.g. `100004`)
- `subsidiary_id` (string, optional): Subsidiary identifier
- `organisation_size` (string): `L` (Large) or `S` (Small)
- `submission_period` (string): e.g. `2025-H1`, `2025-H2`
- `packaging_activity` (string): `SO` (Supplied under brand), `PF` (Packed/filled), `IM` (Imported), etc.
- `packaging_type` (string): `HH` (Household), `NH` (Non-household), `CW` (Carrier bags), `HDC` (Drinks containers), `PB` (Public bin), `OW` (Other)
- `packaging_class` (string): `P1`, `P3`, `P4`, `O1`, `O2`, `B1`, `B2`
- `packaging_material` (string): `PL` (Plastic), `PC` (Paper/Cardboard), `GL` (Glass), `AL` (Aluminium), `WD` (Wood), `FC` (Fibre-based composite), `OT` (Other)
- `packaging_material_subtype` (string, optional): `Flexible`, `Rigid`, `Ceramic`, `Bamboo`
- `from_country` / `to_country` (string, optional): `EN`, `SC`, `WS`, `NI`
- `packaging_material_weight` (numeric): Gross weight (grams or kg per specification)
- `ram_rag_rating` (string): `R` (Red), `A` (Amber), `G` (Green), `R-M` (Red Modulated), `A-M` (Amber Modulated)

