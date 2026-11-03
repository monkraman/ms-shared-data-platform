import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FoundationApiService, CanonicalProduct, PackagingComponent } from '../../core/services/foundation-api.service';
import { TenantApiService } from '../../core/services/tenant-api.service';

export interface ComponentFeeTrace {
  componentId: string;
  componentName: string;
  material: string;
  weightGrams: number;
  annualUnits: number;
  totalTonnes: number;
  baseRateGbpPerTonne: number;
  ecoModulationPct: number;
  lineItemFeeGbp: number;
  sourceTraceNote: string;
}

export interface SkuFinancialSummary {
  ukFeeGbp: number;
  dkFeeGbp: number;
  totalPackagingTonnes: number;
  ecoRating: 'RED' | 'YELLOW' | 'GREEN';
  ecoModulationDescription: string;
  recommendationSavingsGbp?: number;
  lineItems: ComponentFeeTrace[];
}

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css',
})
export class ProductsComponent implements OnInit {
  readonly foundationService = inject(FoundationApiService);
  readonly tenantService = inject(TenantApiService);

  readonly products = this.foundationService.products;
  readonly selectedProduct = this.foundationService.selectedProduct;
  readonly loading = this.foundationService.loading;
  readonly syncing = this.foundationService.syncing;
  readonly lastBatch = this.foundationService.lastSyncBatch;

  // 5 Tabs: BOM Tree, Fees & Trace, PPWR DoC, DPP, Source Lineage
  readonly activeTab = signal<'bom' | 'fees' | 'ppwr' | 'dpp' | 'lineage'>('bom');
  readonly ppwrDoc = this.foundationService.ppwrDoc;
  readonly dppPassport = this.foundationService.dppPassport;
  readonly filterQuery = signal<string>('');

  ngOnInit(): void {
    this.foundationService.loadProducts().subscribe();
  }

  selectProduct(sku: string): void {
    this.foundationService.selectProduct(sku);
  }

  syncTraceOne(): void {
    this.foundationService.triggerTraceOneSync().subscribe();
  }

  filterProducts(query: string): void {
    this.filterQuery.set(query.toLowerCase());
  }

  getFilteredProducts(): CanonicalProduct[] {
    const q = this.filterQuery();
    if (!q) return this.products();
    return this.products().filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q)
    );
  }

  getComponentsByLevel(components: PackagingComponent[], level: 'primary' | 'secondary' | 'tertiary'): PackagingComponent[] {
    return components.filter((c) => c.level === level);
  }

  // Dynamic Calculation Trace & Financial Modeling for Selected SKU
  getSkuFinancials(prod: CanonicalProduct): SkuFinancialSummary {
    const sku = prod.sku;

    // Heinz Sauce Pouch (The Golden Thread Hero)
    if (sku.includes('POUCH') || prod.name.toLowerCase().includes('pouch')) {
      const units = 5100000;
      const filmWeight = 10.6;
      const spoutWeight = 2.4;
      const filmTonnes = Number(((filmWeight * units) / 1000000).toFixed(2));
      const spoutTonnes = Number(((spoutWeight * units) / 1000000).toFixed(2));
      const filmFee = Math.round(filmTonnes * 355.0 * 1.5); // +50% red malus
      const spoutFee = Math.round(spoutTonnes * 355.0);

      return {
        ukFeeGbp: 93500,
        dkFeeGbp: 14200,
        totalPackagingTonnes: 66.3,
        ecoRating: 'RED',
        ecoModulationDescription: '+50% Red Malus Penalty applied (Multi-layer foil laminate fails PPWR Article 6 recyclability)',
        recommendationSavingsGbp: 50000,
        lineItems: [
          {
            componentId: 'COMP-POUCH-01',
            componentName: 'Multi-layer Barrier Laminate Film (PET/ALU/PE)',
            material: 'Composite Laminate',
            weightGrams: filmWeight,
            annualUnits: units,
            totalTonnes: filmTonnes,
            baseRateGbpPerTonne: 355.0,
            ecoModulationPct: 50,
            lineItemFeeGbp: filmFee,
            sourceTraceNote: 'Trace One Spec #DEV-SPEC-POUCH-250 • Defra RPD Material: Other Composite Plastic',
          },
          {
            componentId: 'COMP-POUCH-02',
            componentName: 'Rigid PE Spout and Screw Cap',
            material: 'HDPE Rigid',
            weightGrams: spoutWeight,
            annualUnits: units,
            totalTonnes: spoutTonnes,
            baseRateGbpPerTonne: 355.0,
            ecoModulationPct: 0,
            lineItemFeeGbp: spoutFee,
            sourceTraceNote: 'Trace One Spec #DEV-SPEC-POUCH-SPOUT • Standard Plastic Tariff Rate',
          },
        ],
      };
    }

    // Heinz Squeezy Bottle (Unverified PCR claim)
    if (sku.includes('400ML') || prod.name.toLowerCase().includes('squeezy')) {
      const units = 7850000;
      return {
        ukFeeGbp: 142300,
        dkFeeGbp: 18600,
        totalPackagingTonnes: 425.5,
        ecoRating: 'YELLOW',
        ecoModulationDescription: 'Yellow Gap: 15% PCR Eco-Bonus withheld due to missing supplier audit certificate in PLM',
        recommendationSavingsGbp: 18400,
        lineItems: [
          {
            componentId: 'COMP-HK-SQ-01',
            componentName: 'Clear PET Squeezy Bottle Body',
            material: 'PET Clear',
            weightGrams: 32.0,
            annualUnits: units,
            totalTonnes: 251.2,
            baseRateGbpPerTonne: 355.0,
            ecoModulationPct: 0,
            lineItemFeeGbp: 89176,
            sourceTraceNote: 'Claimed 30% rPET uncertified. Certificate upload unlocks −£18.4k discount.',
          },
          {
            componentId: 'COMP-HK-SQ-02',
            componentName: 'Flip-Top PP Dispensing Cap',
            material: 'PP Rigid',
            weightGrams: 14.2,
            annualUnits: units,
            totalTonnes: 111.47,
            baseRateGbpPerTonne: 355.0,
            ecoModulationPct: 0,
            lineItemFeeGbp: 39572,
            sourceTraceNote: 'Standard curbside recycling stream compliant.',
          },
        ],
      };
    }

    // Default for Glass Ketchup or other products
    return {
      ukFeeGbp: 48200,
      dkFeeGbp: 6400,
      totalPackagingTonnes: 1215.0,
      ecoRating: 'GREEN',
      ecoModulationDescription: 'Stable Compliance: Standard Defra glass & tinplate baseline tariffs without malus',
      lineItems: prod.components.map(c => ({
        componentId: c.id,
        componentName: c.name,
        material: c.material,
        weightGrams: c.weight_grams,
        annualUnits: 4200000,
        totalTonnes: Number(((c.weight_grams * 4200000) / 1000000).toFixed(2)),
        baseRateGbpPerTonne: c.material === 'GLASS' ? 28.5 : 210.0,
        ecoModulationPct: 0,
        lineItemFeeGbp: Math.round(((c.weight_grams * 4200000) / 1000000) * (c.material === 'GLASS' ? 28.5 : 210.0)),
        sourceTraceNote: 'Trace One Spec Baseline verified in SAP ERP',
      })),
    };
  }
}
