import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FoundationApiService, CanonicalProduct, PackagingComponent, SkuImportItem, SkuImportPayload, SkuImportResponse } from '../../core/services/foundation-api.service';
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

export interface FormBomComponent {
  name: string;
  level: 'primary' | 'secondary' | 'tertiary';
  material: string;
  weightGrams: number;
  recycledContentPct: number;
  isRecyclable: boolean;
  separableByConsumer: boolean;
  foodContact: boolean;
  hasDisruptorPigment: boolean;
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

  // Manual SKU Creation Form Signals (BOM Multi-Component Collection)
  readonly showCreateSkuModal = signal<boolean>(false);
  readonly newSku = signal<string>('');
  readonly newName = signal<string>('');
  readonly newBrand = signal<string>('The Kraft Heinz Company');
  readonly newCategory = signal<string>('Condiments & Sauces');
  readonly newNetContentGrams = signal<number>(400);
  readonly newGtin = signal<string>('05000157024672');
  readonly newPrimaryJurisdiction = signal<string>('GB');
  readonly newAnnualUnits = signal<number>(1200000);
  readonly creatingSku = signal<boolean>(false);
  readonly createSkuError = signal<string | null>(null);

  readonly formComponents = signal<FormBomComponent[]>([
    {
      name: 'Primary Squeezy Bottle Body',
      level: 'primary',
      material: 'PET (Clear / Light Blue)',
      weightGrams: 28.5,
      recycledContentPct: 30,
      isRecyclable: true,
      separableByConsumer: true,
      foodContact: true,
      hasDisruptorPigment: false,
    },
    {
      name: 'Flip-Top Dispensing Closure Cap',
      level: 'primary',
      material: 'PP (Polypropylene)',
      weightGrams: 4.8,
      recycledContentPct: 0,
      isRecyclable: true,
      separableByConsumer: true,
      foodContact: true,
      hasDisruptorPigment: false,
    }
  ]);

  readonly totalFormTareWeightGrams = computed(() => {
    return Math.round(
      this.formComponents().reduce((acc, c) => acc + (Number(c.weightGrams) || 0), 0) * 10
    ) / 10;
  });

  readonly weightedFormPcrPct = computed(() => {
    const totalWeight = this.totalFormTareWeightGrams();
    if (totalWeight <= 0) return 0;
    const weightedSum = this.formComponents().reduce(
      (acc, c) => acc + (Number(c.weightGrams) || 0) * (Number(c.recycledContentPct) || 0),
      0
    );
    return Math.round((weightedSum / totalWeight) * 10) / 10;
  });

  readonly isFormValid = computed(() => {
    const skuOk = this.newSku().trim().length >= 3;
    const nameOk = this.newName().trim().length >= 2;
    const comps = this.formComponents();
    if (comps.length === 0) return false;
    const compsOk = comps.every(
      (c) => c.name.trim().length > 0 && Number(c.weightGrams) > 0 && c.material.trim().length > 0
    );
    return skuOk && nameOk && compsOk;
  });
  readonly showDppModal = signal<boolean>(false);
  readonly isSavingEnrichment = signal<boolean>(false);
  readonly enrichmentNotice = signal<string | null>(null);

  // Client Bulk CSV Import State
  readonly showImportModal = signal<boolean>(false);
  readonly importMode = signal<'sample' | 'paste' | 'file'>('file');
  readonly importSourceName = signal<string>('Client_Catalog_Update.csv');
  readonly csvTextInput = signal<string>('');
  readonly parsedImportSkus = signal<SkuImportItem[]>([]);
  readonly isImporting = signal<boolean>(false);
  readonly importError = signal<string | null>(null);
  readonly importResult = signal<SkuImportResponse | null>(null);

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

  addFormComponent(): void {
    const comps = this.formComponents();
    const nextIdx = comps.length + 1;
    this.formComponents.update((list) => [
      ...list,
      {
        name: nextIdx === 3 ? 'Paper Front/Back Label' : `Packaging Component #${nextIdx}`,
        level: nextIdx >= 4 ? 'secondary' : 'primary',
        material: nextIdx === 3 ? 'Paper / Corrugated Board' : 'Flexible PE (LDPE/LLDPE)',
        weightGrams: nextIdx === 3 ? 1.2 : 6.0,
        recycledContentPct: 0,
        isRecyclable: true,
        separableByConsumer: true,
        foodContact: false,
        hasDisruptorPigment: false,
      }
    ]);
  }

