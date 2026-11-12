# EPR, PPWR and DPP Data Explorer

Front-end prototype for a packaging compliance tool covering national EPR, the EU Packaging and Packaging Waste Regulation (PPWR) and the EU Digital Product Passport (DPP) under the Ecodesign for Sustainable Products Regulation (ESPR). It shows, for the countries you select, which data points are needed, where each one comes from, and what it goes into.

Countries in this version: United Kingdom, Germany, France, Spain, Italy, Denmark and the Netherlands. PPWR and DPP apply to the EU countries only. Denmark is the prototype market and is selected by default.

## What it does

- **Filters** (tick boxes): country (one or several), regulation (National EPR, EU PPWR, EU Digital Product Passport), where the data comes from (ERP · SAP S/4HANA, Supplier, PLM, Manual), what it goes into, when it applies, and scope (common or country-specific). Active filters show as chips that can be removed.
- **Client checklist** (Checklist view): for each data point that applies to the selected countries, mark whether the client has it, can get it, or does not have it, where they get it if it is not the usual source, and a note. Mark a whole source group at once with the Mark all links. A progress bar shows how far the checklist is. Answers are saved in the browser (localStorage) only; download the checklist as Excel or CSV to share it, fill it offline, and import the CSV back.
- **Flowchart**: all data points on the left, one column per source, with the outputs on the right; lines run through the gaps between rows so they do not cross the boxes. With *Flowchart follows the checklist* on, each data point sits under the source the client named, data they don't have moves to a red *Not available yet* column, each box shows its answer (✓ have, ◐ can get, ✕ not available, ? not answered), lines are dotted or dashed for data not in hand, and each output says how many of its data points are not in hand. The *Checklist answer* filter shows, for example, only the gaps. Fits the screen automatically; zoom with the buttons or Ctrl + scroll, drag to move. Hover a data point or an output to highlight its links; click an output to keep it highlighted.
- **Table**: the same filtered list as rows, with the client's answer.
- **SKU data**: load a client's SKU-level data and work with it per SKU. Accepts the SKU collection workbook (.xlsx, one sheet per SKU), the SKU x data point map (.csv: sku, level, record_id, dp_id, field, value) or a platform SKU catalogue (.csv with the platform's columns or their synonyms: MATNR, Tare_Weight, Annual_Volume…). A fictional sample (HienzLookAlike, Denmark) loads with one click.
  - *Coverage by SKU*: a SKU x data point matrix (complete, partly, missing) for every data point the market needs at SKU level, with % filled and issue counts per SKU; search, sort least complete first, show only SKUs with gaps. Click a cell to open that SKU with the data point highlighted.
  - *Data checks*: Blocker Gap (missing weight or material), Unverified PCR (recycled content without a certificate), invalid values (GTIN check digit, units per pack, allowed codes, numbers), inconsistencies (material split ≠ 100, exported > placed), missing required values, missing PFAS declarations on food-contact packaging, and warnings for estimated weights and low recyclability. Filter by severity and check type.
  - *SKU detail*: product and passport values, each packaging component and each sales line side by side, with grams per unit, net units and packaging kg worked out.
  - *Show in flowchart*: turns one SKU (or all SKUs, worst case) into checklist answers, so the flowchart shows what is in hand for that SKU.
  - *DoC grouping*: groups SKUs by packaging type and compares what affects conformity (supplier, materials, structure, colour, inks/coatings/adhesives, food-contact use, reuse; not size or weight). Shows which SKUs could share one DoC, which are already grouped, and flags a DoC that covers SKUs whose packaging differs. Gap assessment input for iNext, who prepare the DoCs; it does not draft or sign anything.
  - *Source per value*: every value keeps the system and field it came from (the client profile's mapping, the collector's "Gets it from" answer and workbook cell, or the catalogue column name) and the load that brought it in. Shown on hover in SKU detail, in a Source column, in the data checks (with a count by system) and in the exports.
  - *Load history*: each import is numbered and listed with SKUs, values, errors and what was added, changed or removed since the load before (last 30 loads).
  - Downloads (in the Export menu once data is loaded): SKU data Excel (coverage, data checks, platform import, DoC grouping, values and sources, load history, changes), platform import CSV, values and sources CSV. The data stays in the browser (localStorage); nothing is sent anywhere.
- **Client profile** (top of the filters): *Generic* shows example systems (SAP S/4HANA, PLM). *Kraft Heinz (KHC)* follows the Monk Spaces integration approach: sources become Snowflake (product master, sales, company data), Trace One Devex (specifications, components, materials, weights, recyclability, PFAS and supplier documents), Supplier (recycled-content certificates, LCA) and Manual (DoC record from iNext, registration, sign-off). Each data point shows the KHC system and field; field names are placeholders to confirm with KHC IT. The profile opens on Denmark; the UK follows.
- **Export** (top bar): every download lives here, using the filters currently applied:
  - Flowchart: **Download as PDF** (A3 landscape, vector, with the applied filters printed in the header) or **Print** (browser print dialog, where Save as PDF also works).
  - Table: **Download as CSV** (UTF-8, opens in Excel, includes the checklist answers) or **Download as Excel** (.xlsx with three sheets: Data points, By country with each country's own output names and notes, and Filters).
  - PDF and Excel load their libraries from a CDN on first use (jsPDF, svg2pdf.js, SheetJS), so they need an internet connection.
- **Details panel**: click a data point to see its source, example system field, what it feeds in each selected country, country notes, PPWR timing and, for DPP data points, what the passport uses them for. The panel can be minimised or closed, and the filter sidebar can be hidden to give the flowchart the full width.

## Design rules

Simple purpose, architecture, design and implementation. No taglines, helper text or secondary labels: if a screen needs them, the layout changes instead. Detail that is still useful (country output names, field names, source references, caveats) is on hover, in the details panel or in the exports.

## Project structure

```
index.html       page structure
src/styles.css   styling (light and dark)
src/app.js       filters, flowchart layout, pan and zoom, table, details panel
src/data.js      data point library (sample data)
src/sku.js       SKU data view: import, coverage, data checks, SKU detail, exports
src/skudata.js   field map (collected field → data point) and the fictional HienzLookAlike sample
```

No build step and no server code. Open `index.html` through any static web server, or deploy the folder to Vercel (framework preset: Other, no build command).

To run locally:

```
python -m http.server 8765
```

then open http://localhost:8765.

## Data

`src/data.js` holds the sample library and the client profiles (`PROFILES`): 56 data points (DP55 DoC manufacturer and signatory and DP56 document retention: 5 years after single-use packaging was last placed on the market, 10 years if reusable), 4 sources, 6 outputs and the country-specific output names. 23 data points feed the Digital Product Passport: 14 existing ones (for example GTIN, material, recycled content, substances of concern, data carrier) and 9 passport-only ones (DP46 to DP54: unique product identifier, economic operator and facility identifiers, passport level, carbon footprint, end-of-life information, commodity code, hosting and access, registry entry).

Country rules, field mappings and PPWR dates are indicative and must be checked against current national rules before use. DPP content and dates are set product group by product group in ESPR delegated acts; none has been adopted yet for drinks or packaging, so the DPP part prepares the data model rather than reflecting a fixed obligation.

## Next steps

1. Review the data point list with the compliance team.
2. Test the SKU data view with a real client extract.
3. API layer: connectors for SAP S/4HANA, supplier data and PLM, replacing `src/data.js`.
