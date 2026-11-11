# Proposed PoV & Platform Overview

We recommend building a **modular SaaS platform** that first establishes a shared, centralized product-and-packaging data foundation and then layers on compliance modules (EPR, PPWR, DPP, etc.). The PoV (Proof of Value) should focus on a single use-case (e.g. one region’s EPR) but use a generic data model and workflow that can be extended later. Key PoV steps include:

- **Data Ingestion & Validation:** Import existing packaging/product data (e.g. from TraceOne PLM exports, Snowflake warehouse, spreadsheets, etc.) into a central data store. Run automated **data-quality checks** on each record to catch missing or inconsistent values (e.g. blank weights, invalid material codes).  
- **Gap Identification:** For any required fields or documents that are missing, flag these “data gaps” for follow-up. For example, if recycling content or country of sale is missing for a product, the system marks it as incomplete. Maintaining **verification status and provenance** is essential (who provided each value, when it was updated).  
- **Correction Workflow:** Present users (or supplier contacts) with a list of flagged issues. Provide a simple UI to request missing details or correct errors, and track approvals. Once corrections are made (e.g. the supplier updates weight or recyclability info), re-validate and commit the data. The system should log an audit trail and optionally **write corrected values back to source systems** when integration allows (e.g. push updates to Devex/TraceOne via API).  
- **Core Data Store:** The validated data resides in a normalized schema (e.g. tables for Products, PackagingComponents, Materials, Suppliers, etc.). This ensures that any compliance module can reuse the same core data.  

Throughout this process, we build out the **EPR-specific module** as a working vertical slice of the platform. For instance, once data for one product line is clean, run the EPR calculation engine, generate reports, and expose results on a dashboard. This “slice” will demonstrate data-gap handling plus the compliance calculation in one flow.

## EPR Fee Calculation (Multi-Jurisdictional)

Extended Producer Responsibility fees vary by jurisdiction, but generally follow a common formula. Most schemes compute: 

> **Fee = Σ (MaterialWeight × BaseRate× ModulationFactor) + FixedCosts**. 

In other words, *for each material in the packaging*, multiply its weight by the jurisdiction’s per-weight tariff and any eco-modulation factor, then sum up and add registration or minimum fees.  Five key inputs drive this calculation: the **country**, **material type**, **packaging weight**, **packaging tier** (primary/secondary), and **eco-modulation status** (often derived from recyclability).  

Our platform will maintain a **configuration table** of all jurisdiction-specific parameters: base rates by material, eco-modulation multipliers (discounts or penalties), and fixed fees. These values must be kept up-to-date as laws change. For example, EU member states may publish new rates annually, and the PPWR will define new recyclability-grade rules by 2028. By encoding the formula in code and parameterizing every coefficient, we can plug in new tariff tables or modulation rules without re-coding.  As the Adherent guide notes, the same core formula applies globally – only the coefficients change per region. We will design a **jurisdictional rules engine** where each new scheme (EU, US states, APAC) has its own rule set. Whenever regulations evolve, analysts can update the stored rates (e.g. via admin UI) and the system will automatically use the latest values. We will validate correctness through unit tests and sample calculations (e.g., comparing known outcomes in Italy’s CONAI or California’s draft rules) to ensure the logic reflects the official schemes.  

## Hotspot Analysis and Forecasting

Once we can compute costs, we add **analysis tools** for business insight. For example, the platform can identify *EPR fee “hotspots”*: products or packaging components that drive the highest costs. By aggregating fees by brand, category or material, the system highlights where design changes could yield savings. We will build dashboards (e.g. using embedded BI charts) to show top-cost items, year-over-year trends, and distribution by geography or material. 

For **forecasting and scenario modelling**, we let users play “what-if”. Scenario modelling means exploring multiple potential futures under different assumptions. In our case, variables might include changes in sales volume, material mix, or recyclability grades. For instance, the user could simulate “what if 30% of our packaging switches from mixed plastic to mono-polymer” or “what if a new high-fee territory is added.” The platform would then project new fees under each scenario. Scenario modelling, as Orgvue describes, involves visualizing outcomes under various assumptions. We’ll implement this by allowing inputs (e.g. volume growth rates or eco-design scores) and running the calculation engine to show resultant cost curves. Forecast logic might also leverage historical trends – for example, linear regression on past volume vs. cost – but the primary focus is on rule-driven projections given explicit parameter changes.

