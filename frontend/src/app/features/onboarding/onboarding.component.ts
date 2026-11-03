import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { APP_CONFIG } from '../../core/config/client-theme.config';
import { TenantApiService } from '../../core/services/tenant-api.service';
import { ConfigApiService } from '../../core/services/config-api.service';
import { ClientWorkspaceProfile, TenantMarketSelection } from '../../core/models/tenant.model';

export interface MarketOption {
  countryCode: string;
  countryName: string;
  regulationLabel: string;
  selected: boolean;
}

export interface LawRule {
  countryCode: string;
  countryName: string;
  lawName: string;
  description: string;
}

export interface BrandThemeOption {
  id: string;
  name: string;
  colorHex: string;
  description: string;
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

  // Wizard steps: 1 = Company & Branding, 2 = Markets & Laws, 3 = Data Journey Flowchart, 4 = Connect Systems
  readonly currentStep = signal<number>(1);
  readonly submitting = signal<boolean>(false);

  readonly stepTitle = computed(() => {
    switch (this.currentStep()) {
      case 1: return 'Client Workspace Setup · Identity & Branding';
      case 2: return 'Regulatory Scope · Markets & Jurisdictions';
      case 3: return 'Compliance Data Journey & Flowchart';
      case 4: return 'System Connections & Provisioning';
      default: return 'Client Workspace Setup';
    }
  });

  readonly stepSubtitle = computed(() => {
    switch (this.currentStep()) {
      case 1: return 'Set client legal entity, custom logo, and branded theme';
      case 2: return 'Select target sales markets to activate EPR & PPWR rule libraries';
      case 3: return 'Overview of required data points flowing from Snowflake, PLM, and suppliers';
      case 4: return 'Connect once — continuous automated normalization with zero manual templates';
      default: return '';
    }
  });

  // Pre-configured brand accent themes for SuperAdmin
  readonly brandThemes: BrandThemeOption[] = [
    { id: 'monochrome', name: 'Swiss Obsidian', colorHex: '#111827', description: 'Monochrome high-contrast enterprise theme' },
    { id: 'khc-red', name: 'Heritage Red', colorHex: '#C41230', description: 'Kraft Heinz signature corporate crimson' },
    { id: 'nordic-navy', name: 'Nordic Navy', colorHex: '#1E3A8A', description: 'Deep Scandinavian cobalt' },
    { id: 'forest-emerald', name: 'Forest Emerald', colorHex: '#065F46', description: 'Sustainable packaging dark green' },
  ];

  // Canonical regulatory rules library
  readonly allLawRules: LawRule[] = [
    { countryCode: 'UK', countryName: 'United Kingdom', lawName: 'UK pEPR (Defra RPD 2026)', description: 'Brand owner, turnover >£2m and >50 tonnes packaging: mandatory filing' },
    { countryCode: 'DK', countryName: 'Denmark', lawName: 'Dansk Producent Ansvar (DPA)', description: 'Mandatory producer responsibility scheme active since 2025' },
    { countryCode: 'DK', countryName: 'Denmark', lawName: 'EU PPWR (Article 6)', description: 'Packaging and Packaging Waste Regulation recyclability grades & DoC' },
    { countryCode: 'FR', countryName: 'France', lawName: 'French CITEO EPR', description: 'Mandatory packaging declaration, Info-tri sorting logo & Triman marking' },
    { countryCode: 'DE', countryName: 'Germany', lawName: 'German VerpackG (LUCID)', description: 'ZSVR LUCID registration and dual system participation' },
    { countryCode: 'ES', countryName: 'Spain', lawName: 'Spanish RD 1055/2022', description: 'National packaging register & non-recycled plastic tax (€0.45/kg)' },
  ];

  // Markets in scope (split into 2 columns)
  readonly marketsCol1 = signal<MarketOption[]>([
    { countryCode: 'UK', countryName: 'United Kingdom', regulationLabel: 'UK pEPR', selected: true },
    { countryCode: 'FR', countryName: 'France', regulationLabel: 'CITEO', selected: false },
    { countryCode: 'DE', countryName: 'Germany', regulationLabel: 'LUCID', selected: false },
  ]);

  readonly marketsCol2 = signal<MarketOption[]>([
    { countryCode: 'DK', countryName: 'Denmark', regulationLabel: 'DPA + PRO', selected: true },
    { countryCode: 'ES', countryName: 'Spain', regulationLabel: 'RD 1055', selected: false },
    { countryCode: 'IT', countryName: 'Italy', regulationLabel: 'CONAI', selected: false },
  ]);

