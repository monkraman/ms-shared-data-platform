# Improvements log

Things we chose to ship without, so they are not forgotten. Newest first. When one is done, delete its line and mention it in the commit. The team planner tracks owners and dates; this file tracks the technical detail.

| Area | Improvement | Why it waits | Where |
| --- | --- | --- | --- |
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
| Users | Invitation emails; org-admin Team view; disable a user | Email service not chosen | screen 9 |
| Quality | Playwright end-to-end tests; EU staging | Batched with the next test round | build plan |
