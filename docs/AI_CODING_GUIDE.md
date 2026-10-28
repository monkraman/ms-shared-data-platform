# AI Coding Assistant Instructions

Read `README.md` and all documents in `docs/` before significant changes.

- This is a shared product/packaging data platform; EPR is the first module, not the whole product.
- Never invent regulatory rules, rates, thresholds, exemptions or mandatory fields. Ask for authoritative references or document the gap.
- Do not claim features are implemented unless code/tests prove it.
- Enforce tenant isolation in every endpoint, query, file operation, export and background job.
- Never trust a client-supplied tenant ID without checking authenticated membership and permissions.
- Preserve source lineage, units, effective dates and packaging-specification versions.
- Do not silently overwrite imports, convert missing data to zero or mutate prior approved runs.
- Keep core entities relational; JSONB is only for controlled extensions.
- Prefer small, reviewable changes with tests and migrations.
- Do not add microservices, integrations, AI features or dependencies without a requirement.
- Never commit secrets or real client data.
- If ambiguous, explain the uncertainty and propose the smallest safe implementation rather than guessing.

For each task: inspect existing code; state affected requirements/files; implement a small vertical slice; add/update tests and migrations; run checks and report actual results; update docs/decision log when assumptions change; summarise changed files, tests, assumptions and risks.
