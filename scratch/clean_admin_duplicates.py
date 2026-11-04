import re

with open('frontend/src/app/features/admin/admin.component.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Pattern 1: batches tab section-header
batches_header = """      <div class="section-header">
        <div>
          <h2 class="section-title">Ingestion History & Source Batches</h2>
          <p class="section-desc">Audited record of all file uploads, ERP synchronizations, and detected quality gaps.
          </p>
        </div>
        <button class="btn-refresh" (click)="loadBatches()">Refresh Batches</button>
      </div>"""

# Pattern 2: organisations tab section-header
orgs_header = """        <div class="section-header">
          <div>
            <h2 class="section-title">Client Workspaces</h2>
            <p class="section-desc">Provisioned enterprise client databases with isolated packaging specifications and
              sales volumes.</p>
          </div>
  
        </div>"""

# Pattern 3: users tab section-header
users_header = """        <div class="section-header">
          <div>
            <h2 class="section-title">Enterprise User Directory &amp; Access Management (IAM)</h2>
            <p class="section-desc">Platform-wide user identities, role-based access controls, tenant isolation, and client login credentials.</p>
          </div>
        </div>"""

# Pattern 4: datapoints tab section-header
datapoints_header = """        <div class="section-header">
          <div>
            <h2 class="section-title">Canonical Shared Data Foundation (DP01&ndash;DP45)</h2>
            <p class="section-desc">Governed regulatory data point dictionary linking enterprise source systems (SAP, PLM, Lab) directly to statutory returns.</p>
          </div>
          <div class="header-action-group">
            <button class="btn-refresh" (click)="loadDataPoints()">Refresh Dictionary</button>
          </div>
        </div>"""

# Pattern 5: tariffs tab section-header
tariffs_header = """      <!-- Section Header (Clean, zero duplicate refresh button) -->
      <div class="section-header">
        <div>
          <h2 class="section-title">Regulatory Fee Schedules &amp; Eco-Modulation Rates</h2>
          <p class="section-desc">Versioned national base fees, RAM RAG multipliers, and recyclability criteria cited directly from statutory regulatory gazettes.</p>
        </div>
      </div>"""

# Pattern 6: masters tab section-header
masters_header = """        <div class="section-header">
          <div>
            <h2 class="section-title">Governed Countries &amp; Industry Sectors</h2>
            <p class="section-desc">Statutory market jurisdictions, national EPR authorities, and industry packaging category master records.</p>
          </div>
  
        </div>"""

for pattern, name in [
    (batches_header, "batches"),
    (orgs_header, "organisations"),
    (users_header, "users"),
    (datapoints_header, "datapoints"),
    (tariffs_header, "tariffs"),
    (masters_header, "masters")
]:
    if pattern in text:
        text = text.replace(pattern, "")
        print(f"Removed duplicate section-header for: {name}")
    else:
        # Try normalized whitespace replacement
        print(f"Exact pattern not matched for: {name}, attempting regex...")

# Let's clean up any remaining <div class="section-header">...</div> in the tab-content panes
# Using regex to remove any section-header that contains h2 class="section-title"
text = re.sub(
    r'\s*<div class="section-header">\s*<div>\s*<h2 class="section-title">[^<]+</h2>\s*<p class="section-desc">[^<]+</p>\s*</div>\s*(?:<div class="header-action-group">.*?</div>|<button class="btn-refresh".*?</button>)?\s*</div>',
    '',
    text,
    flags=re.DOTALL
)

with open('frontend/src/app/features/admin/admin.component.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Finished cleaning duplicate headers in admin.component.html")
