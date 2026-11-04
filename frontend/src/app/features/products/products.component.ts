import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  imports: [CommonModule, FormsModule, RouterLink],
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

  // View mode: 'list' (Catalog Data Table) or 'detail' (Full BOM & Calculation Trace)
  readonly viewMode = signal<'list' | 'detail'>('list');

  // 6 Detail Tabs: BOM Tree, Fees & Trace, PPWR DoC, DPP, LCA Carbon, Source Lineage
  readonly activeTab = signal<'bom' | 'fees' | 'ppwr' | 'dpp' | 'lca' | 'lineage'>('bom');
  readonly ppwrDoc = this.foundationService.ppwrDoc;
  readonly dppPassport = this.foundationService.dppPassport;
  readonly lcaAssessment = this.foundationService.lcaAssessment;
  readonly moduleEntitlement = this.foundationService.moduleEntitlement;

  // Step 3: Module Additional Data & Enrichment Modals
  readonly showPpwrModal = signal<boolean>(false);
  readonly showLcaModal = signal<boolean>(false);

  // Manual SKU Creation Form Signals
  readonly showCreateSkuModal = signal<boolean>(false);
  readonly newSku = signal<string>('');
  readonly newName = signal<string>('');
  readonly newBrand = signal<string>('The Kraft Heinz Company');
  readonly newCategory = signal<string>('Condiments & Sauces');
  readonly newNetContentGrams = signal<number>(400);
  readonly newComponentName = signal<string>('Top-Down Squeezy Bottle');
  readonly newComponentMaterial = signal<string>('Plastic Rigid (PET)');
  readonly newComponentWeight = signal<number>(24.5);
  readonly newComponentPcrPct = signal<number>(30);
  readonly creatingSku = signal<boolean>(false);
  readonly showDppModal = signal<boolean>(false);
  readonly isSavingEnrichment = signal<boolean>(false);
  readonly enrichmentNotice = signal<string | null>(null);

  // PPWR Form State
  ppwrRecyclassCert = 'RC-2025-EU-889';
  ppwrPcrCert = 'EU-CERT-994';
  ppwrPfasFree = true;
  ppwrHeavyMetalsPass = true;
  ppwrReusable = false;

  // LCA Form State
  lcaRenewablePct = 75.0;
  lcaTransportKm = 180.0;
  lcaEpdId = 'EPD-ENV-2024-912';

  // DPP Form State
  dppGtin = '05000157024672';
  dppLandingUrl = 'https://kraftheinz.com/sustainability';
  dppHarmonisedLabel = 'Triman / OPRL Standard';

  // Search & Faceted Filters
  readonly filterQuery = signal<string>('');
  readonly categoryFilter = signal<string>('ALL');
  readonly qualityFilter = signal<string>('ALL'); // 'ALL' | 'GAPS' | 'CLEAN'

  // Enterprise Pagination State
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);

  ngOnInit(): void {
    this.foundationService.loadProducts().subscribe();
    this.foundationService.loadModuleEntitlement().subscribe();
  }

  isModuleActive(moduleKey: string): boolean {
    const ent = this.moduleEntitlement();
    if (!ent || !ent.active_modules) return true;
    return ent.active_modules.includes(moduleKey);
  }

  openPpwrModal(): void {
    this.enrichmentNotice.set(null);
    this.showPpwrModal.set(true);
  }

  closePpwrModal(): void {
    this.showPpwrModal.set(false);
  }

  submitPpwrEnrichment(sku: string): void {
    this.isSavingEnrichment.set(true);
    this.foundationService.savePpwrEnrichment(sku, {
      recyclass_cert_id: this.ppwrRecyclassCert,
      pcr_cert_id: this.ppwrPcrCert,
      pfas_free_declaration: this.ppwrPfasFree,
      heavy_metals_pass: this.ppwrHeavyMetalsPass,
      reusable_packaging: this.ppwrReusable,
    }).subscribe({
      next: () => {
        this.isSavingEnrichment.set(false);
        this.enrichmentNotice.set('PPWR lab certificates attached & DoC recalculated!');
        setTimeout(() => this.closePpwrModal(), 900);
      },
      error: () => this.isSavingEnrichment.set(false),
    });
  }

  openLcaModal(): void {
    this.enrichmentNotice.set(null);
    this.showLcaModal.set(true);
  }

  closeLcaModal(): void {
    this.showLcaModal.set(false);
  }

  submitLcaEnrichment(sku: string): void {
    this.isSavingEnrichment.set(true);
    this.foundationService.saveLcaEnrichment(sku, {
      renewable_energy_pct: Number(this.lcaRenewablePct),
      transport_distance_km: Number(this.lcaTransportKm),
      epd_registration_id: this.lcaEpdId,
    }).subscribe({
      next: () => {
        this.isSavingEnrichment.set(false);
        this.enrichmentNotice.set('Converter energy mix & transport updated! Carbon footprint recalculated.');
        setTimeout(() => this.closeLcaModal(), 900);
      },
      error: () => this.isSavingEnrichment.set(false),
    });
  }

  openDppModal(): void {
    this.enrichmentNotice.set(null);
    this.showDppModal.set(true);
  }

  closeDppModal(): void {
    this.showDppModal.set(false);
  }

  submitDppEnrichment(sku: string): void {
    this.isSavingEnrichment.set(true);
    this.foundationService.saveDppEnrichment(sku, {
      gtin: this.dppGtin,
      brand_landing_url: this.dppLandingUrl,
      harmonised_label: this.dppHarmonisedLabel,
      disposal_instructions: [
        'Cap: Detach PP closure and dispose in yellow plastic recycling stream.',
        'Body: Rinse container and place in standard curbside sorting bin.',
        'Label: Water-soluble adhesive dissolves during recycling caustic wash.'
      ],
    }).subscribe({
      next: () => {
        this.isSavingEnrichment.set(false);
        this.enrichmentNotice.set('GS1 Digital Link & passport payload saved!');
        setTimeout(() => this.closeDppModal(), 900);
      },
      error: () => this.isSavingEnrichment.set(false),
    });
  }

  selectProduct(sku: string): void {
    this.foundationService.selectProduct(sku);
  }

  syncTraceOne(): void {
    this.foundationService.triggerTraceOneSync().subscribe();
  }

  filterProducts(query: string): void {
    this.filterQuery.set(query.toLowerCase());
    this.currentPage.set(1);
  }

  setCategoryFilter(cat: string): void {
    this.categoryFilter.set(cat);
    this.currentPage.set(1);
  }

  setQualityFilter(q: string): void {
    this.qualityFilter.set(q);
    this.currentPage.set(1);
  }

  getCategories(): string[] {
    const set = new Set<string>();
    this.products().forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }

  getFilteredProducts(): CanonicalProduct[] {
    const q = this.filterQuery();
    const cat = this.categoryFilter();
    const qual = this.qualityFilter();

    return this.products().filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        (p.primary_material_summary && p.primary_material_summary.toLowerCase().includes(q));

      const matchesCat = cat === 'ALL' || p.category === cat;

      const matchesQual =
        qual === 'ALL' ||
        (qual === 'GAPS' && p.has_quality_issues) ||
        (qual === 'CLEAN' && !p.has_quality_issues);

      return matchesSearch && matchesCat && matchesQual;
    });
  }

  // Pagination getters & controls
  getPaginatedProducts(): CanonicalProduct[] {
    const filtered = this.getFilteredProducts();
    const start = (this.currentPage() - 1) * this.pageSize();
    return filtered.slice(start, start + this.pageSize());
  }

  getTotalPages(): number {
    const total = this.getFilteredProducts().length;
    return Math.max(1, Math.ceil(total / this.pageSize()));
  }

  goToPage(page: number): void {
    const max = this.getTotalPages();
    if (page >= 1 && page <= max) {
      this.currentPage.set(page);
    }
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  prevPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  openProductDetail(sku: string): void {
    this.foundationService.selectProduct(sku);
    this.viewMode.set('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  backToCatalog(): void {
    this.viewMode.set('list');
  }

  nextProductDetail(): void {
    const all = this.getFilteredProducts();
    const cur = this.selectedProduct();
    if (!cur || all.length === 0) return;
    const idx = all.findIndex((p) => p.sku === cur.sku);
    if (idx < all.length - 1) {
      this.openProductDetail(all[idx + 1].sku);
    }
  }

  prevProductDetail(): void {
    const all = this.getFilteredProducts();
    const cur = this.selectedProduct();
    if (!cur || all.length === 0) return;
    const idx = all.findIndex((p) => p.sku === cur.sku);
    if (idx > 0) {
      this.openProductDetail(all[idx - 1].sku);
    }
  }

  getCurrentProductIndex(): number {
    const all = this.getFilteredProducts();
    const cur = this.selectedProduct();
    if (!cur) return 0;
    return all.findIndex((p) => p.sku === cur.sku) + 1;
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

  openCreateSkuModal(): void {
    this.newSku.set(`KHC-MANUAL-${Math.floor(100 + Math.random() * 900)}`);
    this.newName.set('');
    this.showCreateSkuModal.set(true);
  }

  submitNewSku(): void {
    if (!this.newSku() || !this.newName() || this.newComponentWeight() <= 0) return;
    this.creatingSku.set(true);

    const payload = {
      sku: this.newSku().trim().toUpperCase(),
      name: this.newName().trim(),
      brand: this.newBrand().trim() || 'Enterprise Brand',
      category: this.newCategory().trim() || 'Food & Beverage',
      net_content_grams: Number(this.newNetContentGrams()) || 100,
      status: 'active',
      components: [
        {
          id: `COMP-${this.newSku().trim().toUpperCase()}-01`,
          name: this.newComponentName().trim() || 'Primary Container',
          level: 'primary',
          material: this.newComponentMaterial(),
          weight_grams: Number(this.newComponentWeight()),
          recycled_content_pct: Number(this.newComponentPcrPct()),
          is_recyclable: true,
          separable_by_consumer: true,
          has_disruptor_pigment: false,
        }
      ]
    };

    this.foundationService.createProduct(payload).subscribe({
      next: (created) => {
        this.creatingSku.set(false);
        this.showCreateSkuModal.set(false);
        this.selectProduct(created.sku);
        this.viewMode.set('detail');
      },
      error: () => this.creatingSku.set(false),
    });
  }
}
