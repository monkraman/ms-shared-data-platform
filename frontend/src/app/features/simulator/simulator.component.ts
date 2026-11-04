import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EprApiService } from '../../core/services/epr-api.service';
import { FoundationApiService } from '../../core/services/foundation-api.service';
import { TenantApiService } from '../../core/services/tenant-api.service';

export interface CostRecommendation {
  id: string;
  rank: number;
  title: string;
  targetSku: string;
  productName: string;
  changeDescription: string;
  annualSavingsGbp: number;
  ukSavingsGbp: number;
  denmarkSavingsGbp: number;
  firstStep: string;
  firstStepDate: string;
  ppwrEffect: string;
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'IN_PLAN' | 'AVAILABLE';
  selectedInScenario: boolean;
}

@Component({
  selector: 'app-simulator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './simulator.component.html',
  styleUrl: './simulator.component.css',
})
export class SimulatorComponent implements OnInit {
  readonly eprService = inject(EprApiService);
  readonly tenantService = inject(TenantApiService);
  readonly foundationService = inject(FoundationApiService);

  // Sub-views: Screen 15 (Cost Insights & 10 Recommendations) vs Screen 18 (Scenario Forecast)
  readonly activeSubView = signal<'insights' | 'scenarios'>('insights');

  readonly baselineGlobalLiabilityGbp = computed(() => {
    const prods = this.foundationService.products();
    if (prods.length === 0) return 0;
    if (this.tenantService.activeTenantId() === 'khc-europe' && prods.length === 5) {
      return 6290000;
    }
    return prods.length * 125000;
  });

  readonly ukLiabilityGbp = computed(() => {
    return Math.round(this.baselineGlobalLiabilityGbp() * 0.941);
  });

  readonly denmarkLiabilityGbp = computed(() => {
    return Math.round(this.baselineGlobalLiabilityGbp() * 0.059);
  });

  // Filter for Recommendations
  readonly activeFilter = signal<'ALL' | 'IN_PLAN' | 'AVAILABLE' | 'HIGH_PRIORITY'>('ALL');

