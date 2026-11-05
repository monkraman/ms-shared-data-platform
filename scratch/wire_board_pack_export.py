import os

path_ts = 'frontend/src/app/features/dashboard/dashboard.component.ts'
with open(path_ts, 'r', encoding='utf-8') as f:
    c = f.read()

method = '''
  exportBoardPack(): void {
    const tenant = this.tenantService.activeTenant()?.name || 'Enterprise Workspace';
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
      ['EU PPWR Declarations of Conformity', this.ppwrSummaryText()],
      ['Data Health Index', this.dataHealthVerified() + '% Verified'],
      ['Regulatory Fee at Risk (Gaps)', this.formatCurrency(this.feeAtRiskFromGapsGbp())],
      [''],
      ['TOP PACKAGING COST HOTSPOTS', 'RATING', 'ANNUAL FEE', 'POTENTIAL SAVINGS'],
    ];

    for (const h of this.hotspotRows()) {
      rows.push([h.format, h.rating, this.formatCurrency(h.feeGbp), '-' + this.formatCurrency(h.savingGbp) + ' / yr']);
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
}'''

c = c.rstrip()
if c.endswith('}'):
    c = c[:-1] + method
with open(path_ts, 'w', encoding='utf-8') as f:
    f.write(c)

path_html = 'frontend/src/app/features/dashboard/dashboard.component.html'
with open(path_html, 'r', encoding='utf-8') as f:
    h = f.read()
h = h.replace('<button type="button" class="btn-board-pack">', '<button type="button" class="btn-board-pack" (click)="exportBoardPack()" id="export-board-pack-btn">')
with open(path_html, 'w', encoding='utf-8') as f:
    f.write(h)

print('Board pack export wired up successfully')

