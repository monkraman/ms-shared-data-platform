# Improvements log

Things we chose to ship without, so they are not forgotten. Newest first. When one is done, delete its line and mention it in the commit. The team planner tracks owners and dates; this file tracks the technical detail.

| Area | Improvement | Why it waits | Where |
| --- | --- | --- | --- |
| SaaS | Per-client gap rules and EPR rates (on top of the platform library), per-client field catalogue and labels | Platform-wide today | `app/quality`, `app/modules/reference` |
| Users | Invitation and password-reset emails; users change their own password; SSO/MFA | Email service and identity provider not chosen | `app/api/v1/users.py` |
| Modules | DPP and LCA screens on real data (the modules can be switched on, but have no screens yet) | Next in the plan | `app/modules` |
| Horizon | Milestones maintained on a screen (platform admins) with sources, instead of `horizon.json`; alerts when a requirement enters its collection window | First version is reference data | `app/modules/reference/horizon.json` |
| Horizon | Upcoming gaps excluded from KPI counts and EPR data-quality figures | Counts include every phase today | `app/quality/service.py` |
| Insights | Save and name scenarios; compare several; scenario changes that also change PPWR results | First version recalculates EPR only, unsaved | `app/api/v1/insights.py` |
| Insights | Recommendations from more rules (material switch with rates, down-gauging films, removing secondary packaging) and per-client tuning | Rule set is small on purpose | `app/modules/insights.py` |
| Actions | Assign owners from the user list, reminders and email when due | Email service not chosen | `screens/actions` |
| Gaps | More estimation methods: by product family, by supplier, from similar SKUs' volume; confidence per estimate; undo a fill | First version averages same material and level | `app/quality/estimates.py` |
| Compliance | Real EPR Denmark and SB 54 rates (placeholders today); a Tariffs screen to edit rates per year (screen 11) | Rates come from the client's PRO and CalRecycle | `app/modules/reference/regimes.json` |
| Compliance | UK RAM modulation (red/amber/green) and non-household rules | Needs recyclability assessments per component | `app/modules/epr.py` |
| Compliance | Sales lines per country (today every sales line counts for every regime) | Sales data has no country field yet | `app/modules/epr.py` |
| Compliance | Email a declaration from the platform with the PDF attached, and a share link (Email opens the user's mail program today) | Email service not chosen | `screens/compliance/declaration.component.ts` |
| Compliance | Native-speaker and legal review of the Danish declaration text; PPWR article references | Needs a reviewer | `app/modules/ppwr_doc.py` |
| Compliance | Defra RPD CSV export from the EPR UK result (screen 13) | Next in the plan | `reference-docs-teams/packaging_data_example_file_2025_LP_submission_v4.csv` |
| Data sources | Scheduled syncs (for example nightly) | Needs a scheduler (Render cron job or Celery beat) | `app/ingestion/sources.py` |
| Data sources | Real SAP S/4HANA and Trace One connectors (or a scheduled file drop over SFTP) | Needs the client's IT access and export format; syncs are simulated from the sample data set | `app/ingestion/sync.py` |
| Data sources | Only changed records per sync (delta) | Simulated syncs send everything | `app/ingestion/sync.py` |
| Import | Mark a batch and its source "failed" when the import job fails (the job shows failed; the batch stays "approved") | Needs a second transaction after the job's rollback | `app/ingestion/jobs.py` |
| Import | Undo an import | Needs product versions | `app/catalog` |
| Gap rules | Country picker on the Gap rules screen (the API takes `countries`; the screen sends none) | Screen change only | `screens/gap-rules` |
| Gap rules | More rule types from the screen: number range, allowed values, "required when field X is Y" (certificate and PFAS checks are coded kinds today) | Needs a small rule language and editor | `app/quality/engine.py` |
| Gap rules | Check every field's type and allowed values from the field catalogue (Number, Code, Email) | Same rule language | `app/catalog/reference/fields.json` |
| Data points | Field catalogue in the database, so new fields need no deploy | Fields are a JSON file today | `app/catalog/reference.py` |
| Data points | Dictionary updates after the first load need a migration | Seeded once by migration 0005 | `migrations/versions/*_0005_*` |
| Gaps | Store computed gaps when product counts grow (computed on every read today) | Fine for hundreds of products | `app/quality/service.py` |
| Quality | Playwright end-to-end tests; EU staging | Batched with the next test round | build plan |
