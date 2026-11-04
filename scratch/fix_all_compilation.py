# 1. Update quality-api.service.ts status
with open('frontend/src/app/core/services/quality-api.service.ts', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    "status: 'open' | 'pending_source_update' | 'resolved' | 'suppressed';",
    "status: 'open' | 'pending_source_update' | 'resolved' | 'resolved_in_source' | 'suppressed';"
)

with open('frontend/src/app/core/services/quality-api.service.ts', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated quality-api.service.ts status union")

# 2. Update data-overview.component.ts with setFilter and filteredDataPoints signal/computed
with open('frontend/src/app/features/data-overview/data-overview.component.ts', 'r', encoding='utf-8') as f:
    ts = f.read()

set_filter_code = """
  setFilter(f: 'ALL' | 'SNOWFLAKE' | 'DEVEX' | 'SUPPLIERS' | 'PPWR' | 'UK_EPR'): void {
    this.selectedFilter.set(f);
  }

  readonly filteredDataPoints = computed<DataPointItem[]>(() => {
    return this.getFilteredDataPoints();
  });
"""

if 'setFilter(' not in ts:
    last_brace = ts.rfind('}')
    ts = ts[:last_brace] + set_filter_code + "\n}\n"
    with open('frontend/src/app/features/data-overview/data-overview.component.ts', 'w', encoding='utf-8') as f:
        f.write(ts)
    print("Added setFilter and filteredDataPoints to data-overview.component.ts")
else:
    print("setFilter already exists")

# 3. Update data-overview.component.html for pipelineSteps()
with open('frontend/src/app/features/data-overview/data-overview.component.html', 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace('@for (step of steps; track step.number)', '@for (step of pipelineSteps(); track step.number)')

with open('frontend/src/app/features/data-overview/data-overview.component.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Updated data-overview.component.html pipelineSteps()")
