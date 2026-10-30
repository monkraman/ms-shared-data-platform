import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { APP_CONFIG } from '../../core/config/client-theme.config';
import { TenantApiService } from '../../core/services/tenant-api.service';
import { ConfigApiService, SectorConfig, CountryConfig, ComplianceMatrixResponse } from '../../core/services/config-api.service';
import { ClientWorkspaceProfile, TenantMarketSelection, TenantIntegrationConfig } from '../../core/models/tenant.model';
import { WizardStep } from '../../shared/components/step-indicator/step-indicator.component';

export interface DataPointRow {
  id: string;
  name: string;
  category: 'ERP' | 'PLM' | 'COMPLIANCE' | 'SUPPLIER';
  categoryLabel: string;
  ukStatus: 'held' | 'collect' | 'na';
  dkStatus: 'held' | 'collect' | 'na';
}

export interface MarketOption {
  countryCode: string;
  countryName: string;
  regulationCode: string;
  regulationLabel: string;
  selected: boolean;
  mandatory?: boolean;
}

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.css',
})
export class OnboardingComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly tenantService = inject(TenantApiService);
  readonly configService = inject(ConfigApiService);

  readonly config = APP_CONFIG;

  // Wizard state: 1 · Company & entities, 2 · Markets & laws, 3 · Data points, 4 · Connect systems
  readonly currentStep = signal<number>(2); // Default to Step 2 as in mockups, or user can click step 1
  readonly submitting = signal<boolean>(false);
  readonly submitSuccess = signal<boolean>(false);

  // Dynamic masters from backend
  readonly backendSectors = signal<SectorConfig[]>([]);
  readonly backendCountries = signal<CountryConfig[]>([]);
  readonly complianceMatrix = signal<ComplianceMatrixResponse | null>(null);

  readonly steps: WizardStep[] = [
    { number: 1, title: 'Company & entities', subtitle: 'Legal profile & entities' },
    { number: 2, title: 'Markets & laws', subtitle: 'Where you sell' },
    { number: 3, title: 'Data points', subtitle: 'Hold vs Monk Spaces collects' },
    { number: 4, title: 'Connect systems', subtitle: 'PLM, Snowflake & ERP' },
  ];

  // Markets in scope matching Mockup Screen 2 (split into 2 columns)
  readonly marketsCol1 = signal<MarketOption[]>([
    { countryCode: 'UK', countryName: 'United Kingdom', regulationCode: 'UK pEPR', regulationLabel: 'UK pEPR', selected: true, mandatory: true },
    { countryCode: 'FR', countryName: 'France', regulationCode: 'FR_CITEO', regulationLabel: 'Citeo / AGEC', selected: false },
    { countryCode: 'DE', countryName: 'Germany', regulationCode: 'DE_VERPACKG', regulationLabel: 'LUCID VerpackG', selected: false },
    { countryCode: 'ES', countryName: 'Spain', regulationCode: 'ES_RD1055', regulationLabel: 'RD 1055/2022', selected: false },
    { countryCode: 'IT', countryName: 'Italy', regulationCode: 'IT_CONAI', regulationLabel: 'CONAI EPR', selected: false },
    { countryCode: 'NL', countryName: 'Netherlands', regulationCode: 'NL_AFVALFONDS', regulationLabel: 'Afvalfonds', selected: false },
  ]);

  readonly marketsCol2 = signal<MarketOption[]>([
    { countryCode: 'BE', countryName: 'Belgium', regulationCode: 'BE_VALIPAC', regulationLabel: 'Fost Plus / Valipac', selected: false },
    { countryCode: 'DK', countryName: 'Denmark', regulationCode: 'DK_DPA', regulationLabel: 'DPA + PRO', selected: true },
    { countryCode: 'US_CA', countryName: 'California', regulationCode: 'SB_54', regulationLabel: 'SB 54 EPR', selected: false },
    { countryCode: 'US_OR', countryName: 'Oregon', regulationCode: 'OR_PLASTIC', regulationLabel: 'Plastic Pollution Recycling Act', selected: false },
    { countryCode: 'US_CO', countryName: 'Colorado', regulationCode: 'CO_PRODUCER', regulationLabel: 'Producer Responsibility Act', selected: false },
    { countryCode: 'CA', countryName: 'Canada: ON, BC', regulationCode: 'CA_RPRA', regulationLabel: 'Blue Box EPR', selected: false },
  ]);

  // Canonical 37 Data Points for UK & DK matching Mockup Screen 3
  readonly dataPoints = signal<DataPointRow[]>([
    // Group 1: ERP · sales and SKU data (10 items)
    { id: 'DP01', name: 'Article / SKU number', category: 'ERP', categoryLabel: 'ERP · sales and SKU data', ukStatus: 'held', dkStatus: 'held' },
    { id: 'DP02', name: 'GTIN / barcode', category: 'ERP', categoryLabel: 'ERP · sales and SKU data', ukStatus: 'held', dkStatus: 'held' },
    { id: 'DP03', name: 'Packaging component list', category: 'ERP', categoryLabel: 'ERP · sales and SKU data', ukStatus: 'held', dkStatus: 'held' },
    { id: 'DP04', name: 'Units per pack', category: 'ERP', categoryLabel: 'ERP · sales and SKU data', ukStatus: 'held', dkStatus: 'held' },
    { id: 'DP05', name: 'Units placed on the market', category: 'ERP', categoryLabel: 'ERP · sales and SKU data', ukStatus: 'held', dkStatus: 'held' },
    { id: 'DP06', name: 'Sales channel', category: 'ERP', categoryLabel: 'ERP · sales and SKU data', ukStatus: 'held', dkStatus: 'held' },
    { id: 'DP07', name: 'Delivery nation', category: 'ERP', categoryLabel: 'ERP · sales and SKU data', ukStatus: 'held', dkStatus: 'held' },
    { id: 'DP08', name: 'Exports out of the country', category: 'ERP', categoryLabel: 'ERP · sales and SKU data', ukStatus: 'held', dkStatus: 'held' },
    { id: 'DP09', name: 'Import country of origin', category: 'ERP', categoryLabel: 'ERP · sales and SKU data', ukStatus: 'held', dkStatus: 'held' },
    { id: 'DP10', name: 'Supplier per component', category: 'ERP', categoryLabel: 'ERP · sales and SKU data', ukStatus: 'held', dkStatus: 'held' },

    // Group 2: PLM · packaging specifications (7 items)
    { id: 'DP11', name: 'Packaging level', category: 'PLM', categoryLabel: 'PLM · packaging specifications', ukStatus: 'held', dkStatus: 'held' },
    { id: 'DP12', name: 'Component material', category: 'PLM', categoryLabel: 'PLM · packaging specifications', ukStatus: 'held', dkStatus: 'held' },
    { id: 'DP13', name: 'Component weight (empty)', category: 'PLM', categoryLabel: 'PLM · packaging specifications', ukStatus: 'held', dkStatus: 'held' },
    { id: 'DP14', name: 'Reusable or single-use', category: 'PLM', categoryLabel: 'PLM · packaging specifications', ukStatus: 'held', dkStatus: 'held' },
    { id: 'DP15', name: 'Food-contact packaging', category: 'PLM', categoryLabel: 'PLM · packaging specifications', ukStatus: 'held', dkStatus: 'held' },
    { id: 'DP16', name: 'Minimisation evidence', category: 'PLM', categoryLabel: 'PLM · packaging specifications', ukStatus: 'na', dkStatus: 'collect' },
    { id: 'DP17', name: 'Weight source and sampling', category: 'PLM', categoryLabel: 'PLM · packaging specifications', ukStatus: 'collect', dkStatus: 'collect' },

    // Group 3: Compliance team · manual entries (9 items)
    { id: 'DP18', name: 'Deposit scheme status', category: 'COMPLIANCE', categoryLabel: 'Compliance team · manual entries', ukStatus: 'held', dkStatus: 'held' },
    { id: 'DP19', name: 'Producer role', category: 'COMPLIANCE', categoryLabel: 'Compliance team · manual entries', ukStatus: 'held', dkStatus: 'held' },
    { id: 'DP20', name: 'EPR registration number', category: 'COMPLIANCE', categoryLabel: 'Compliance team · manual entries', ukStatus: 'held', dkStatus: 'held' },
    { id: 'DP21', name: 'Compliance scheme membership', category: 'COMPLIANCE', categoryLabel: 'Compliance team · manual entries', ukStatus: 'held', dkStatus: 'held' },
    { id: 'DP22', name: 'Authorised representative', category: 'COMPLIANCE', categoryLabel: 'Compliance team · manual entries', ukStatus: 'held', dkStatus: 'held' },
    { id: 'DP23', name: 'Organisation size and threshold', category: 'COMPLIANCE', categoryLabel: 'Compliance team · manual entries', ukStatus: 'held', dkStatus: 'held' },
    { id: 'DP24', name: 'Reporting period', category: 'COMPLIANCE', categoryLabel: 'Compliance team · manual entries', ukStatus: 'held', dkStatus: 'held' },
    { id: 'DP25', name: 'DoC reference and version', category: 'COMPLIANCE', categoryLabel: 'Compliance team · manual entries', ukStatus: 'na', dkStatus: 'held' },
    { id: 'DP26', name: 'Sign-off owner', category: 'COMPLIANCE', categoryLabel: 'Compliance team · manual entries', ukStatus: 'held', dkStatus: 'held' },

    // Group 4: Supplier data · Monk Spaces collects (11 items)
    { id: 'DP27', name: 'Polymer type', category: 'SUPPLIER', categoryLabel: 'Supplier data · Monk Spaces collects', ukStatus: 'collect', dkStatus: 'collect' },
    { id: 'DP28', name: 'Multi-material split', category: 'SUPPLIER', categoryLabel: 'Supplier data · Monk Spaces collects', ukStatus: 'collect', dkStatus: 'collect' },
    { id: 'DP29', name: 'Colour and opacity', category: 'SUPPLIER', categoryLabel: 'Supplier data · Monk Spaces collects', ukStatus: 'collect', dkStatus: 'collect' },
    { id: 'DP30', name: 'Additives, inks and adhesives', category: 'SUPPLIER', categoryLabel: 'Supplier data · Monk Spaces collects', ukStatus: 'collect', dkStatus: 'collect' },
    { id: 'DP31', name: 'Recyclability result', category: 'SUPPLIER', categoryLabel: 'Supplier data · Monk Spaces collects', ukStatus: 'collect', dkStatus: 'collect' },
    { id: 'DP32', name: 'Recycled content %', category: 'SUPPLIER', categoryLabel: 'Supplier data · Monk Spaces collects', ukStatus: 'collect', dkStatus: 'collect' },
    { id: 'DP33', name: 'Recycled content certificate', category: 'SUPPLIER', categoryLabel: 'Supplier data · Monk Spaces collects', ukStatus: 'collect', dkStatus: 'collect' },
    { id: 'DP34', name: 'PFAS declaration', category: 'SUPPLIER', categoryLabel: 'Supplier data · Monk Spaces collects', ukStatus: 'na', dkStatus: 'collect' },
    { id: 'DP35', name: 'Heavy metals', category: 'SUPPLIER', categoryLabel: 'Supplier data · Monk Spaces collects', ukStatus: 'na', dkStatus: 'collect' },
    { id: 'DP36', name: 'Substances of concern', category: 'SUPPLIER', categoryLabel: 'Supplier data · Monk Spaces collects', ukStatus: 'na', dkStatus: 'collect' },
    { id: 'DP37', name: 'Technical file references', category: 'SUPPLIER', categoryLabel: 'Supplier data · Monk Spaces collects', ukStatus: 'collect', dkStatus: 'collect' },
  ]);

  // Dynamic calculations for UK data point coverage
  readonly ukStats = computed(() => {
    const list = this.dataPoints();
    const needed = list.filter(dp => dp.ukStatus !== 'na');
    const held = needed.filter(dp => dp.ukStatus === 'held');
    const collect = needed.filter(dp => dp.ukStatus === 'collect');
    const pct = needed.length > 0 ? (held.length / needed.length) * 100 : 0;
    return {
      total: needed.length,
      held: held.length,
      collect: collect.length,
      percentage: pct.toFixed(1),
    };
  });

  // Dynamic calculations for Denmark + PPWR data point coverage
  readonly dkStats = computed(() => {
    const list = this.dataPoints();
    const needed = list.filter(dp => dp.dkStatus !== 'na');
    const held = needed.filter(dp => dp.dkStatus === 'held');
    const collect = needed.filter(dp => dp.dkStatus === 'collect');
    const pct = needed.length > 0 ? (held.length / needed.length) * 100 : 0;
    return {
      total: needed.length,
      held: held.length,
      collect: collect.length,
      percentage: pct.toFixed(1),
    };
  });

  // Selected markets count
  readonly selectedMarketsCount = computed(() => {
    const col1 = this.marketsCol1().filter(m => m.selected).length;
    const col2 = this.marketsCol2().filter(m => m.selected).length;
    return col1 + col2;
  });

  // Form Controls
  readonly profileForm: FormGroup = this.fb.group({
    companyName: ['The Kraft Heinz Company Europe', [Validators.required, Validators.minLength(3)]],
    legalEntityName: ['Kraft Heinz UK', [Validators.required]],
    tenantSlug: ['khc-europe', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    sector: ['food_beverage', [Validators.required]],
    organisationSize: ['L', [Validators.required]],
    rpdOrganisationId: ['100004'],
    primaryCurrency: ['EUR', [Validators.required]],
    producerRole: ['BRAND_OWNER', [Validators.required]],
    fillerRole: ['UK_FILLER'],
  });

  ngOnInit(): void {
    this.loadBackendMasters();
  }

  loadBackendMasters(): void {
    this.configService.getSectors().subscribe({
      next: (sectors) => {
        if (sectors && sectors.length > 0) {
          this.backendSectors.set(sectors);
        }
      },
      error: (err) => console.warn('Could not fetch backend sectors:', err),
    });

    this.configService.getCountries().subscribe({
      next: (countries) => {
        if (countries && countries.length > 0) {
          this.backendCountries.set(countries);
        }
      },
      error: (err) => console.warn('Could not fetch backend countries:', err),
    });
  }

  // Toggle market selection
  toggleMarket(countryCode: string): void {
    this.marketsCol1.update(list =>
      list.map(m => m.countryCode === countryCode ? { ...m, selected: !m.selected } : m)
    );
    this.marketsCol2.update(list =>
      list.map(m => m.countryCode === countryCode ? { ...m, selected: !m.selected } : m)
    );
  }

  // Toggle data point held status between 'held' and 'collect'
  toggleDataPointUk(id: string): void {
    this.dataPoints.update(list =>
      list.map(dp => {
        if (dp.id === id && dp.ukStatus !== 'na') {
          return { ...dp, ukStatus: dp.ukStatus === 'held' ? 'collect' : 'held' };
        }
        return dp;
      })
    );
  }

  toggleDataPointDk(id: string): void {
    this.dataPoints.update(list =>
      list.map(dp => {
        if (dp.id === id && dp.dkStatus !== 'na') {
          return { ...dp, dkStatus: dp.dkStatus === 'held' ? 'collect' : 'held' };
        }
        return dp;
      })
    );
  }

  // Step navigation
  goToStep(step: number): void {
    if (step >= 1 && step <= 4) {
      this.currentStep.set(step);
    }
  }

  nextStep(): void {
    if (this.currentStep() < 4) {
      this.currentStep.update(s => s + 1);
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
    }
  }

  // Finish setup and save workspace
  finishSetup(): void {
    this.submitting.set(true);
    const formVals = this.profileForm.value;

    const allMarkets: TenantMarketSelection[] = [
      ...this.marketsCol1().filter(m => m.selected).map(m => ({
        countryCode: m.countryCode,
        countryName: m.countryName,
        regulationCode: m.regulationCode,
        regulationName: m.regulationLabel,
        mandatory: m.countryCode === 'UK',
        selected: true,
        producerRole: 'BRAND_OWNER' as const,
        reason: 'Required EPR jurisdiction',
        flagEmoji: '',
      })),
      ...this.marketsCol2().filter(m => m.selected).map(m => ({
        countryCode: m.countryCode,
        countryName: m.countryName,
        regulationCode: m.regulationCode,
        regulationName: m.regulationLabel,
        mandatory: false,
        selected: true,
        producerRole: 'BRAND_OWNER' as const,
        reason: 'Required EPR jurisdiction',
        flagEmoji: '',
      })),
    ];

    const profile: ClientWorkspaceProfile = {
      id: formVals.tenantSlug,
      name: formVals.companyName,
      sector: formVals.sector,
      productCategories: ['Soups & Sauces', 'Condiments', 'Beans & Meals'],
      organisationSize: formVals.organisationSize,
      rpdOrganisationId: formVals.rpdOrganisationId,
      primaryCurrency: formVals.primaryCurrency,
      markets: allMarkets,
      integrations: this.config.options.availableIntegrations,
      consultantEmail: 'compliance.officer@kraftheinz.com',
    };

    this.tenantService.createTenantWorkspace(profile).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitSuccess.set(true);
      },
      error: () => {
        // Fallback for offline/demo: mark success in local state
        this.tenantService.setActiveTenant(profile.id);
        this.submitting.set(false);
        this.submitSuccess.set(true);
      },
    });
  }

  navigateToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
