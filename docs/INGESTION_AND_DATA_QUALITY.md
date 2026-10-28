# Ingestion and Data Quality

## Initial sources
CSV/Excel product master; packaging BOM/specification; sales/supply data; supplier evidence; ERP/PLM exports where available.

## Workflow
Upload -> file checks -> preview -> column mapping -> staging -> row validation -> normalisation/unit conversion -> duplicate/reference checks -> import summary -> review/correction -> accepted records.

## Requirements
- Preserve import batch and source references under retention policy.
- Record source file and row/external record ID.
- Version field mappings.
- Report row-level errors and warnings; distinguish rejected, warned and accepted rows.
- Record units and conversions.
- Detect duplicates without silently overwriting existing records.
- Document re-import and correction behaviour.
- Distinguish supplier-provided, measured, estimated and unverified values where relevant.
- Keep data-quality issues separate from compliance decisions.

Build external adapters only after API access, permissions, sync direction/frequency and error handling are known.
