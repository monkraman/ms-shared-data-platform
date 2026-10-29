import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { APP_CONFIG } from '../../core/config/client-theme.config';
import { TenantApiService } from '../../core/services/tenant-api.service';
import { ConfigApiService, SectorConfig, CountryConfig, ComplianceMatrixResponse } from '../../core/services/config-api.service';
import { ClientWorkspaceProfile, TenantMarketSelection, TenantIntegrationConfig } from '../../core/models/tenant.model';
import { StepIndicatorComponent, WizardStep } from '../../shared/components/step-indicator/step-indicator.component';
import { CheckboxCardComponent } from '../../shared/components/checkbox-card/checkbox-card.component';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    StepIndicatorComponent,
    CheckboxCardComponent,
  ],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.css',
})
export class OnboardingComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly tenantService = inject(TenantApiService);
  readonly configService = inject(ConfigApiService);

  // Single Source of Truth Configuration
  readonly config = APP_CONFIG;

  // Wizard State
  readonly currentStep = signal<number>(1);
  readonly submitting = signal<boolean>(false);
  readonly submitSuccess = signal<boolean>(false);

  // Backend Configurable Options
  readonly backendSectors = signal<SectorConfig[]>([]);
  readonly backendCountries = signal<CountryConfig[]>([]);
  readonly complianceMatrix = signal<ComplianceMatrixResponse | null>(null);
  readonly isLoadingConfig = signal<boolean>(false);

  readonly steps: WizardStep[] = [
    { number: 1, title: 'Company Profile', subtitle: 'Legal entity & size' },
    { number: 2, title: 'Categories', subtitle: 'Sectors & products' },
    { number: 3, title: 'Markets & Laws', subtitle: 'EPR jurisdictions' },
    { number: 4, title: 'Connect Sources', subtitle: 'PLM, ERP & Excel' },
    { number: 5, title: 'Review & Launch', subtitle: 'Confirm workspace' },
  ];

  // Markets & Integrations state
  readonly markets = signal<TenantMarketSelection[]>(
    JSON.parse(JSON.stringify(this.config.options.availableMarkets))
  );

  readonly integrations = signal<TenantIntegrationConfig[]>(
    JSON.parse(JSON.stringify(this.config.options.availableIntegrations))
  );

  readonly selectedCategories = signal<string[]>([
    'Soups & Sauces',
    'Condiments',
  ]);

  // Typed Reactive Form
  readonly profileForm: FormGroup = this.fb.group({
    companyName: ['The Kraft Heinz Company Europe', [Validators.required, Validators.minLength(3)]],
    tenantSlug: ['khc-europe', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    sector: ['food_beverage', [Validators.required]],
    organisationSize: ['L', [Validators.required]],
    rpdOrganisationId: ['100004', [Validators.pattern(/^[0-9]+$/)]],
    primaryCurrency: ['EUR', [Validators.required]],
    producerRole: ['BRAND_OWNER', [Validators.required]],
    consultantEmail: ['consultant@compliancehub.io', [Validators.required, Validators.email]],
    newCategoryInput: [''],
  });

  ngOnInit(): void {
    this.loadBackendConfig();
  }

  loadBackendConfig(): void {
    this.isLoadingConfig.set(true);
    this.configService.getSectors().subscribe({
      next: (sectors) => {
        if (sectors && sectors.length > 0) {
          this.backendSectors.set(sectors);
        }
      },
      error: (err) => console.warn('Could not fetch backend sectors, using fallbacks', err),
    });

    this.configService.getCountries().subscribe({
      next: (countries) => {
        if (countries && countries.length > 0) {
          this.backendCountries.set(countries);
          // Sync available markets with backend countries
          const syncedMarkets: TenantMarketSelection[] = countries.map(c => {
            const existing = this.markets().find(m => m.countryCode === c.country_code);
            return {
              countryCode: c.country_code,
              countryName: c.country_name,
              regulationCode: c.regulations.join(' + '),
              regulationName: c.regulations.includes('UK_PEPR') ? 'UK Extended Producer Responsibility (Defra RPD)' :
                c.regulations.includes('DE_VERPACKG') ? 'German VerpackG (LUCID) & Dual System' :
                c.regulations.includes('FR_CITEO') ? 'French Citeo / AGEC Household EPR' :
                c.regulations.includes('DK_DPA') ? 'Danish Producer Responsibility (DPA / VANA)' :
                c.regulations.includes('ES_RD1055') ? 'Spanish RD 1055/2022 & Plastic Tax' :
                c.regulations.includes('IT_CONAI') ? 'Italian CONAI Environmental Contribution' :
                c.regulations.includes('NL_AFVALFONDS') ? 'Dutch Afvalfonds Verpakkingen' :
                `${c.country_name} Producer Responsibility`,
              mandatory: c.country_code === 'UK',
              selected: existing ? existing.selected : (c.country_code === 'UK' || c.country_code === 'DK'),
              producerRole: 'BRAND_OWNER',
              reason: `${c.data_points_required_count} required canonical data points (DP01-DP45)`,
              flagEmoji: '',
            };
          });
          this.markets.set(syncedMarkets);
          this.updateComplianceMatrix();
        }
        this.isLoadingConfig.set(false);
      },
      error: (err) => {
        console.warn('Could not fetch backend countries, using fallbacks', err);
        this.isLoadingConfig.set(false);
      },
    });
  }

  updateComplianceMatrix(): void {
    const selectedCountries = this.markets().filter(m => m.selected).map(m => m.countryCode);
    const sector = this.profileForm.get('sector')?.value || 'food_beverage';
    if (selectedCountries.length > 0) {
      this.configService.calculateMatrix([sector], selectedCountries).subscribe({
        next: (matrix) => this.complianceMatrix.set(matrix),
        error: (err) => console.warn('Compliance matrix error:', err),
      });
    }
  }

  // Navigation handlers
  goToStep(step: number): void {
    if (step < this.currentStep() || this.isStepValid(this.currentStep())) {
      this.currentStep.set(step);
      if (step === 3 || step === 5) {
        this.updateComplianceMatrix();
      }
    }
  }

  nextStep(): void {
    if (this.currentStep() < this.steps.length) {
      this.currentStep.update(s => s + 1);
      if (this.currentStep() === 3 || this.currentStep() === 5) {
        this.updateComplianceMatrix();
      }
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
    }
  }

  isStepValid(step: number): boolean {
    if (step === 1) {
      return (
        this.profileForm.get('companyName')?.valid === true &&
        this.profileForm.get('tenantSlug')?.valid === true
      );
    }
    if (step === 3) {
      return this.markets().some(m => m.selected);
    }
    return true;
  }

  toggleMarket(countryCode: string): void {
    this.markets.update(list =>
      list.map(m => m.countryCode === countryCode ? { ...m, selected: !m.selected } : m)
    );
    this.updateComplianceMatrix();
  }

  toggleIntegration(id: string): void {
    this.integrations.update(list =>
      list.map(i => i.id === id ? { ...i, selected: !i.selected } : i)
    );
  }

  toggleCategory(cat: string): void {
    this.selectedCategories.update(list =>
      list.includes(cat) ? list.filter(c => c !== cat) : [...list, cat]
    );
  }

  addCustomCategory(): void {
    const val = this.profileForm.get('newCategoryInput')?.value?.trim();
    if (val && !this.selectedCategories().includes(val)) {
      this.selectedCategories.update(list => [...list, val]);
      this.profileForm.patchValue({ newCategoryInput: '' });
    }
  }

  // Pre-fill quick demo presets (e.g. Kraft Heinz vs Aurora Packaging)
  applyPreset(preset: 'khc' | 'aurora'): void {
    if (preset === 'khc') {
      this.profileForm.patchValue({
        companyName: 'The Kraft Heinz Company Europe',
        tenantSlug: 'khc-europe',
        sector: 'food_beverage',
        organisationSize: 'L',
        rpdOrganisationId: '100004',
        primaryCurrency: 'EUR',
        producerRole: 'BRAND_OWNER',
      });
      this.selectedCategories.set(['Soups & Sauces', 'Condiments']);
      this.markets.update(list => list.map(m => ({
        ...m,
        selected: m.countryCode === 'UK' || m.countryCode === 'DK' || m.countryCode === 'FR',
      })));
    } else {
      this.profileForm.patchValue({
        companyName: 'Aurora Packaging Group',
        tenantSlug: 'aurora-pack',
        sector: 'cosmetics_personal_care',
        organisationSize: 'S',
        rpdOrganisationId: '100092',
        primaryCurrency: 'GBP',
        producerRole: 'PACKER_FILLER',
      });
      this.selectedCategories.set(['Skincare & Lotions', 'Haircare']);
      this.markets.update(list => list.map(m => ({
        ...m,
        selected: m.countryCode === 'UK' || m.countryCode === 'DE',
      })));
    }
    this.updateComplianceMatrix();
  }

  // Submit and create workspace
  onSubmit(): void {
    if (this.profileForm.invalid) return;

    this.submitting.set(true);
    const formVals = this.profileForm.value;

    const profile: ClientWorkspaceProfile = {
      id: formVals.tenantSlug,
      name: formVals.companyName,
      sector: formVals.sector,
      productCategories: this.selectedCategories(),
      organisationSize: formVals.organisationSize,
      rpdOrganisationId: formVals.rpdOrganisationId,
      primaryCurrency: formVals.primaryCurrency,
      markets: this.markets(),
      integrations: this.integrations(),
      consultantEmail: formVals.consultantEmail,
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
