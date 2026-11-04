# Update simulator.component.ts
with open('frontend/src/app/features/simulator/simulator.component.ts', 'r', encoding='utf-8') as f:
    ts = f.read()

helper_methods = """  formatMillions(val: number): string {
    if (!val || val === 0) return '£0.00';
    return `£${(val / 1_000_000).toFixed(2)}m`;
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(val || 0);
  }
"""

if 'formatMillions' not in ts:
    # insert before last closing brace
    last_brace = ts.rfind('}')
    ts = ts[:last_brace] + helper_methods + "\n}\n"
    with open('frontend/src/app/features/simulator/simulator.component.ts', 'w', encoding='utf-8') as f:
        f.write(ts)
    print("Added formatMillions and formatCurrency to simulator.component.ts")
else:
    print("Helpers already exist in simulator.component.ts")

# Update simulator.component.html
with open('frontend/src/app/features/simulator/simulator.component.html', 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace(
    '<div class="header-badge">PAY LESS &middot; COST OPTIMIZATION &amp; SCENARIOS</div>',
    '<div class="breadcrumb-trail">Cost insights &middot; Eco-Modulation</div>'
)
html = html.replace(
    '[Screen 15] Cost Insights &amp; 10 Recommendations',
    'Cost Insights &amp; 10 Recommendations'
)
html = html.replace(
    '[Screen 18] Scenario Forecast &amp; Modeler',
    'Scenario Forecast &amp; Modeler'
)
html = html.replace(
    'Packaging Scenario Modeler (Screen 18 Lineage)',
    'Packaging Scenario Modeler'
)
html = html.replace(
    '<div class="kpi-value mono">&pound;6.29m</div>',
    '<div class="kpi-value mono">{{ formatMillions(baselineGlobalLiabilityGbp()) }}</div>'
)
html = html.replace(
    'UK pEPR (&pound;5.92m) + Denmark (&pound;0.37m)',
    'UK pEPR ({{ formatMillions(ukLiabilityGbp()) }}) + Denmark ({{ formatMillions(denmarkLiabilityGbp()) }})'
)
html = html.replace(
    'Where the &pound;6.29m Sits (Market &amp; Material Distribution)',
    'Where the {{ formatMillions(baselineGlobalLiabilityGbp()) }} Sits (Market &amp; Material Distribution)'
)
html = html.replace('[BY JURISDICTION]', 'By Jurisdiction')
html = html.replace('[BY MATERIAL CATEGORY]', 'By Material Category')
html = html.replace(
    '<div class="kpi-value mono">&pound;6,290,000</div>',
    '<div class="kpi-value mono">{{ formatCurrency(baselineGlobalLiabilityGbp()) }}</div>'
)
html = html.replace(
    '<span class="meta-val mono">[{{ rec.effort }} EFFORT] &middot; [{{ rec.priority }} PRIORITY]</span>',
    '<span class="meta-val"><span class="badge-effort">{{ rec.effort }} Effort</span> &middot; <span class="badge-priority">{{ rec.priority }} Priority</span></span>'
)

with open('frontend/src/app/features/simulator/simulator.component.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Updated simulator.component.html successfully")
