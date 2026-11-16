# CSV import test pack

Nine CSV files that test the import end to end on the running app (local or deployed). Each file tests one thing. [EXPECTED.md](EXPECTED.md) gives the exact numbers the app should show for each file: mapping, review counts, skipped rows, warnings, gaps, validation count and estimates. These numbers are produced by the platform's own code, not typed by hand.

**One complete client:** `complete-client.csv` (Nordlys Foods ApS, 3 products, 9 components, 50 columns) fills every data point a CSV can carry, 42 of 56, with valid values: no warnings, no gaps, 100% complete, status OK, PPWR declarations ready. How to load it, what to expect, which column fills which data point and the 14 data points a CSV cannot carry: [COMPLETE_CLIENT.md](COMPLETE_CLIENT.md). Built and checked by `python scripts/make_complete_client_csv.py`, which stops with an error if any check fails.

Rebuild the files and expected results after changing import, validation or gap code:

```bash
cd backend
python scripts/make_csv_tests.py
```

## Before you start

1. Sign in as the platform admin.
2. On **Client workspaces**, create a new workspace, for example `CSV Test`, with modules **EPR and PPWR only** and countries GB and DK. Do not use the Kraft Heinz demo workspace: its existing products change every count.
3. Open the workspace (**Open workspace**).
4. Import the files **in order**, from **Data collection → Import**. Accept the suggested mapping unless a step says otherwise.
5. Do not use Fill estimates or Apply corrections until step 05 says so. Each one changes the counts for the files after it.

For each file: drop it on the Import screen, compare the mapping with EXPECTED.md, click **Review**, compare the four numbers and the lists, click **Approve import**, and wait for "Import complete".

## The files

| File | What it tests | Check also |
| --- | --- | --- |
| `01-products-clean.csv` | 6 products, 17 components, platform column names. Everything maps itself, no errors, no warnings | **SKU library** lists 6 `TST-` products. Open `TST-KET-500`: 3 components, values show source "File import" |
| `02-client-column-names.csv` | Client column names (`Article`, `EAN`, `Weight (g)`, `PCR`) map to fields; `Plant` and `Comment` show **Skip** | Leave them on Skip. 2 new products |
| `03-rejected-rows.csv` | 3 rows without SKU, product name or component are listed under "Rows that will be skipped" with row and column | Only 2 products and 3 components arrive |
| `04-validation-warnings.csv` | Wrong formats (`260 g`, `0.003 kg`, `plastik`, `ja`, `10/08/2026`, bad GTIN check digit, `130` %, `-4`) are imported and listed with a correction | **Data validation** shows 16 values. Do not apply yet |
| `05-gaps-and-estimates.csv` | Each row triggers one gap rule: weight missing, recycled content missing, PFAS missing, GTIN missing, certificate missing, limited recyclability, weight from spec | **Data gaps**: estimable vs needs data. After this file, test Fill estimates and Apply corrections (below) |
| `06-reimport-updates.csv` | Re-import of existing products | See "Re-import checks" below |
| `07-excel-semicolon-bom.csv` | Excel export: semicolons, UTF-8 BOM, a value with a semicolon in quotes, a value with quotes, Danish letters | Product `TST-DK-01` reads "Rødgrød med fløde 500g"; component "Glas; klassisk" is one value |
| `08-volume-2000-skus.csv` | 8,000 rows, 2,000 products (the limit is 20,000 rows per file) | Time each step (below) |
| `09-duplicate-columns.csv` | Two columns named `weight_g` | Upload refused: "Column names must be different" |

### After file 05: estimates and corrections

1. **Data gaps → Fill estimates.** Expected: `TST-GAP-01` squeeze bottle weight **8.9** ("Average of 11 Plastic primary components") and cap recycled content **0**. Those two gaps close; the weight is marked Estimated.
2. **Data validation → Apply all.** 12 of the 16 values are corrected (`260 g` → 260, `Plastik` → Plastic, `10/08/2026` → 2026-08-10 …). 4 have no suggestion and stay: the two GTINs with a wrong check digit, recycled content `130` and weight `-4`. Fix those by hand on the product page.
3. **Export for source systems** downloads the corrections list.

### Re-import checks (file 06)

Review shows 1 new and 2 updated products. After approval, open the products:

| Product | Expect | Rule it proves |
| --- | --- | --- |
| `TST-KET-500` · Squeeze bottle | Weight **28** (was 30) | A value in the file replaces the stored one |
| `TST-KET-500` · Flip-top cap | Weight still **3** | An empty cell never wipes data |
| `TST-KET-500` | New component **Shrink sleeve** (4 components) | Unknown component ID adds a component |
| `TST-MAYO-250` · Glass jar | Weight **175**, still 3 components | Matched by component name when the file has no component ID |
| `TST-MAYO-250` | Brand **Test Foods Premium**; History shows the change | Product values update, every change is recorded |
| `TST-NEW-01` | New product | New SKU creates a product |

Also import `01-products-clean.csv` a second time: the mapping step is pre-filled from the first import (same columns), and Review shows 0 new, 6 updated.

### Volume test (file 08)

Write down how long each step takes and whether anything times out:

| Step | Time |
| --- | --- |
| Upload to the mapping screen | |
| Review | |
| Approve until "Import complete" | |
| SKU library opens | |
| Data gaps opens | |
| Home opens | |

Gaps, validation and fees are computed on every page load over all products, so this is the test that shows whether 2,000 products are already too slow.

## Known limits this pack shows

- **Sales cannot be imported from a CSV.** Sales lines arrive only through the ERP sync, so a CSV-only workspace shows no EPR fees.
- **Preview lists each problem once per product.** In file 04, `Y` on the cap is not listed in Review because `ja` on the bottle has the same message. Data validation lists both.
- **A column that was never imported raises no gap except "missing" rules.** File 04 has no certificate column, so its 30 % recycled content raises no "without certificate" gap (GR-005). Rules that check a value (GR-003 to GR-006) only run on fields a file or sync has brought in.
- **`30%` hides a gap.** GR-005 reads recycled content as a number, so `30%` counts as no recycled content until it is corrected to `30`.
- **The weight estimate mixes component types.** The 8.9 g estimate for a squeeze bottle averages bottles, caps and films of the same material and level.

## Clean up

Remove test products on the product page, or disable the `CSV Test` workspace on Client workspaces.
