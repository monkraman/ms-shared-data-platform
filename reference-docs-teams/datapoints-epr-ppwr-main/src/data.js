// EPR, PPWR and DPP data point library (sample data; country rules, field mappings and dates are indicative). Includes client profiles (KHC: Trace One Devex and Snowflake, fields to confirm).
// Later steps replace this file with data served by the ERP / supplier API layer.
window.EPR_DATA = {
 "DP": [
  {
   "id": "DP01",
   "name": "Article / SKU number",
   "desc": "Unique product code that every packaging record links to.",
   "src": "erp",
   "field": "SAP material master · MARA-MATNR",
   "out": [
    "evid",
    "doc",
    "dpp"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2026",
   "notes": {},
   "dpp": "Links the passport to the product record.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP02",
   "name": "GTIN / barcode",
   "desc": "Global trade item number, used to match the product across systems and on the data carrier.",
   "src": "erp",
   "field": "SAP material master · MARA-EAN11",
   "out": [
    "doc",
    "lab",
    "dpp"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2026",
   "notes": {},
   "dpp": "The GTIN is the base of the product identifier on the data carrier.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP03",
   "name": "Packaging component list",
   "desc": "Every component of the pack: bottle, closure, label, carton, case, film.",
   "src": "erp",
   "field": "SAP bill of materials · STKO / STPO",
   "out": [
    "rep",
    "fee",
    "doc"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2026",
   "notes": {}
  },
  {
   "id": "DP04",
   "name": "Packaging level",
   "desc": "Whether each component is primary, secondary or transit packaging.",
   "src": "plm",
   "field": "PLM component attribute · level",
   "out": [
    "rep",
    "fee"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": null,
   "notes": {}
  },
  {
   "id": "DP05",
   "name": "Units per pack",
   "desc": "How many sales units share a secondary or transit component.",
   "src": "erp",
   "field": "SAP BOM quantity · STPO-MENGE",
   "out": [
    "rep",
    "fee"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": null,
   "notes": {}
  },
  {
   "id": "DP06",
   "name": "Component material",
   "desc": "Main material of each component (glass, aluminium, paper/board, plastic, steel, wood, other).",
   "src": "plm",
   "field": "PLM spec · material class",
   "out": [
    "rep",
    "fee",
    "doc",
    "lab",
    "dpp"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2026",
   "notes": {},
   "dpp": "Material composition is core passport information.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP07",
   "name": "Polymer type",
   "desc": "Plastic type for plastic components (PET, HDPE, PP, LDPE).",
   "src": "supplier",
   "field": "Supplier declaration · polymer",
   "out": [
    "rep",
    "fee",
    "lab",
    "dpp"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2028",
   "notes": {},
   "dpp": "Polymer type is shown in the passport for plastic parts.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP08",
   "name": "Multi-material split",
   "desc": "Share of each material in composite components, by weight.",
   "src": "supplier",
   "field": "Supplier declaration · composition %",
   "out": [
    "rep",
    "fee",
    "doc",
    "dpp"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2026",
   "notes": {},
   "dpp": "Material shares are part of the composition in the passport.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP09",
   "name": "Component weight (empty)",
   "desc": "Weight of each empty component in grams.",
   "src": "plm",
   "field": "PLM spec · net weight (g)",
   "out": [
    "rep",
    "fee",
    "doc"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2026",
   "notes": {}
  },
  {
   "id": "DP10",
   "name": "Colour and opacity",
   "desc": "Colour and opacity of each component, which affect sorting and recycling.",
   "src": "supplier",
   "field": "Supplier declaration · colour",
   "out": [
    "fee",
    "doc"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "2030",
   "notes": {}
  },
  {
   "id": "DP11",
   "name": "Additives, inks and adhesives",
   "desc": "Additives, inks, coatings and adhesives that can disrupt recycling.",
   "src": "supplier",
   "field": "Supplier declaration · additives",
   "out": [
    "fee",
    "doc"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "2030",
   "notes": {}
  },
  {
   "id": "DP12",
   "name": "Recyclability result",
   "desc": "Result of the recyclability assessment for each component.",
   "src": "supplier",
   "field": "Assessment record · result",
   "out": [
    "fee",
    "doc",
    "dpp"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "2030",
   "notes": {
    "UK": "RAM rating: red, amber or green. Changes the PackUK fee.",
    "DE": "Recyclability assessment under the minimum standard. Drives the dual system fee.",
    "FR": "Used for Citeo bonus and malus.",
    "ES": "Used for SCRAP fee modulation.",
    "IT": "Plastics fall into CONAI contribution bands.",
    "DK": "Used for fee modulation.",
    "NL": "Recyclable plastics pay a lower rate.",
    "_": "PPWR recyclability grade A to E applies from 2030."
   },
   "dpp": "Recyclability is a typical passport attribute.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP13",
   "name": "Recycled content %",
   "desc": "Share of recycled material in each component.",
   "src": "supplier",
   "field": "Supplier declaration · recycled %",
   "out": [
    "fee",
    "doc",
    "dpp"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "2030",
   "notes": {
    "FR": "Recycled content can earn a bonus.",
    "ES": "Relevant to recycled-content rules and the plastic tax.",
    "_": "PPWR minimum recycled content for plastic packaging from 2030."
   },
   "dpp": "Recycled content is a typical passport attribute.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP14",
   "name": "Recycled content certificate",
   "desc": "Chain-of-custody evidence for the recycled content claimed.",
   "src": "supplier",
   "field": "Certificate · ISCC PLUS or equivalent",
   "out": [
    "fee",
    "doc",
    "evid",
    "dpp"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "2030",
   "notes": {},
   "dpp": "Supports the recycled content shown in the passport.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP15",
   "name": "Reusable or single-use",
   "desc": "Whether the packaging is designed to be reused.",
   "src": "plm",
   "field": "PLM spec · reuse flag",
   "out": [
    "rep",
    "fee",
    "doc",
    "lab",
    "dpp"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2026",
   "notes": {},
   "dpp": "Reuse information can be part of the passport.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP16",
   "name": "Food-contact packaging",
   "desc": "Whether the component is in contact with the product.",
   "src": "plm",
   "field": "PLM spec · food contact",
   "out": [
    "doc"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2026",
   "notes": {}
  },
  {
   "id": "DP17",
   "name": "PFAS declaration",
   "desc": "Supplier confirmation that food-contact components meet the PFAS limits.",
   "src": "supplier",
   "field": "Supplier declaration · PFAS",
   "out": [
    "doc"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2026",
   "notes": {}
  },
  {
   "id": "DP18",
   "name": "Heavy metals",
   "desc": "Combined lead, cadmium, mercury and hexavalent chromium content.",
   "src": "supplier",
   "field": "Test report · mg/kg",
   "out": [
    "doc"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2026",
   "notes": {}
  },
  {
   "id": "DP19",
   "name": "Substances of concern",
   "desc": "Screening for substances of concern in each component.",
   "src": "supplier",
   "field": "Supplier declaration · SVHC screening",
   "out": [
    "doc",
    "dpp"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2026",
   "notes": {},
   "dpp": "ESPR requires substances of concern to be tracked and shown in the passport.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP20",
   "name": "Minimisation evidence",
   "desc": "Why the pack cannot be lighter or smaller (functional constraints).",
   "src": "plm",
   "field": "Design record · minimisation assessment",
   "out": [
    "doc"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2026",
   "notes": {}
  },
  {
   "id": "DP21",
   "name": "Empty space ratio",
   "desc": "Empty space in grouped, transport and e-commerce packaging.",
   "src": "plm",
   "field": "PLM spec · volume data",
   "out": [
    "doc"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "2030",
   "notes": {}
  },
  {
   "id": "DP22",
   "name": "Units placed on the market",
   "desc": "Number of sales units supplied in the country during the period.",
   "src": "erp",
   "field": "SAP billing · VBRP quantity by country",
   "out": [
    "rep",
    "fee"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": null,
   "notes": {}
  },
  {
   "id": "DP23",
   "name": "Sales channel",
   "desc": "Whether units go to households (retail) or businesses (on-trade).",
   "src": "erp",
   "field": "SAP customer group · KNVV-KDGRP",
   "out": [
    "rep",
    "fee"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": null,
   "notes": {
    "UK": "Household vs non-household. Only household packaging pays the PackUK fee.",
    "DE": "Packaging reaching private end consumers must be in a dual system.",
    "_": "Household and commercial packaging can be reported differently."
   }
  },
  {
   "id": "DP24",
   "name": "Delivery nation",
   "desc": "England, Scotland, Wales or Northern Ireland.",
   "src": "erp",
   "field": "SAP delivery · ship-to region",
   "out": [
    "rep"
   ],
   "countries": [
    "UK"
   ],
   "from": null,
   "notes": {}
  },
  {
   "id": "DP25",
   "name": "Exports out of the country",
   "desc": "Units shipped out of the country, which are removed from the obligation.",
   "src": "erp",
   "field": "SAP delivery · destination country",
   "out": [
    "rep",
    "fee"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": null,
   "notes": {}
  },
  {
   "id": "DP26",
   "name": "Deposit scheme status",
   "desc": "Whether the drinks container is in a deposit return scheme.",
   "src": "man",
   "field": "Manual · scheme flag",
   "out": [
    "rep",
    "fee"
   ],
   "countries": [
    "UK",
    "DE",
    "DK",
    "NL"
   ],
   "from": null,
   "notes": {
    "UK": "UK DRS from October 2027 for in-scope cans and PET.",
    "DE": "Single-use deposit (Pfand) status.",
    "DK": "Danish deposit system status.",
    "NL": "Statiegeld status."
   }
  },
  {
   "id": "DP27",
   "name": "Import country of origin",
   "desc": "Country the packaged product was imported from.",
   "src": "erp",
   "field": "SAP purchasing · vendor country",
   "out": [
    "rep"
   ],
   "countries": [
    "UK"
   ],
   "from": null,
   "notes": {}
  },
  {
   "id": "DP28",
   "name": "Producer role",
   "desc": "Brand owner, packer/filler or importer for each product.",
   "src": "man",
   "field": "Manual · legal entity and role",
   "out": [
    "rep",
    "doc",
    "dpp"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2026",
   "notes": {},
   "dpp": "Identifies the economic operator responsible for the passport.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP29",
   "name": "EPR registration number",
   "desc": "The producer's registration number in the national register.",
   "src": "man",
   "field": "Manual · registration record",
   "out": [
    "rep",
    "lab"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2028",
   "notes": {
    "UK": "RPD organisation ID.",
    "DE": "LUCID registration number.",
    "FR": "Unique identifier (IDU).",
    "ES": "Producer register number.",
    "IT": "CONAI membership number.",
    "DK": "Danish producer register number.",
    "NL": "Afvalfonds registration."
   }
  },
  {
   "id": "DP30",
   "name": "Compliance scheme membership",
   "desc": "The scheme or PRO the producer belongs to in the country.",
   "src": "man",
   "field": "Manual · contract record",
   "out": [
    "rep",
    "fee"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": null,
   "notes": {
    "UK": "Compliance scheme, if used.",
    "DE": "Dual system contract.",
    "FR": "Citeo.",
    "ES": "Ecoembes or Ecovidrio.",
    "IT": "CONAI and material consortia.",
    "DK": "Producer responsibility organisation.",
    "NL": "Afvalfonds Verpakkingen."
   }
  },
  {
   "id": "DP31",
   "name": "Authorised representative",
   "desc": "EU representative for EPR where the producer is not established in the country.",
   "src": "man",
   "field": "Manual · appointment record",
   "out": [
    "rep",
    "doc"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2026",
   "notes": {}
  },
  {
   "id": "DP32",
   "name": "Organisation size and thresholds",
   "desc": "Turnover and tonnage that decide which obligations apply.",
   "src": "man",
   "field": "Finance · turnover and tonnage",
   "out": [
    "rep",
    "fee"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": null,
   "notes": {
    "UK": "Large producers report twice a year and pay fees.",
    "DE": "Thresholds trigger the Declaration of Completeness.",
    "NL": "Declaration threshold applies."
   }
  },
  {
   "id": "DP33",
   "name": "Reporting period",
   "desc": "The period the report covers.",
   "src": "man",
   "field": "Manual · period",
   "out": [
    "rep"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": null,
   "notes": {}
  },
  {
   "id": "DP34",
   "name": "Declaration of Completeness",
   "desc": "Annual declaration audited by an approved expert, if thresholds are exceeded.",
   "src": "man",
   "field": "Manual · auditor report",
   "out": [
    "rep"
   ],
   "countries": [
    "DE"
   ],
   "from": null,
   "notes": {}
  },
  {
   "id": "DP35",
   "name": "Triman logo and Info-tri",
   "desc": "French sorting logo and sorting instructions on the pack.",
   "src": "plm",
   "field": "Artwork · label elements",
   "out": [
    "lab"
   ],
   "countries": [
    "FR"
   ],
   "from": null,
   "notes": {}
  },
  {
   "id": "DP36",
   "name": "Environmental label codes",
   "desc": "Material identification codes and sorting information on the pack.",
   "src": "plm",
   "field": "Artwork · label elements",
   "out": [
    "lab"
   ],
   "countries": [
    "IT"
   ],
   "from": null,
   "notes": {}
  },
  {
   "id": "DP37",
   "name": "CONAI plastic band",
   "desc": "Contribution band for plastic packaging, based on sortability and recyclability.",
   "src": "man",
   "field": "Manual · CONAI classification",
   "out": [
    "fee"
   ],
   "countries": [
    "IT"
   ],
   "from": null,
   "notes": {}
  },
  {
   "id": "DP38",
   "name": "Non-recycled plastic weight",
   "desc": "Weight of non-recycled plastic, used for the Spanish plastic tax.",
   "src": "supplier",
   "field": "Supplier declaration · virgin plastic (kg)",
   "out": [
    "fee",
    "evid"
   ],
   "countries": [
    "ES"
   ],
   "from": null,
   "notes": {}
  },
  {
   "id": "DP39",
   "name": "Harmonised material label",
   "desc": "EU label showing material composition and sorting.",
   "src": "plm",
   "field": "Artwork · label elements",
   "out": [
    "lab"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2028",
   "notes": {}
  },
  {
   "id": "DP40",
   "name": "QR code / data carrier",
   "desc": "Digital information linked from the pack.",
   "src": "plm",
   "field": "Artwork · data carrier content",
   "out": [
    "lab",
    "doc",
    "dpp"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2028",
   "notes": {},
   "dpp": "The data carrier (QR code) is how the passport is opened.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP41",
   "name": "DoC reference and version",
   "desc": "Reference of the Declaration of Conformity for the packaging.",
   "src": "man",
   "field": "DoC record · reference",
   "out": [
    "doc",
    "dpp"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2026",
   "notes": {},
   "dpp": "The passport links to the Declaration of Conformity.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP42",
   "name": "Technical file references",
   "desc": "Test reports, certificates and assessments behind the DoC.",
   "src": "supplier",
   "field": "Technical file · references",
   "out": [
    "doc"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2026",
   "notes": {}
  },
  {
   "id": "DP43",
   "name": "Supplier per component",
   "desc": "The supplier of each packaging component.",
   "src": "erp",
   "field": "SAP purchasing info record · EINA-LIFNR",
   "out": [
    "evid",
    "doc",
    "dpp"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2026",
   "notes": {},
   "dpp": "Supply chain information behind the passport data.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP44",
   "name": "Weight source and sampling",
   "desc": "Whether each weight was measured, supplier-provided or estimated, with sampling records.",
   "src": "plm",
   "field": "PLM / lab record · weight source",
   "out": [
    "evid"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": null,
   "notes": {}
  },
  {
   "id": "DP45",
   "name": "Sign-off owner",
   "desc": "Named person who approves each submission.",
   "src": "man",
   "field": "Manual · approver",
   "out": [
    "rep",
    "evid"
   ],
   "countries": [
    "UK",
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": null,
   "notes": {}
  },
  {
   "id": "DP46",
   "name": "Unique product identifier",
   "desc": "Unique ID that links the product to its passport, for example a GS1 Digital Link built from the GTIN with batch or serial number.",
   "src": "erp",
   "field": "SAP material and batch · MARA-MATNR / MCH1-CHARG",
   "out": [
    "dpp"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": null,
   "notes": {},
   "dpp": "Required to create a passport and the code printed on pack.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP47",
   "name": "Economic operator identifier",
   "desc": "Unique ID of the company placing the product on the EU market (for example EORI or GLN).",
   "src": "man",
   "field": "Manual · operator ID record",
   "out": [
    "dpp"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": null,
   "notes": {},
   "dpp": "Identifies who is responsible for the passport.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP48",
   "name": "Facility identifier",
   "desc": "Unique ID of the site where the product is filled and packed (for example GLN).",
   "src": "erp",
   "field": "SAP plant · T001W-WERKS",
   "out": [
    "dpp"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": null,
   "notes": {},
   "dpp": "Shows where the product was made.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP49",
   "name": "Passport level",
   "desc": "Whether one passport covers a model, a batch or each single item.",
   "src": "man",
   "field": "Manual · passport level",
   "out": [
    "dpp"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": null,
   "notes": {},
   "dpp": "Set by the delegated act; decides how many passports are created.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP50",
   "name": "Carbon footprint",
   "desc": "Carbon footprint per unit, if the delegated act asks for it.",
   "src": "supplier",
   "field": "LCA study · kg CO2e per unit",
   "out": [
    "dpp"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": null,
   "notes": {},
   "dpp": "Only where required for the product group.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP51",
   "name": "End-of-life information",
   "desc": "Instructions for reuse, collection and recycling shown to the consumer.",
   "src": "plm",
   "field": "Artwork / content · end-of-life text",
   "out": [
    "dpp"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": null,
   "notes": {},
   "dpp": "Shown to consumers when they open the passport.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP52",
   "name": "Commodity code",
   "desc": "Customs code (HS / CN) of the product.",
   "src": "erp",
   "field": "SAP material · MARC-STAWN",
   "out": [
    "dpp"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": null,
   "notes": {},
   "dpp": "Lets customs link imports to the passport.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP53",
   "name": "Passport hosting and access",
   "desc": "Who hosts the passport data, the backup copy, and which information is public or restricted.",
   "src": "man",
   "field": "Manual · hosting and access record",
   "out": [
    "dpp"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": null,
   "notes": {},
   "dpp": "Passports must stay available and have a backup copy with a service provider.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP54",
   "name": "DPP registry entry",
   "desc": "Registration of the product identifier in the EU passport registry.",
   "src": "man",
   "field": "Manual · registry record",
   "out": [
    "dpp"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": null,
   "notes": {},
   "dpp": "The EU registry stores the identifiers of all passports.",
   "dppFrom": "Set by delegated act (TBC)"
  },
  {
   "id": "DP55",
   "name": "DoC manufacturer and signatory",
   "desc": "The manufacturer responsible for the Declaration of Conformity (usually the brand owner) and the person authorised to sign it for them.",
   "src": "man",
   "field": "DoC record · manufacturer, signatory and role",
   "out": [
    "doc"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2026",
   "notes": {
    "_": "A brand owner that has packaging made or filled under its own name or trademark is generally the manufacturer, even when production is outsourced. Support from iNext, a lab or an authorised representative does not move that responsibility."
   }
  },
  {
   "id": "DP56",
   "name": "Document retention period",
   "desc": "How long the DoC and technical file must be kept: 5 years after single-use packaging was last placed on the market, 10 years for reusable packaging.",
   "src": "man",
   "field": "DoC record · retention until",
   "out": [
    "doc",
    "evid"
   ],
   "countries": [
    "DE",
    "FR",
    "ES",
    "IT",
    "DK",
    "NL"
   ],
   "from": "12 Aug 2026",
   "notes": {
    "_": "Retention is not an expiry date. The DoC has no fixed validity and must be updated when the packaging, supplier, materials or evidence change; earlier versions stay on file."
   }
  }
 ],
 "SOURCES": {
  "erp": {
   "name": "ERP · SAP S/4HANA",
   "short": "ERP",
   "color": "--src-erp",
   "bg": "--src-erp-bg"
  },
  "supplier": {
   "name": "Supplier",
   "short": "Supplier",
   "color": "--src-sup",
   "bg": "--src-sup-bg"
  },
  "plm": {
   "name": "PLM · packaging specs",
   "short": "PLM",
   "color": "--src-plm",
   "bg": "--src-plm-bg"
  },
  "man": {
   "name": "Manual · client team",
   "short": "Manual",
   "color": "--src-man",
   "bg": "--src-man-bg"
  }
 },
 "OUTPUTS": {
  "rep": {
   "name": "National EPR report",
   "reg": "EPR",
   "color": "--out-rep"
  },
  "fee": {
   "name": "EPR fee / eco-modulation",
   "reg": "EPR",
   "color": "--out-fee"
  },
  "doc": {
   "name": "PPWR DoC and technical file",
   "reg": "PPWR",
   "color": "--out-doc"
  },
  "lab": {
   "name": "PPWR labelling",
   "reg": "PPWR",
   "color": "--out-lab"
  },
  "evid": {
   "name": "Evidence and audit file",
   "reg": "EPR",
   "color": "--out-evid"
  },
  "dpp": {
   "name": "Digital Product Passport",
   "reg": "DPP",
   "color": "--out-dpp"
  }
 },
 "OUT_LABEL": {
  "rep": {
   "UK": "RPD packaging data file",
   "DE": "LUCID and dual system quantity reports",
   "FR": "Citeo declaration",
   "ES": "SCRAP declaration and MITERD annual report",
   "IT": "CONAI declaration",
   "DK": "Danish producer register report",
   "NL": "Afvalfonds declaration"
  },
  "fee": {
   "UK": "PackUK fee, adjusted by RAM rating",
   "DE": "Dual system fee, recyclability-based",
   "FR": "Citeo contribution with bonus and malus",
   "ES": "SCRAP fee (plastic tax tracked alongside)",
   "IT": "CONAI environmental contribution",
   "DK": "Producer responsibility fee",
   "NL": "Afvalfonds waste management contribution"
  },
  "doc": {
   "_": "EU Declaration of Conformity and technical documentation"
  },
  "lab": {
   "_": "Harmonised material label, sorting info and data carrier"
  },
  "evid": {
   "_": "Records kept for checks and audits"
  },
  "dpp": {
   "_": "EU Digital Product Passport (ESPR); scope and date set by delegated act"
  }
 },
 "COUNTRIES": [
  {
   "code": "UK",
   "name": "United Kingdom",
   "eu": false
  },
  {
   "code": "DE",
   "name": "Germany",
   "eu": true
  },
  {
   "code": "FR",
   "name": "France",
   "eu": true
  },
  {
   "code": "ES",
   "name": "Spain",
   "eu": true
  },
  {
   "code": "IT",
   "name": "Italy",
   "eu": true
  },
  {
   "code": "DK",
   "name": "Denmark",
   "eu": true
  },
  {
   "code": "NL",
   "name": "Netherlands",
   "eu": true
  }
 ],
 "DPP_NOTE": "Passport content and dates are set product group by product group in ESPR delegated acts.",
 "PROFILES": {
  "generic": {
   "name": "Generic (SAP S/4HANA example)",
   "short": "Generic"
  },
  "khc": {
   "name": "Kraft Heinz (KHC)",
   "short": "KHC",
   "countries": [
    "DK"
   ],
   "sources": {
    "erp": {
     "name": "Snowflake · product master and sales",
     "short": "Snowflake"
    },
    "plm": {
     "name": "Trace One Devex · specifications",
     "short": "Trace One"
    },
    "supplier": {
     "name": "Supplier · certificates",
     "short": "Supplier"
    },
    "man": {
     "name": "Manual · KHC team",
     "short": "Manual"
    }
   },
   "note": "KHC systems from the Monk Spaces integration approach: Trace One Devex (API or scheduled export) and Snowflake (read-only connection or Secure Data Share), read without changing KHC systems. Objects and field names are placeholders to confirm with KHC IT. Denmark first; the UK follows.",
   "dp": {
    "DP01": {
     "src": "erp",
     "field": "Snowflake · PRODUCT_MASTER.SKU_ID"
    },
    "DP02": {
     "src": "erp",
     "field": "Snowflake · PRODUCT_MASTER.GTIN"
    },
    "DP03": {
     "src": "plm",
     "field": "Trace One Devex · packaging specification › component list"
    },
    "DP04": {
     "src": "plm",
     "field": "Trace One Devex · component › packaging level"
    },
    "DP05": {
     "src": "plm",
     "field": "Trace One Devex · component › quantity per pack"
    },
    "DP06": {
     "src": "plm",
     "field": "Trace One Devex · component › material"
    },
    "DP07": {
     "src": "plm",
     "field": "Trace One Devex · component › polymer"
    },
    "DP08": {
     "src": "plm",
     "field": "Trace One Devex · component › material composition %"
    },
    "DP09": {
     "src": "plm",
     "field": "Trace One Devex · component › net weight (g)"
    },
    "DP10": {
     "src": "plm",
     "field": "Trace One Devex · component › colour and opacity"
    },
    "DP11": {
     "src": "plm",
     "field": "Trace One Devex · component › inks, coatings and adhesives"
    },
    "DP12": {
     "src": "plm",
     "field": "Trace One Devex · component › recyclability assessment"
    },
    "DP13": {
     "src": "plm",
     "field": "Trace One Devex · supplier questionnaire › recycled content %"
    },
    "DP14": {
     "src": "supplier",
     "field": "Supplier · recycled content certificate (ISCC PLUS or equivalent)"
    },
    "DP15": {
     "src": "plm",
     "field": "Trace One Devex · specification › reusable or single-use"
    },
    "DP16": {
     "src": "plm",
     "field": "Trace One Devex · specification › food-contact use"
    },
    "DP17": {
     "src": "plm",
     "field": "Trace One Devex · supplier document › PFAS declaration"
    },
    "DP18": {
     "src": "plm",
     "field": "Trace One Devex · supplier document › heavy metals test report"
    },
    "DP19": {
     "src": "plm",
     "field": "Trace One Devex · supplier document › substances of concern (SVHC)"
    },
    "DP20": {
     "src": "plm",
     "field": "Trace One Devex · specification › minimisation assessment"
    },
    "DP21": {
     "src": "plm",
     "field": "Trace One Devex · specification › volume and empty space"
    },
    "DP22": {
     "src": "erp",
     "field": "Snowflake · SALES.UNITS by country and period"
    },
    "DP23": {
     "src": "erp",
     "field": "Snowflake · SALES.CHANNEL (customer group)"
    },
    "DP24": {
     "src": "erp",
     "field": "Snowflake · SALES.SHIP_TO_REGION"
    },
    "DP25": {
     "src": "erp",
     "field": "Snowflake · SALES.DESTINATION_COUNTRY"
    },
    "DP26": {
     "src": "man",
     "field": "Manual · deposit scheme flag"
    },
    "DP27": {
     "src": "erp",
     "field": "Snowflake · PURCHASING.VENDOR_COUNTRY"
    },
    "DP28": {
     "src": "man",
     "field": "Manual · legal entity and producer role"
    },
    "DP29": {
     "src": "man",
     "field": "Manual · registration record"
    },
    "DP30": {
     "src": "man",
     "field": "Manual · compliance scheme contract"
    },
    "DP31": {
     "src": "man",
     "field": "Manual · authorised representative appointment"
    },
    "DP32": {
     "src": "erp",
     "field": "Snowflake · FINANCE.TURNOVER and packaging tonnage"
    },
    "DP33": {
     "src": "man",
     "field": "Manual · reporting period"
    },
    "DP34": {
     "src": "man",
     "field": "Manual · auditor report"
    },
    "DP35": {
     "src": "plm",
     "field": "Trace One Devex · artwork › label elements"
    },
    "DP36": {
     "src": "plm",
     "field": "Trace One Devex · artwork › label elements"
    },
    "DP37": {
     "src": "man",
     "field": "Manual · CONAI classification"
    },
    "DP38": {
     "src": "plm",
     "field": "Trace One Devex · supplier questionnaire › virgin plastic weight"
    },
    "DP39": {
     "src": "plm",
     "field": "Trace One Devex · artwork › harmonised material label"
    },
    "DP40": {
     "src": "plm",
     "field": "Trace One Devex · artwork › data carrier (QR) content"
    },
    "DP41": {
     "src": "man",
     "field": "Manual · DoC record from iNext › reference and version"
    },
    "DP42": {
     "src": "plm",
     "field": "Trace One Devex · supplier document › technical file references"
    },
    "DP43": {
     "src": "erp",
     "field": "Snowflake · PURCHASING.SUPPLIER_ID per component"
    },
    "DP44": {
     "src": "plm",
     "field": "Trace One Devex · component › weight source"
    },
    "DP45": {
     "src": "man",
     "field": "Manual · approver"
    },
    "DP46": {
     "src": "erp",
     "field": "Snowflake · PRODUCT_MASTER.SKU_ID and batch"
    },
    "DP47": {
     "src": "erp",
     "field": "Snowflake · LEGAL_ENTITY.OPERATOR_ID"
    },
    "DP48": {
     "src": "erp",
     "field": "Snowflake · PLANT.FACILITY_ID"
    },
    "DP49": {
     "src": "man",
     "field": "Manual · passport level"
    },
    "DP50": {
     "src": "supplier",
     "field": "Supplier · LCA study (kg CO2e per unit)"
    },
    "DP51": {
     "src": "plm",
     "field": "Trace One Devex · artwork › end-of-life text"
    },
    "DP52": {
     "src": "erp",
     "field": "Snowflake · PRODUCT_MASTER.COMMODITY_CODE"
    },
    "DP53": {
     "src": "man",
     "field": "Manual · passport hosting and access"
    },
    "DP54": {
     "src": "man",
     "field": "Manual · registry record"
    },
    "DP55": {
     "src": "man",
     "field": "Manual · DoC record from iNext › manufacturer and signatory"
    },
    "DP56": {
     "src": "man",
     "field": "Manual · DoC record from iNext › retention until"
    }
   }
  }
 }
};
