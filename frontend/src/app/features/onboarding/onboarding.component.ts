import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { APP_CONFIG } from '../../core/config/client-theme.config';
import { TenantApiService } from '../../core/services/tenant-api.service';
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
export class OnboardingComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly tenantService = inject(TenantApiService);

  // Single Source of Truth Configuration
  readonly config = APP_CONFIG;

  // Wizard State
  readonly currentStep = signal<number>(1);
  readonly submitting = signal<boolean>(false);
  readonly submitSuccess = signal<boolean>(false);

  readonly steps: WizardStep[] = [
    { number: 1, title: 'Company Profile', subtitle: 'Legal entity & size' },
    { number: 2, title: 'Categories', subtitle: 'Sectors & products' },
    { number: 3, title: 'Markets & Laws', subtitle: 'EPR jurisdictions' },
    { number: 4, title: 'Connect Sources', subtitle: 'PLM, ERP & Excel' },
    { number: 5, title: 'Review & Launch', subtitle: 'Confirm workspace' },
  ];

  // Markets & Integrations state initialized from Single Point Config
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
    consultantEmail: ['consultant@monkspaces.com', [Validators.required, Validators.email]],
    newCategoryInput: [''],
  });

  // Navigation handlers
  goToStep(step: number): void {
    if (step < this.currentStep() || this.isStepValid(this.currentStep())) {
      this.currentStep.set(step);
    }
  }

  nextStep(): void {
    if (this.currentStep() < this.steps.length) {
      this.currentStep.update(s => s + 1);
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
    } else {
      this.profileForm.patchValue({
        companyName: 'Aurora Packaging Group',
        tenantSlug: 'aurora-pack',
        sector: 'personal_care',
        organisationSize: 'S',
        rpdOrganisationId: '100092',
        primaryCurrency: 'GBP',
        producerRole: 'PACKER_FILLER',
      });
      this.selectedCategories.set(['Skincare & Lotions', 'Haircare']);
    }
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
