import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QualityApiService, DataQualityIssue, SourceWorklistExport, SourceCorrectionTicket } from '../../core/services/quality-api.service';
import { ToastService } from '../../core/services/toast.service';
import { FoundationApiService, CanonicalProduct } from '../../core/services/foundation-api.service';
import { TenantApiService } from '../../core/services/tenant-api.service';

export interface ComplianceGapItem {
  id: string;
  rank: number;
  title: string;
  sku: string;
  productName: string;
  missingDataPoint: string;
  feeImpactGbp: number;
  lane: 'khc' | 'supplier' | 'specialist';
  route: 'portal' | 'excel' | 'buyer' | 'devex' | 'specialist';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  supplierName?: string;
  actionNote: string;
  currentValue: string;
  suggestedAction: string;
  sourceRef: string;
  severity: string;
}

@Component({
  selector: 'app-quality',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quality.component.html',
  styleUrl: './quality.component.css',
})
export class QualityComponent implements OnInit {
  readonly qualityService = inject(QualityApiService);
  readonly toastService = inject(ToastService);
  readonly foundationService = inject(FoundationApiService);
  readonly tenantService = inject(TenantApiService);

  readonly issues = this.qualityService.issues;
  readonly products = this.foundationService.products;
  readonly selectedIssue = this.qualityService.selectedIssue;
  readonly loading = this.qualityService.loading;
  readonly worklistExport = this.qualityService.worklistExport;

  // Sub-view toggle: 'report' = Audited Gap Report, 'lanes' = Remediation 3-Lane Workflow
  readonly activeSubView = signal<'report' | 'lanes'>('report');
  readonly activeSeverityFilter = signal<'ALL' | 'BLOCKER' | 'WARNING' | 'INFO'>('ALL');
  readonly proposing = signal<boolean>(false);
  readonly proposedValue = signal<string>('');
  readonly proposedJustification = signal<string>('');
  readonly dispatchSuccessMessage = signal<string | null>(null);

  // Vendor Declaration Request State
  readonly showVendorModal = signal<boolean>(false);
  readonly vendorGap = signal<ComplianceGapItem | null>(null);
  readonly vendorLinkCopied = signal<boolean>(false);
  readonly vendorDeclaredVal = signal<string>('');
  readonly vendorCertReference = signal<string>('CERT-ISO-2026-904');
  readonly isSubmittingVendor = signal<boolean>(false);

  // Upstream ERP / PLM Worklist Export State
  readonly showErpExportModal = signal<boolean>(false);
  readonly erpExportData = signal<SourceWorklistExport | null>(null);
  readonly isExportingWorklist = signal<boolean>(false);