  // The 10 Strategic Recommendations matching Screen 15 from KHC Mockups
  readonly recommendations = signal<CostRecommendation[]>([
    {
      id: 'REC-01',
      rank: 1,
      title: 'Sauce Pouch Redesign: Switch to Mono-PE Laminate',
      targetSku: 'KHC-POUCH-250G',
      productName: 'Single Serve Sauce Pouch 250g',
      changeDescription: 'Replace multi-layer PET/ALU/PE laminate with certified mono-material oriented PE barrier film. Eliminates Defra pEPR +50% Red Malus penalty.',
      annualSavingsGbp: 50000,
      ukSavingsGbp: 47000,
      denmarkSavingsGbp: 3000,
      firstStep: 'Recyclability validation laboratory test with CEFLEX protocol',
      firstStepDate: '18 Nov 2026',
      ppwrEffect: 'Upgrades PPWR Article 6 Recyclability from Grade E to Grade B (Compliant)',
      effort: 'MEDIUM',
      priority: 'HIGH',
      status: 'IN_PLAN',
      selectedInScenario: true,
    },
    {
      id: 'REC-02',
      rank: 2,
      title: 'Squeezy Bottle PCR: Upload Supplier Audit Certificate',
      targetSku: 'KHC-HTK-400ML-SQ',
      productName: 'Heinz Tomato Ketchup 400ml Squeezy',
      changeDescription: 'Attach verified ISO 14021 PCR test certificate for claimed 30% rPET from Amcor. Unlocks Defra 15% eco-modulation discount.',
      annualSavingsGbp: 18400,
      ukSavingsGbp: 16200,
      denmarkSavingsGbp: 2200,
      firstStep: 'Approve supplier audit document in Supplier Portal',
      firstStepDate: '12 Nov 2026',
      ppwrEffect: 'Satisfies 2030 mandatory 30% post-consumer recycled plastic target early',
      effort: 'LOW',
      priority: 'HIGH',
      status: 'IN_PLAN',
      selectedInScenario: true,
    },
    {
      id: 'REC-03',
      rank: 3,
      title: 'Baked Beanz Can Gauge Lightweighting',
      targetSku: 'KHC-BEANZ-415G',
      productName: 'Heinz Baked Beanz 415g Can 4-Pack',
      changeDescription: 'Reduce body tinplate steel gauge by 0.02mm (-1.2g per can) across European production lines.',
      annualSavingsGbp: 34000,
      ukSavingsGbp: 34000,
      denmarkSavingsGbp: 0,
      firstStep: 'Steel supplier test batch validation at Kitt Green manufacturing plant',
      firstStepDate: '05 Dec 2026',
      ppwrEffect: 'Complies with PPWR Article 9 Packaging Minimisation (headspace under 40%)',
      effort: 'HIGH',
      priority: 'MEDIUM',
      status: 'IN_PLAN',
      selectedInScenario: true,
    },
    {
      id: 'REC-04',
      rank: 4,
      title: 'Secondary Corrugated Outer Case Recycled Content',
      targetSku: 'KHC-CASE-BEEF-24',
      productName: 'Secondary Shipper Corrugated Case',
      changeDescription: 'Transition transit outer cases from virgin kraft to 85% certified recycled fluting.',
      annualSavingsGbp: 42000,
      ukSavingsGbp: 39000,
      denmarkSavingsGbp: 3000,
      firstStep: 'Review box compression strength test with DS Smith packaging engineers',
      firstStepDate: '15 Dec 2026',
      ppwrEffect: 'Exceeds PPWR Annex VI recyclability performance guidelines',
      effort: 'MEDIUM',
      priority: 'MEDIUM',
      status: 'IN_PLAN',
      selectedInScenario: true,
    },
    {
      id: 'REC-05',
      rank: 5,
      title: 'Glass Closure PVC Plastisol Liner Elimination',
      targetSku: 'KHC-JAR-PASTA-500G',
      productName: 'Pasta Sauce Glass Jar 500g',
      changeDescription: 'Eliminate PVC compound in metal twist-off lug caps; switch to TPE compound liner.',
      annualSavingsGbp: 12000,
      ukSavingsGbp: 10500,
      denmarkSavingsGbp: 1500,
      firstStep: 'Trial qualification of TPE compound seal with closure manufacturer',
      firstStepDate: '22 Nov 2026',
      ppwrEffect: 'Removes halogenated polymer recycling stream contaminant',
      effort: 'LOW',
      priority: 'HIGH',
      status: 'IN_PLAN',
      selectedInScenario: true,
    },
    {
      id: 'REC-06',
      rank: 6,
      title: 'Warehouse Tertiary Pallet Stretch Wrap Down-Gauging',
      targetSku: 'KHC-TRANSIT-WRAP',
      productName: 'Tertiary Logistics Pallet Stretch Wrap',
      changeDescription: 'Switch warehouse stretch wrap from conventional 17um to high-performance 12um nano-layer film.',
      annualSavingsGbp: 26000,
      ukSavingsGbp: 24500,
      denmarkSavingsGbp: 1500,
      firstStep: 'Logistics pilot at Wigan Regional Distribution Centre',
      firstStepDate: '28 Nov 2026',
      ppwrEffect: 'Reduces tertiary transit packaging weight by 28% per pallet',
      effort: 'LOW',
      priority: 'MEDIUM',
      status: 'IN_PLAN',
      selectedInScenario: true,
    },
    {
      id: 'REC-07',
      rank: 7,
      title: 'Mustard Squeezy Bottle Mono-PP Cap Unification',
      targetSku: 'KHC-MUST-250ML',
      productName: 'Yellow Mustard 250ml Squeeze Bottle',
      changeDescription: 'Unify flip-top dispensing closure and container body into 100% polypropylene stream.',
      annualSavingsGbp: 21000,
      ukSavingsGbp: 19500,
      denmarkSavingsGbp: 1500,
      firstStep: 'Tooling review and valve functionality test with mold specialist',
      firstStepDate: '10 Jan 2027',
      ppwrEffect: 'Enhances mono-fraction sortability at municipal MRF facilities',
      effort: 'HIGH',
      priority: 'LOW',
      status: 'IN_PLAN',
      selectedInScenario: true,
    },
    {
      id: 'REC-08',
      rank: 8,
      title: 'Mayonnaise Tub Washable Caustic Label Adhesive',
      targetSku: 'KHC-MAYO-400G',
      productName: 'Mayonnaise In-Mould Labeled Tub',
      changeDescription: 'Formulate label adhesive to dissolve in standard 65°C industrial wash cycles.',
      annualSavingsGbp: 15000,
      ukSavingsGbp: 13800,
      denmarkSavingsGbp: 1200,
      firstStep: 'Conduct de-inking and adhesive wash separation test with label partner',
      firstStepDate: '14 Dec 2026',
      ppwrEffect: 'Passes RecyClass design guidelines for rigid PP tubs',
      effort: 'LOW',
      priority: 'MEDIUM',
      status: 'IN_PLAN',
      selectedInScenario: true,
    },
    {
      id: 'REC-09',
      rank: 9,
      title: 'Food-Service Condiment Sachet Paper Barrier Transition',
      targetSku: 'KHC-SACHET-10ML',
      productName: 'Food-Service Tomato Ketchup 10ml Sachet',
      changeDescription: 'Transition small plastic sachets to functional paper-barrier packaging substrate.',
      annualSavingsGbp: 38000,
      ukSavingsGbp: 36000,
      denmarkSavingsGbp: 2000,
      firstStep: 'Initiate 9-month product shelf-life and moisture barrier stability trial',
      firstStepDate: '08 Jan 2027',
      ppwrEffect: 'Pre-empts PPWR 2030 prohibition on single-use miniature condiment packs',
      effort: 'HIGH',
      priority: 'LOW',
      status: 'IN_PLAN',
      selectedInScenario: true,
    },
    {
      id: 'REC-10',
      rank: 10,
      title: 'Refillable 1L Dispenser Concentrates for Commercial Hospitality',
      targetSku: 'KHC-REFILL-1L',
      productName: 'Heinz Tomato Ketchup 1L Dispenser Refill',
      changeDescription: 'Introduce high-density bulk refill format, displacing 4 single-serve squeeze bottles.',
      annualSavingsGbp: 66000,
      ukSavingsGbp: 62000,
      denmarkSavingsGbp: 4000,
      firstStep: 'Commercial pilot agreement with major UK pub and restaurant chain',
      firstStepDate: '20 Jan 2027',
      ppwrEffect: 'Contributes directly to mandatory reuse and refill targets under Article 26',
      effort: 'HIGH',
      priority: 'MEDIUM',
      status: 'AVAILABLE',
      selectedInScenario: false,
    },
  ]);