## Data-Quality and Gap Workflow

EPR compliance is only as good as the underlying data. We will build a **Data Quality Engine** to automate much of this. It will include:

- **Field-level checks** (e.g. required fields, numeric ranges, valid units).  
- **Cross-field logic** (e.g. ensure component weights sum to total weight; verify material categories match allowed lists).  
- **Business rules** (e.g. if a certain product falls under PPWR, check that recyclability grade has been assessed).  

The system will highlight issues and classify them (Missing, Invalid, Needs Review). Because “underestimating a plastic weight by 10 tons can cause an unexpected fee of thousands of dollars”, high accuracy is critical. All products must report packaging materials by weight and category to match EPR reporting formats. If a record is incomplete, it appears in a queue. The platform will then **“route”** these issues back to the responsible party – either an internal user or an external supplier. For example, if the source is the TraceOne PLM, we might generate a correction request for the PLM admin. If it’s a contract manufacturer, we alert the assigned contact. Once corrections are made, data is re-ingested and re-validated. The audit trail ensures every change (and its origin) is recorded. 

Where possible, we’ll implement **write-back**: when a value is corrected and approved, the system will push the update to Devex/TraceOne via their API or to Snowflake (if that is the master datastore). If write-back isn’t available, at minimum the platform logs the issue and final resolution in its own system for transparency. This aligns with best practices of integrating data exchange with both compliance bodies and internal systems.

## Jurisdiction-Specific Logic Maintenance

As regulations evolve, our rules engine must be maintainable. We will handle this by versioning every jurisdiction’s rule set and separating *logic* from *data*. For example, instead of hard-coding “Italy’s CONAI base rates are X,” we store rates in a lookup table keyed by country, material, and year. When new eco-modulation criteria (like PPWR grades) are published, we update the criteria in a config table. To validate, we’ll use a small suite of test cases: known packaging examples with expected fees from official publications. For instance, we might test that a “standard PET bottle” yields the published fee in Germany and the UK, catching any drift. 

In practice, most EPR schemes use the **same formula structure** (weight×rate×factor) but with different coefficients. By building a generic fee-calculator module, adding a new jurisdiction is a matter of inputting its coefficients. For example, the Adherent guide notes that EU and California follow similar paradigms but with locale-specific adjustments. We’ll keep one code path that reads jurisdiction flags (e.g. country=FR, state=CA) and applies the correct parameters. When a major change occurs (like new EU Packaging Directive rules), we update the underlying data rather than rewriting code. 

Automated validation is also crucial. Each time we update a rule set, we’ll run “sanity” comparisons: check that a portfolio’s total fee under the new rules is within plausible bounds, and possibly have a regulatory expert review. Because regulations often phase in (like PPWR grades by 2028), we can version the rule sets by year and allow users to select which version to apply for forecasting. 

## System Architecture & Integrations

Our SaaS platform will integrate with existing systems at KHC. Likely data sources after the Devex TraceOne migration include:
- **TraceOne PLM**: A product lifecycle management system (formerly Devex) storing product and packaging specs. If TraceOne provides an API or data export (CSV/JSON), we’ll use that to pull in data. Alternatively, we can import data snapshots.
- **Snowflake**: If KHC is consolidating data in Snowflake, we can either query it directly (Snowflake has connectors/drivers) or load Snowflake data into our system for quality checks. Snowflake can also serve as a data warehouse backend for our dashboards if needed.
- **Other sources**: Any legacy ERP or supplier systems can be integrated via CSV/XML import or APIs.

For each integration, we’ll build a connector layer. E.g. a TraceOne connector reads product SKUs, their packaging weight and material composition. A Snowflake connector can pull historical sales volumes for forecasting. All imported data is then normalized into the core data model. 

