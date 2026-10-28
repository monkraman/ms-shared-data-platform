# Compliance Module Strategy

## Shared foundation
Product/packaging records; materials/suppliers; source lineage/evidence; data quality/approvals; tenant access/audit; import services.

## Module-specific responsibilities
Each module owns jurisdiction/obligation configuration, required fields and validations, versioned rules/calculations, reporting-period logic, module-specific outputs and reference tests.

## EPR first
Select one jurisdiction and period. Document the entity/activity, required fields/classifications, official rule references, treatment of missing/estimated/corrected data, known-good reference case, approval process and export format.

## Future PPWR/DPP
Design extension points but do not assume PPWR is identical to EPR or that DPP only needs packaging data. Run separate discovery and gap analysis before implementing each module.
