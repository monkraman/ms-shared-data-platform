import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QualityApiService, DataQualityIssue } from '../../core/services/quality-api.service';
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
  readonly tenantService = inject(TenantApiService);

  readonly issues = this.qualityService.issues;
  readonly selectedIssue = this.qualityService.selectedIssue;
  readonly loading = this.qualityService.loading;
  readonly worklistExport = this.qualityService.worklistExport;

  // Screen 06 (Gap Report) vs Screen 07 (Close the Gaps)
  readonly activeSubView = signal<'report' | 'lanes'>('report');

  readonly activeSeverityFilter = signal<'ALL' | 'BLOCKER' | 'WARNING' | 'INFO'>('ALL');
  readonly proposing = signal<boolean>(false);
  readonly proposedValue = signal<string>('');
  readonly proposedJustification = signal<string>('');
  readonly dispatchSuccessMessage = signal<string | null>(null);

  // Ranked Compliance Gaps matching Screen 06 & 07 from KHC Mockups
  readonly complianceGaps = signal<ComplianceGapItem[]>([
    {
      id: 'GAP-001',
      rank: 1,
      title: 'Unverified PCR Content Certification (Claimed 30% rPET)',
      sku: 'KHC-HTK-400ML-SQ',
      productName: 'Heinz Tomato Ketchup 400ml Squeezy',
      missingDataPoint: 'ISO 14021 supplier recycled content certificate',
      feeImpactGbp: 98000,
      lane: 'supplier',
      route: 'portal',
      status: 'OPEN',
      supplierName: 'Amcor Rigid Packaging (RPC Bramlage)',
      actionNote: 'Supplier requested via portal to upload verified audit certificate. Unlocks -£18.4k discount.',
    },
    {
      id: 'GAP-002',
      rank: 2,
      title: 'Multi-layer Foil Laminate Barrier Spec Incomplete',
      sku: 'KHC-POUCH-250G',
      productName: 'Single Serve Sauce Pouch 250g',
      missingDataPoint: 'Layer mass fraction breakdown (PET / ALU / PE)',
      feeImpactGbp: 50000,
      lane: 'supplier',
      route: 'portal',
      status: 'OPEN',
      supplierName: 'Film Supplier A (Constantia Flexibles)',
      actionNote: 'Open request on Sauce Pouch film layer composition. Avoids +50% Red Malus penalty.',
    },
    {
      id: 'GAP-003',
      rank: 3,
      title: 'Multi-Plant Tare Weight Discrepancy (10.6g vs 9.8g)',
      sku: 'KHC-POUCH-250G',
      productName: 'Single Serve Sauce Pouch 250g (Kitt Green vs Utrecht)',
      missingDataPoint: 'Reconciliation of plant-specific fill-line tare variation',
      feeImpactGbp: 24000,
      lane: 'khc',
      route: 'devex',
      status: 'IN_PROGRESS',
      actionNote: 'KHC Packaging Engineering validating calibrated line tare (10.6g verified against QA spec).',
    },
    {
      id: 'GAP-004',
      rank: 4,
      title: 'Pallet Stretch Wrap & Strapping Sales Allocation',
      sku: 'KHC-BEANZ-415G',
      productName: 'Heinz Baked Beanz 415g Can 4-Pack',
      missingDataPoint: 'Tertiary transit packaging distribution weight per market',
      feeImpactGbp: 18000,
      lane: 'khc',
      route: 'excel',
      status: 'OPEN',
      actionNote: 'Supply chain logistics team reconciling 3PL UK distribution center manifest.',
    },
    {
      id: 'GAP-005',
      rank: 5,
      title: 'PFAS Internal Coating Statement Missing',
      sku: 'KHC-SOUP-TOMATO',
      productName: 'Classic Cream of Tomato Soup Can',
      missingDataPoint: 'BPA-NI and PFAS-free declaration for inner epoxy lacquer',
      feeImpactGbp: 0,
      lane: 'specialist',
      route: 'specialist',
      status: 'OPEN',
      supplierName: 'Crown Holdings (Can Division)',
      actionNote: 'Specialist lab reviewing supplier SVHC declaration for PPWR Article 5 compliance.',
    },
  ]);

  readonly selectedGap = signal<ComplianceGapItem | null>(null);

  // Dynamic Metrics for Screen 06 Hero
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

  ngOnInit(): void {
    this.qualityService.loadIssues().subscribe();
    this.selectedGap.set(this.complianceGaps()[0]);
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

  getFilteredIssues(): DataQualityIssue[] {
    const filter = this.activeSeverityFilter();
    if (filter === 'ALL') return this.issues();
    return this.issues().filter((i) => i.severity.toUpperCase() === filter);
  }

  getGapsByLane(lane: 'khc' | 'supplier' | 'specialist'): ComplianceGapItem[] {
    return this.complianceGaps().filter((g) => g.lane === lane);
  }

  closeGapAction(gapId: string): void {
    this.complianceGaps.update((gaps) =>
      gaps.map((g) => (g.id === gapId ? { ...g, status: 'RESOLVED' } : g))
    );
    this.dispatchSuccessMessage.set(`Gap ${gapId} successfully resolved and verified.`);
  }

  submitCorrectionTicket(): void {
    const issue = this.selectedIssue();
    if (!issue || !this.proposedValue()) return;

    this.proposing.set(true);
    this.qualityService
      .proposeCorrection(
        issue.id,
        this.proposedValue(),
        this.proposedJustification() || 'Verified against packaging technical drawing'
      )
      .subscribe({
        next: () => {
          this.proposing.set(false);
          this.dispatchSuccessMessage.set(
            `Correction Ticket dispatched to ${issue.source_spec_reference} in Trace One PLM.`
          );
        },
        error: () => this.proposing.set(false),
      });
  }

  exportWorklist(): void {
    this.qualityService.exportSourceWorklist().subscribe({
      next: (exportData) => {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: 'application/json',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Monkspaces_Gap_Report_${this.tenantService.activeTenantId()}_2026.json`;
        a.click();
      },
    });
  }
}