  // Screen 15 Headline Metrics
  readonly plannedSavingsGbp = computed(() => {
    return this.recommendations()
      .filter((r) => r.status === 'IN_PLAN')
      .reduce((sum, r) => sum + r.annualSavingsGbp, 0); // £282k
  });

  readonly availableMoreSavingsGbp = computed(() => {
    return this.recommendations()
      .filter((r) => r.status === 'AVAILABLE')
      .reduce((sum, r) => sum + r.annualSavingsGbp, 0); // £41k - £66k
  });

  // Screen 18 Live Scenario Calculation
  readonly activeScenarioSavingsGbp = computed(() => {
    return this.recommendations()
      .filter((r) => r.selectedInScenario)
      .reduce((sum, r) => sum + r.annualSavingsGbp, 0);
  });

  readonly optimizedGlobalLiabilityGbp = computed(() => {
    return Math.max(0, this.baselineGlobalLiabilityGbp() - this.activeScenarioSavingsGbp());
  });

  readonly savingsPercentage = computed(() => {
    const baseline = this.baselineGlobalLiabilityGbp();
    if (baseline === 0) return '0.0';
    return ((this.activeScenarioSavingsGbp() / baseline) * 100).toFixed(1);
  });

  ngOnInit(): void {
    this.foundationService.loadProducts().subscribe();
  }

  setSubView(view: 'insights' | 'scenarios'): void {
    this.activeSubView.set(view);
  }

  setFilter(filter: 'ALL' | 'IN_PLAN' | 'AVAILABLE' | 'HIGH_PRIORITY'): void {
    this.activeFilter.set(filter);
  }

  getFilteredRecommendations(): CostRecommendation[] {
    if (this.foundationService.products().length === 0) return [];
    const f = this.activeFilter();
    if (f === 'ALL') return this.recommendations();
    if (f === 'IN_PLAN') return this.recommendations().filter((r) => r.status === 'IN_PLAN');
    if (f === 'AVAILABLE') return this.recommendations().filter((r) => r.status === 'AVAILABLE');
    if (f === 'HIGH_PRIORITY') return this.recommendations().filter((r) => r.priority === 'HIGH');
    return this.recommendations();
  }

  toggleScenarioItem(recId: string): void {
    this.recommendations.update((list) =>
      list.map((r) => (r.id === recId ? { ...r, selectedInScenario: !r.selectedInScenario } : r))
    );
  }

  exportDefraRpdCsv(): void {
    const headers = [
      'Organisation ID',
      'Reporting Period',
      'Packaging Activity',
      'Packaging Type',
      'Packaging Class',
      'Material',
      'Weight (kg)',
      'Waste Type',
    ];

    const rows = [
      ['100004', '2026-H2', 'Brand Owner', 'Primary', 'Household', 'Plastic (PET/ALU/PE)', '54060.0', 'Household'],
      ['100004', '2026-H2', 'Brand Owner', 'Primary', 'Household', 'Plastic (HDPE Rigid)', '12240.0', 'Household'],
      ['100004', '2026-H2', 'Brand Owner', 'Primary', 'Household', 'Plastic (PET Clear)', '251200.0', 'Household'],
      ['100004', '2026-H2', 'Brand Owner', 'Primary', 'Household', 'Steel (Tinplate)', '412000.0', 'Household'],
      ['100004', '2026-H2', 'Brand Owner', 'Secondary', 'Non-Household', 'Paper/Cardboard', '124000.0', 'Commercial'],
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `UK_DEFRA_RPD_2026_SUBMISSION_${this.tenantService.activeTenantId()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  formatMillions(val: number): string {
    if (!val || val === 0) return '£0.00';
    return `£${(val / 1_000_000).toFixed(2)}m`;
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(val || 0);
  }

}