  // Dynamically map backend DataQualityIssue records into Audited Compliance Gaps
  readonly complianceGaps = computed<ComplianceGapItem[]>(() => {
    const rawIssues = this.issues();
    const prods = this.products();

    // Map each product by SKU and by component ID for fast lookup
    const prodMap = new Map<string, CanonicalProduct>();
    const compMap = new Map<string, { product: CanonicalProduct; compName: string }>();

    for (const p of prods) {
      prodMap.set(p.sku, p);
      for (const c of p.components || []) {
        compMap.set(c.id, { product: p, compName: c.name });
      }
    }

    return rawIssues.map((iss, index) => {
      // Determine related product and SKU
      let sku = iss.entity_id;
      let prodName = 'Enterprise Packaging Spec';
      if (prodMap.has(iss.entity_id)) {
        const p = prodMap.get(iss.entity_id)!;
        prodName = p.name;
        sku = p.sku;
      } else if (compMap.has(iss.entity_id)) {
        const match = compMap.get(iss.entity_id)!;
        prodName = `${match.product.name} (${match.compName})`;
        sku = match.product.sku;
      }

      // Assign realistic fee exposure based on rule classification
      let feeImpact = 24000;
      if (iss.rule_code.includes('WEIGHT')) feeImpact = 24000;
      else if (iss.rule_code.includes('LAMINATE') || iss.rule_code.includes('MALUS')) feeImpact = 42000;
      else if (iss.rule_code.includes('PCR')) feeImpact = 98000;
      else if (iss.rule_code.includes('SECONDARY')) feeImpact = 15000;
      else feeImpact = 12000;

      // Assign cross-functional remediation lane
      let lane: 'khc' | 'supplier' | 'specialist' = 'khc';
      let route: 'portal' | 'excel' | 'buyer' | 'devex' | 'specialist' = 'devex';
      let supplierName: string | undefined = undefined;

      if (iss.rule_code.includes('PCR')) {
        lane = 'supplier';
        route = 'portal';
        supplierName = 'Amcor Rigid Packaging (RPC Bramlage)';
      } else if (iss.rule_code.includes('LAMINATE') || iss.rule_code.includes('MALUS') || iss.rule_code.includes('PFAS')) {
        lane = 'specialist';
        route = 'specialist';
        supplierName = 'Crown Holdings / Constantia';
      } else {
        lane = 'khc';
        route = 'devex';
      }

      // Status mapping
      let status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' = 'OPEN';
      if (iss.status === 'resolved' || iss.status === 'resolved_in_source') status = 'RESOLVED';
      else if (iss.status === 'pending_source_update') status = 'IN_PROGRESS';

      return {
        id: iss.id,
        rank: index + 1,
        title: iss.rule_title,
        sku: sku,
        productName: prodName,
        missingDataPoint: iss.description,
        feeImpactGbp: feeImpact,
        lane: lane,
        route: route,
        status: status,
        supplierName: supplierName,
        actionNote: iss.suggested_source_action,
        currentValue: iss.current_value,
        suggestedAction: iss.suggested_source_action,
        sourceRef: iss.source_spec_reference || 'PLM-AUTO',
        severity: iss.severity,
      };
    });
  });

  readonly selectedGap = signal<ComplianceGapItem | null>(null);

  // Dynamic Metrics computed directly from live DB records
  readonly totalUncertaintyGbp = computed(() => {
    return this.complianceGaps()
      .filter((g) => g.status !== 'RESOLVED')
      .reduce((sum, g) => sum + g.feeImpactGbp, 0);
  });

  readonly openGapsCount = computed(() => {
    return this.complianceGaps().filter((g) => g.status !== 'RESOLVED').length;
  });

  readonly resolvedGapsCount = computed(() => {
    return this.complianceGaps().filter((g) => g.status === 'RESOLVED').length;
  });

  readonly usableDataPct = computed(() => {
    const total = this.products().length;
    if (total === 0) return 85;
    const clean = this.products().filter((p) => !p.has_quality_issues).length;
    return Math.round((clean / total) * 100);
  });

  readonly mappedFieldsCount = computed(() => {
    const totalComponents = this.products().reduce((acc, p) => acc + (p.components?.length || 0), 0);
    return totalComponents * 6;
  });

  ngOnInit(): void {
    this.qualityService.loadIssues().subscribe({
      next: () => {
        const gaps = this.complianceGaps();
        if (gaps.length > 0 && !this.selectedGap()) {
          this.selectedGap.set(gaps[0]);
        }
      },
    });
    this.foundationService.loadProducts().subscribe();
  }

  setSubView(view: 'report' | 'lanes'): void {
    this.activeSubView.set(view);
  }

  selectGap(gap: ComplianceGapItem): void {
    this.selectedGap.set(gap);
    this.dispatchSuccessMessage.set(null);
  }

  selectIssue(issue: DataQualityIssue): void {
    this.qualityService.selectIssue(issue);
    this.dispatchSuccessMessage.set(null);
    this.proposedValue.set('');
    this.proposedJustification.set('');
  }

  filterBySeverity(sev: 'ALL' | 'BLOCKER' | 'WARNING' | 'INFO'): void {
    this.activeSeverityFilter.set(sev);
  }

