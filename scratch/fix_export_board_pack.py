path_ts = 'frontend/src/app/features/dashboard/dashboard.component.ts'
with open(path_ts, 'r', encoding='utf-8') as f:
    c = f.read()

idx = c.find('  exportBoardPack(): void {')
if idx != -1:
    clean_code = c[:idx]
    clean_code += """  exportBoardPack(): void {
    const tenant = this.activeTenantName();
    const rows = [
      ['EXECUTIVE COMPLIANCE BOARD PACK', 'CONFIDENTIAL', new Date().toISOString().slice(0, 10)],
      ['Tenant / Client Workspace', tenant],
      ['Statutory Scope', 'UK EPR, Denmark VANA EPR, EU PPWR'],
      ['Reporting Year', '2026'],
      [''],
      ['EXECUTIVE POSITION', 'VALUE'],
      ['Global EPR Baseline Liability', this.formatCurrency(this.globalLiabilityGbp())],
      ['UK EPR Invoiced Liability', this.formatCurrency(this.ukLiabilityGbp())],
      ['Denmark EPR Invoiced Liability', this.formatCurrency(this.denmarkLiabilityGbp())],
      ['Data Completeness Index', this.dataCompletenessPercent() + '% Complete'],
      ['Open Data Quality Gaps', String(this.openIssuesCount())],
      [''],
      ['TOP PACKAGING COST HOTSPOTS', 'RATING', 'ANNUAL FEE', 'POTENTIAL SAVINGS'],
    ];

    for (const h of this.hotspotRows()) {
      rows.push([h.title, h.rating, h.fee, '-' + h.saving + ' / yr']);
    }

    rows.push(['']);
    rows.push(['6-YEAR FORECAST TRAJECTORY', 'FEE']);
    for (const y of this.forecastYears()) {
      rows.push([y.year + ' (' + y.status + ')', this.formatCurrency(y.feeGbp)]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${tenant.replace(/\\s+/g, '_')}_Board_Pack_2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
"""
    with open(path_ts, 'w', encoding='utf-8') as f:
        f.write(clean_code)
    print('Updated exportBoardPack successfully')