Snowflake may also be used for analytics: we could optionally push our validated data into Snowflake and run SQL for large-scale analysis (especially useful if the dataset is huge). However, initial PoV can work with a traditional relational DB (like PostgreSQL) with ETL jobs.

## PoV Deliverables & Demo Strategy

To demonstrate value, we will create:
- **Sample Dataset:** Curate a realistic sample of KHC’s products and packaging (e.g. a few product lines with their packaging weights/materials by country). This might come from TraceOne or public industry data.  
- **Interactive Dashboard:** Build a mock-up dashboard (using tools like Power BI or in-app charts) showing total EPR costs, breakdown by material/country, cost hot spots, and a simple scenario analysis slider (e.g. change percentage recycled content and see cost impact).  
- **Validation Checks:** Include a demo of data quality alerts (e.g. a missing data red-flag pop-up) and the correction workflow (show a ticket being resolved).  
- **Rule Demo:** Show a small UI or config file where an admin can toggle an eco-modulation multiplier or update a base fee, and instantly see how costs change on a test record.  

We can reference similar solutions in the CPG (Consumer Packaged Goods) industry. For example, regulatory consultancies like Compliance & Risks (Adherent) publish guides on EPR calculation across industries. While there isn’t a publicly-documented SaaS case study for EPR, many large CPG companies (food, beverage, household goods) invest in compliance platforms. If available, we could cite industry blogs or tool examples. Regardless, our PoV will illustrate the core capabilities that such companies need. 

## Incremental Value of Infosys vs an Internal AI

Infosys brings deep regulatory and technical expertise. Unlike a generic “AI solution,” our approach is governed by **explicit business logic** and domain knowledge. We will combine proven software engineering with regulatory consulting: e.g. we explicitly encode the calculation formulas and keep them up-to-date. This ensures transparency and explainability of results (auditors can trace exactly how a fee was derived). An internally-built AI (e.g. using generative models) might struggle with the precision and traceability needed for compliance. By contrast, Infosys can deliver a robust multi-tenant platform with built-in integration capabilities and an extensible framework – something that would take an internal team much longer to develop from scratch. 

Moreover, Infosys can leverage its CPG industry experience. We can apply lessons from other clients on packaging and sustainability (without violating NDAs) to accelerate development. For instance, we might use standard material data or eco-modulation rules from known markets. We also offer support for ongoing regulatory changes and can quickly update the system when new laws pass. In sum, Infosys adds value through a combination of **domain knowledge, software accelerators, and service support** that a lone internal project would lack. 

## KHC-Specific Considerations & Use Case

After the Devex TraceOne migration, the target-state process should be: **product/packaging data flows into the new PLM (and/or Snowflake)**, and our platform ingests from there. We will confirm exactly where the “source of truth” will reside post-migration. For now, we assume TraceOne (cloud) will host the product master, and possibly Snowflake consolidates data. Our PoV will connect to those endpoints.

For the PoV use case, we suggest focusing on a representative packaging stream and jurisdiction. For example, KHC could start with *European glass bottles* or *plastic tubs* (food/bev) as the product category, and compute costs under an EU scheme like France’s CITEO or Italy’s CONAI. Alternatively, pick a U.S. state EPR (e.g. Maine or California SB54) if that’s an immediate concern. We should obtain sample data: product SKUs, weight breakdowns (primary vs secondary packaging), material types, and sales quantities. This “test data” will power the demo and let us validate the entire flow. 

In summary, the PoV will deliver a **data-centric compliance demo**: ingest sample data → highlight missing fields → show how those get corrected → calculate EPR fees by jurisdiction → present costs and scenarios on a dashboard. This approach addresses KHC’s stated needs (data gaps, fee visibility, forecasting, etc.) while laying the groundwork for all future modules in the same platform.  

**Sources:** We used regulatory publications to guide the fee logic (e.g. *“Most packaging schemes follow the same formula: weight × tariff in the relevant country”*) and compliance best practices (e.g. *“reporting requirements create the data foundation for fee calculations”*). We also referenced strategic scenario-planning concepts to ensure our forecasting tools align with industry methods. All platform design recommendations draw on this domain knowledge and common SaaS architecture patterns.