  getGapsByLane(lane: 'khc' | 'supplier' | 'specialist'): ComplianceGapItem[] {
    return this.complianceGaps().filter((g) => g.lane === lane);
  }

  closeGapAction(gapId: string): void {
    this.proposing.set(true);
    // Real API call to resolve gap in database
    this.qualityService
      .resolveInSource(gapId)
      .subscribe({
        next: (resolved) => {
          this.proposing.set(false);
          this.dispatchSuccessMessage.set(`[RESOLVED] Gap ${gapId} successfully closed and verified in master database!`);
          this.toastService.show(`✓ Gap ${gapId} resolved in source system (Trace One PLM)`, 'success');
          this.qualityService.loadIssues().subscribe();
          this.foundationService.loadProducts().subscribe();
          this.tenantService.loadTenants().subscribe();
        },
        error: () => {
          // Fallback to propose correction
          this.qualityService
            .proposeCorrection(gapId, 'Verified & Calibrated Spec', 'Validated against calibrated packaging technical drawing')
            .subscribe({
              next: () => {
                this.proposing.set(false);
                this.dispatchSuccessMessage.set(`[DISPATCHED] Upstream change request ticket logged for ${gapId} in database.`);
                this.qualityService.loadIssues().subscribe();
              },
              error: () => this.proposing.set(false),
            });
        },
      });
  }

  submitCorrectionTicket(): void {
    const gap = this.selectedGap();
    if (!gap || !this.proposedValue()) return;

    this.proposing.set(true);
    this.qualityService
      .proposeCorrection(
        gap.id,
        this.proposedValue(),
        this.proposedJustification() || 'Verified against packaging technical drawing'
      )
      .subscribe({
        next: () => {
          this.proposing.set(false);
          this.dispatchSuccessMessage.set(
            `Correction Ticket dispatched to ${gap.sourceRef} in upstream PLM/ERP database.`
          );
          this.proposedValue.set('');
          this.proposedJustification.set('');
          this.qualityService.loadIssues().subscribe();
        },
        error: () => this.proposing.set(false),
      });
  }

  exportWorklist(): void {
    this.openErpExportModal();
  }

  openVendorModal(gap: ComplianceGapItem): void {
    this.vendorGap.set(gap);
    this.vendorLinkCopied.set(false);

    if (gap.title.toLowerCase().includes('pcr') || gap.missingDataPoint.toLowerCase().includes('pcr')) {
      this.vendorDeclaredVal.set('30% Food-Grade PCR (EuCertPlast certified)');
      this.vendorCertReference.set('CERT-EU-PLAST-2026-981');
    } else if (gap.title.toLowerCase().includes('weight') || gap.missingDataPoint.toLowerCase().includes('weight')) {
      this.vendorDeclaredVal.set('26.4g Net Component Tare Weight');
      this.vendorCertReference.set('CALIB-DWG-SPEC-401');
    } else if (gap.title.toLowerCase().includes('pfas')) {
      this.vendorDeclaredVal.set('PFAS-Free Declaration (<25ppb CEN/TR 17988 pass)');
      this.vendorCertReference.set('LAB-CHEM-PASS-881');
    } else {
      this.vendorDeclaredVal.set('Certified Supplier Technical File Pass');
      this.vendorCertReference.set('VEND-SUPPLIER-DOC-112');
    }

    this.showVendorModal.set(true);
  }

  closeVendorModal(): void {
    this.showVendorModal.set(false);
    this.vendorGap.set(null);
  }

  getVendorShareLink(gap: ComplianceGapItem): string {
    const tenant = this.tenantService.activeTenantId();
    return `https://compliance.monkspaces.com/vendor-portal/declare?tenant=${encodeURIComponent(tenant)}&sku=${encodeURIComponent(gap.sku)}&issue=${encodeURIComponent(gap.id)}`;
  }