  // Form Controls for Step 1
  readonly profileForm: FormGroup = this.fb.group({
    companyName: ['The Kraft Heinz Company Europe', [Validators.required, Validators.minLength(3)]],
    legalEntityName: ['Kraft Heinz UK Limited', [Validators.required]],
    tenantSlug: ['khc-europe', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    sector: ['Food & beverage / FMCG', [Validators.required]],
    organisationSize: ['L', [Validators.required]],
    rpdOrganisationId: ['100004'],
    primaryCurrency: ['EUR', [Validators.required]],
    logoPreset: ['khc'],
    customLogoUrl: [''],
    themeColor: ['#111827'],
  });

  readonly selectedMarketsCount = computed(() => {
    const col1 = this.marketsCol1().filter(m => m.selected).length;
    const col2 = this.marketsCol2().filter(m => m.selected).length;
    return col1 + col2;
  });

  readonly activeLaws = computed(() => {
    const selectedCodes = new Set([
      ...this.marketsCol1().filter(m => m.selected).map(m => m.countryCode),
      ...this.marketsCol2().filter(m => m.selected).map(m => m.countryCode),
    ]);
    return this.allLawRules.filter(r => selectedCodes.has(r.countryCode));
  });

  ngOnInit(): void {}

  // Quick preset loader for SuperAdmin
  loadPreset(preset: 'khc' | 'nordhavn' | 'custom'): void {
    if (preset === 'khc') {
      this.profileForm.patchValue({
        companyName: 'The Kraft Heinz Company Europe',
        legalEntityName: 'Kraft Heinz UK Limited',
        tenantSlug: 'khc-europe',
        sector: 'Food & beverage / FMCG',
        organisationSize: 'L',
        rpdOrganisationId: '100004',
        primaryCurrency: 'EUR',
        logoPreset: 'khc',
        themeColor: '#C41230',
      });
      this.setMarketSelected('UK', true);
      this.setMarketSelected('DK', true);
      this.setMarketSelected('FR', false);
      this.setMarketSelected('DE', false);
    } else if (preset === 'nordhavn') {
      this.profileForm.patchValue({
        companyName: 'Nordhavn Spirits ApS',
        legalEntityName: 'Nordhavn Spirits Denmark',
        tenantSlug: 'nordhavn-spirits',
        sector: 'Spirits & beverages',
        organisationSize: 'L',
        rpdOrganisationId: 'DPA-000001',
        primaryCurrency: 'DKK',
        logoPreset: 'nordhavn',
        themeColor: '#1E3A8A',
      });
      this.setMarketSelected('DK', true);
      this.setMarketSelected('UK', false);
      this.setMarketSelected('DE', true);
    } else {
      this.profileForm.reset({
        companyName: '',
        legalEntityName: '',
        tenantSlug: '',
        sector: 'Food & beverage / FMCG',
        organisationSize: 'L',
        rpdOrganisationId: '',
        primaryCurrency: 'EUR',
        logoPreset: 'custom',
        customLogoUrl: '',
        themeColor: '#111827',
      });
    }
  }

  setMarketSelected(countryCode: string, selected: boolean): void {
    this.marketsCol1.update(list =>
      list.map(m => (m.countryCode === countryCode ? { ...m, selected } : m))
    );
    this.marketsCol2.update(list =>
      list.map(m => (m.countryCode === countryCode ? { ...m, selected } : m))
    );
  }

  toggleMarket(countryCode: string): void {
    this.marketsCol1.update(list =>
      list.map(m => (m.countryCode === countryCode ? { ...m, selected: !m.selected } : m))
    );
    this.marketsCol2.update(list =>
      list.map(m => (m.countryCode === countryCode ? { ...m, selected: !m.selected } : m))
    );
  }

  goToStep(step: number): void {
    if (step >= 1 && step <= 4) {
      this.currentStep.set(step);
    }
  }

  finishSetup(): void {
    this.submitting.set(true);
    const formVals = this.profileForm.value;

    const allMarkets: TenantMarketSelection[] = [
      ...this.marketsCol1().filter(m => m.selected).map(m => ({
        countryCode: m.countryCode,
        countryName: m.countryName,
        regulationCode: m.countryCode === 'UK' ? 'UK_PEPR' : m.countryCode,
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
        regulationCode: m.countryCode === 'DK' ? 'DK_DPA' : m.countryCode,
        regulationName: m.regulationLabel,
        mandatory: false,
        selected: true,
        producerRole: 'BRAND_OWNER' as const,
        reason: 'Required EPR jurisdiction',
        flagEmoji: '',
      })),
    ];

    const selectedJurisdictions = allMarkets.map(m => m.countryCode);

    const payload = {
      id: formVals.tenantSlug || 'khc-europe',
      name: formVals.companyName || 'The Kraft Heinz Company Europe',
      sector: formVals.sector || 'Food & beverage / FMCG',
      organisationSize: 'L' as const,
      rpdOrganisationId: formVals.rpdOrganisationId || '100004',
      primaryCurrency: formVals.primaryCurrency || 'EUR',
      activeJurisdictions: selectedJurisdictions,
      tier: 'enterprise',
      logoUrl: formVals.customLogoUrl || formVals.logoPreset,
      themeColor: formVals.themeColor || '#111827',
      adminEmail: 'compliance.officer@kraftheinz.com',
      adminName: 'Kraft Heinz Compliance Officer',
      adminPassword: 'password123',
    };

    // Save directly to PostgreSQL database via tenantService
    this.tenantService.createTenantWorkspace(payload).subscribe({
      next: () => {
        this.tenantService.setActiveTenant(payload.id);
        this.submitting.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.tenantService.setActiveTenant(payload.id);
        this.submitting.set(false);
        this.router.navigate(['/dashboard']);
      },
    });
  }
}
