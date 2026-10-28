# Test Strategy

- Unit: domain logic, validation, mapping, unit conversion.
- API: request validation, permissions and errors.
- Database: constraints, migrations and transactions.
- Imports: malformed files, missing columns, duplicates, invalid units, partial failures and re-imports.
- Tenant isolation: read/write/search/export/file/job access across tenants.
- Compliance: reference cases, edge cases, rule versions and reproducibility.
- End-to-end: consultant onboarding -> import -> issue resolution -> EPR run -> report export.
- Operations: deployment config and backup/restore.

Release gates: no critical tenant-isolation failures; migrations tested; results reconciled to an independently reviewed reference case; failures observable/recoverable; no secrets committed; limitations documented.