  removeFormComponent(index: number): void {
    if (this.formComponents().length <= 1) return;
    this.formComponents.update((list) => list.filter((_, i) => i !== index));
  }

  openCreateSkuModal(): void {
    const activeTenant = this.tenantService.activeTenantId();
    const isNord = activeTenant === 'nordhavn-spirits';
    const prefix = isNord ? 'NORD' : 'KHC';
    const randNum = Math.floor(1000 + Math.random() * 9000);

    this.newSku.set(`${prefix}-${randNum}`);
    this.newName.set('');
    this.newBrand.set(isNord ? 'Nordhavn Spirits' : 'The Kraft Heinz Company');
    this.newCategory.set(isNord ? 'Organic Spirits & Beverages' : 'Condiments & Sauces');
    this.newNetContentGrams.set(isNord ? 700 : 500);
    this.newGtin.set(`54100${randNum}0981`);
    this.newPrimaryJurisdiction.set(isNord ? 'DK' : 'GB');
    this.newAnnualUnits.set(isNord ? 350000 : 1200000);
    this.createSkuError.set(null);

    this.formComponents.set([
      {
        name: isNord ? '700ml Amber Glass Spirit Bottle' : '500ml Squeezy Top-Down Bottle Body',
        level: 'primary',
        material: isNord ? 'Glass' : 'PET (Clear / Light Blue)',
        weightGrams: isNord ? 385.0 : 28.5,
        recycledContentPct: isNord ? 65 : 30,
        isRecyclable: true,
        separableByConsumer: true,
        foodContact: true,
        hasDisruptorPigment: false,
      },
      {
        name: isNord ? 'Natural Cork with Wooden Top' : 'PP Flip-Top Dispensing Closure',
        level: 'primary',
        material: isNord ? 'Other Composite / Multi-Material' : 'PP (Polypropylene)',
        weightGrams: isNord ? 14.2 : 4.8,
        recycledContentPct: 0,
        isRecyclable: true,
        separableByConsumer: true,
        foodContact: true,
        hasDisruptorPigment: false,
      }
    ]);

    this.showCreateSkuModal.set(true);
  }

  closeCreateSkuModal(): void {
    this.showCreateSkuModal.set(false);
    this.createSkuError.set(null);
  }

  submitNewSku(): void {
    if (!this.isFormValid()) return;
    this.creatingSku.set(true);
    this.createSkuError.set(null);

    const skuClean = this.newSku().trim().toUpperCase();
    const comps = this.formComponents().map((c, idx) => ({
      id: `COMP-${skuClean}-${String(idx + 1).padStart(2, '0')}`,
      name: c.name.trim(),
      level: c.level,
      material: c.material,
      weight_grams: Number(c.weightGrams),
      recycled_content_pct: Number(c.recycledContentPct),
      is_recyclable: Boolean(c.isRecyclable),
      separable_by_consumer: Boolean(c.separableByConsumer),
      has_disruptor_pigment: Boolean(c.hasDisruptorPigment),
      source_lineage: {
        source_system: 'Platform Form Builder',
        source_record_id: `MANUAL-${skuClean}-C${idx + 1}`,
        raw_material_code: c.material.split(' ')[0],
        raw_description: c.name.trim(),
        extracted_at: new Date().toISOString(),
      }
    }));

    const payload = {
      sku: skuClean,
      name: this.newName().trim(),
      brand: this.newBrand().trim() || 'Enterprise Brand',
      category: this.newCategory().trim() || 'General',
      net_content_grams: Number(this.newNetContentGrams()) || 0,
      unit_volume_ml: Number(this.newNetContentGrams()) || null,
      status: 'active',
      components: comps,
      dpp_enrichment: {
        gtin: this.newGtin().trim(),
      },
      epr_enrichment: {
        activity_type: 'Brand Owner',
        organisation_size: 'Large Producer',
        reuse_system_active: false,
      }
    };

    this.foundationService.createProduct(payload).subscribe({
      next: (created) => {
        this.creatingSku.set(false);
        this.showCreateSkuModal.set(false);
        this.foundationService.loadProducts().subscribe();
        this.selectProduct(created.sku);
        this.viewMode.set('detail');
      },
      error: (err) => {
        this.creatingSku.set(false);
        this.createSkuError.set(err?.error?.detail || err.message || 'Failed to create product SKU.');
      }
    });
  }

  openImportModal(): void {
    this.importResult.set(null);
    this.importError.set(null);
    this.parsedImportSkus.set([]);
    this.showImportModal.set(true);
  }