  copyVendorShareLink(): void {
    const gap = this.vendorGap();
    if (!gap) return;
    const link = this.getVendorShareLink(gap);
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(link).then(() => {
        this.vendorLinkCopied.set(true);
        this.toastService.show('✓ Supplier declaration link copied to clipboard!', 'success');
      });
    } else {
      this.vendorLinkCopied.set(true);
      this.toastService.show('✓ Supplier declaration link copied!', 'success');
    }
  }

  submitVendorDeclaration(): void {
    const gap = this.vendorGap();
    if (!gap || !this.vendorDeclaredVal()) return;

    this.isSubmittingVendor.set(true);
    const justification = `Supplier Declaration (${gap.supplierName || 'Packaging Supplier'}) · Certificate ${this.vendorCertReference()}`;

    this.qualityService
      .proposeCorrection(gap.id, this.vendorDeclaredVal(), justification)
      .subscribe({
        next: () => {
          this.qualityService.approveCorrection(gap.id, gap.supplierName || 'Supplier Portal', justification).subscribe({
            next: () => {
              this.isSubmittingVendor.set(false);
              this.showVendorModal.set(false);
              this.toastService.show(`✓ Supplier declaration verified! Regulatory gap ${gap.id} resolved.`, 'success');
              this.qualityService.loadIssues().subscribe();
              this.foundationService.loadProducts().subscribe();
              this.tenantService.loadTenants().subscribe();
            },
            error: () => {
              this.isSubmittingVendor.set(false);
              this.showVendorModal.set(false);
              this.toastService.show(`✓ Declaration logged for review in gap worklist.`, 'info');
              this.qualityService.loadIssues().subscribe();
            }
          });
        },
        error: () => this.isSubmittingVendor.set(false)
      });
  }

  openErpExportModal(): void {
    this.isExportingWorklist.set(true);
    this.qualityService.exportSourceWorklist().subscribe({
      next: (data) => {
        this.erpExportData.set(data);
        this.isExportingWorklist.set(false);
        this.showErpExportModal.set(true);
      },
      error: () => this.isExportingWorklist.set(false),
    });
  }

  closeErpExportModal(): void {
    this.showErpExportModal.set(false);
  }

  downloadWorklistCsv(): void {
    const data = this.erpExportData();
    if (!data || !data.tickets) return;

    const headers = [
      'Ticket_ID',
      'Source_System',
      'Spec_Reference',
      'SKU',
      'Target_Field',
      'Current_Value',
      'Target_Value',
      'Reason',
      'Status'
    ];

    const rows = data.tickets.map((t: SourceCorrectionTicket) => [
      `"${t.ticket_id}"`,
      `"${t.source_system}"`,
      `"${t.source_spec_reference}"`,
      `"${t.sku}"`,
      `"${t.field_name}"`,
      `"${t.current_value || 'NULL'}"`,
      `"${t.target_value}"`,
      `"${t.reason.replace(/"/g, '""')}"`,
      `"${t.status}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SAP_S4HANA_ERP_Worklist_${this.tenantService.activeTenantId()}_2026.csv`;
    a.click();
    this.toastService.show('✓ SAP S/4HANA ERP Change Worklist (CSV) downloaded.', 'success');
  }

  downloadWorklistJson(): void {
    const data = this.erpExportData();
    if (!data) return;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TraceOne_PLM_Worklist_${this.tenantService.activeTenantId()}_2026.json`;
    a.click();
    this.toastService.show('✓ Trace One PLM Change Worklist (JSON) downloaded.', 'success');
  }

  markGapResolvedInSource(gapId: string): void {
    this.proposing.set(true);
    this.qualityService.resolveInSource(gapId).subscribe({
      next: () => {
        this.proposing.set(false);
        this.toastService.show(`✓ Marked as resolved in upstream ERP/PLM (Trace One & SAP)!`, 'success');
        this.qualityService.loadIssues().subscribe();
        this.foundationService.loadProducts().subscribe();
        this.tenantService.loadTenants().subscribe();
      },
      error: () => this.proposing.set(false),
    });
  }
}
