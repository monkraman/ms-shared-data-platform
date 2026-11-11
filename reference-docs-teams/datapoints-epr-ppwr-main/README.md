# EPR, PPWR and DPP Data Explorer

Front-end prototype for a packaging compliance tool covering national EPR, the EU Packaging and Packaging Waste Regulation (PPWR) and the EU Digital Product Passport (DPP) under the Ecodesign for Sustainable Products Regulation (ESPR). It shows, for the countries you select, which data points are needed, where each one comes from, and what it goes into.

Countries in this version: United Kingdom, Germany, France, Spain, Italy, Denmark and the Netherlands. PPWR and DPP apply to the EU countries only. Denmark is the prototype market and is selected by default.

## What it does

- **Filters** (tick boxes): country (one or several), regulation (National EPR, EU PPWR, EU Digital Product Passport), where the data comes from (ERP · SAP S/4HANA, Supplier, PLM, Manual), what it goes into, when it applies, and scope (common or country-specific). Active filters show as chips that can be removed.
- **Client checklist** (Checklist view): for each data point that applies to the selected countries, mark whether the client has it, can get it, or does not have it, where they get it if it is not the usual source, and a note. Mark a whole source group at once with the Mark all links. A progress bar shows how far the checklist is. Answers are saved in the browser (localStorage) only; download the checklist as Excel or CSV to share it, fill it offline, and import the CSV back.
- **Flowchart**: all data points on the left, one column per source, with the outputs on the right; lines run through the gaps between rows so they do not cross the boxes. With *Flowchart follows the checklist* on, each data point sits under the source the client named, data they don't have moves to a red *Not available yet* column, each box shows its answer (✓ have, ◐ can get, ✕ not available, ? not answered), lines are dotted or dashed for data not in hand, and each output says how many of its data points are not in hand. The *Checklist answer* filter shows, for example, only the gaps. Fits the screen automatically; zoom with the buttons or Ctrl + scroll, drag to move. Hover a data point or an output to highlight its links; click an output to keep it highlighted.
- **Table**: the same filtered list as rows, with the client's answer.
- **Export** (top bar), always using the filters currently applied:
  - Flowchart: **Download as PDF** (A3 landscape, vector, with the applied filters printed in the header) or **Print** (browser print dialog, where Save as PDF also works).
  - Table: **Download as CSV** (UTF-8, opens in Excel, includes the checklist answers) or **Download as Excel** (.xlsx with three sheets: Data points, By country with each country's own output names and notes, and Filters).
  - PDF and Excel load their libraries from a CDN on first use (jsPDF, svg2pdf.js, SheetJS), so they need an internet connection.
- **Details panel**: click a data point to see its source, example system field, what it feeds in each selected country, country notes, PPWR timing and, for DPP data points, what the passport uses them for. The panel can be minimised or closed, and the filter sidebar can be hidden to give the flowchart the full width.

## Project structure

```
index.html       page structure
src/styles.css   styling (light and dark)
src/app.js       filters, flowchart layout, pan and zoom, table, details panel
src/data.js      data point library (sample data)
```

No build step and no server code. Open `index.html` through any static web server, or deploy the folder to Vercel (framework preset: Other, no build command).

To run locally:

```
python -m http.server 8765
```

then open http://localhost:8765.

## Data

`src/data.js` holds the sample library: 54 data points, 4 sources, 6 outputs and the country-specific output names. 23 data points feed the Digital Product Passport: 14 existing ones (for example GTIN, material, recycled content, substances of concern, data carrier) and 9 passport-only ones (DP46 to DP54: unique product identifier, economic operator and facility identifiers, passport level, carbon footprint, end-of-life information, commodity code, hosting and access, registry entry).

Country rules, field mappings and PPWR dates are indicative and must be checked against current national rules before use. DPP content and dates are set product group by product group in ESPR delegated acts; none has been adopted yet for drinks or packaging, so the DPP part prepares the data model rather than reflecting a fixed obligation.

## Next steps

1. Review the data point list with the compliance team.
2. Data completeness view per country, using sample SKUs.
3. SKU view: components and data per product.
4. API layer: connectors for SAP S/4HANA, supplier data and PLM, replacing `src/data.js`.