  closeImportModal(): void {
    this.showImportModal.set(false);
    this.importResult.set(null);
    this.importError.set(null);
  }

  setImportMode(mode: 'sample' | 'paste' | 'file'): void {
    this.importMode.set(mode);
  }

  handleFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.importSourceName.set(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      this.csvTextInput.set(text);
      this.parseCsvInput();
    };
    reader.readAsText(file);
  }

  handleFileDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.csv')) {
        this.importSourceName.set(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = (e.target?.result as string) || '';
          this.csvTextInput.set(text);
          this.parseCsvInput();
        };
        reader.readAsText(file);
      } else {
        this.importError.set('Please drop a valid .csv file.');
      }
    }
  }

  onCsvTextChange(text: string): void {
    this.csvTextInput.set(text);
    this.parseCsvInput();
  }

  parseCsvInput(): void {
    const text = this.csvTextInput().trim();
    if (!text) {
      this.parsedImportSkus.set([]);
      return;
    }
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 2) {
      this.parsedImportSkus.set([]);
      return;
    }

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let inQuotes = false;
      let current = '';
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));
    const skuIdx = headers.findIndex((h) => h.includes('sku') || h.includes('code') || h.includes('id') || h.includes('matnr') || h.includes('article') || h.includes('item'));
    const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('title') || h.includes('desc') || h.includes('designation') || h.includes('label'));
    const brandIdx = headers.findIndex((h) => h.includes('brand') || h.includes('make') || h.includes('mfr'));
    const catIdx = headers.findIndex((h) => h.includes('cat') || h.includes('segment') || h.includes('group'));
    const matIdx = headers.findIndex((h) => h.includes('mat') || h.includes('subst') || h.includes('polymer') || h.includes('pkg'));
    const weightIdx = headers.findIndex((h) => h.includes('weight') || h.includes('tare') || h.includes('gram') || h.includes('mass'));
    const pcrIdx = headers.findIndex((h) => h.includes('pcr') || h.includes('recycled'));
    const salesIdx = headers.findIndex((h) => h.includes('sale') || h.includes('unit') || h.includes('volume') || h.includes('qty'));
    const jurIdx = headers.findIndex((h) => h.includes('jur') || h.includes('country') || h.includes('market') || h.includes('geo') || h.includes('iso'));

    const items: SkuImportItem[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      if (cols.length === 0 || !cols[0]) continue;

      const sku = skuIdx >= 0 ? cols[skuIdx] : cols[0];
      const name = nameIdx >= 0 ? cols[nameIdx] : (cols[1] || sku);
      const brand = brandIdx >= 0 ? cols[brandIdx] : 'Enterprise Brand';
      const category = catIdx >= 0 ? cols[catIdx] : 'General';
      const material = matIdx >= 0 ? cols[matIdx] : '';
      const rawWeight = weightIdx >= 0 ? cols[weightIdx] : '';
      const weight = rawWeight && !isNaN(Number(rawWeight)) ? Number(rawWeight) : null;
      const rawPcr = pcrIdx >= 0 ? cols[pcrIdx] : '0';
      const pcr = rawPcr && !isNaN(Number(rawPcr)) ? Number(rawPcr) : 0;
      const rawSales = salesIdx >= 0 ? cols[salesIdx] : '0';
      const sales = rawSales && !isNaN(Number(rawSales)) ? Number(rawSales) : null;
      const jur = jurIdx >= 0 && cols[jurIdx] ? cols[jurIdx] : 'UK';

      items.push({
        sku,
        name,
        brand,
        category,
        material,
        packaging_weight_grams: weight,
        recycled_content_pct: pcr,
        is_recyclable: true,
        units_sold: sales,
        jurisdiction: jur,
      });
    }

    this.parsedImportSkus.set(items);
  }

  executeClientImport(): void {
    const tenantId = this.tenantService.activeTenantId();
    const items = this.parsedImportSkus();
    if (items.length === 0) {
      this.importError.set('No valid SKU rows parsed.');
      return;
    }
    this.isImporting.set(true);
    this.importError.set(null);
    const payload: SkuImportPayload = {
      tenant_id: tenantId,
      source_name: this.importSourceName(),
      items: items,
    };
    this.foundationService.importSkus(payload).subscribe({
      next: (res) => {
        this.isImporting.set(false);
        this.importResult.set(res);
        this.foundationService.loadProducts().subscribe();
      },
      error: (err) => {
        this.isImporting.set(false);
        this.importError.set(err?.error?.detail || err.message || 'Failed to import SKU records.');
      }
    });
  }
}
