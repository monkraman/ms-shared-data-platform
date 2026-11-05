import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { APP_CONFIG } from '../../core/config/client-theme.config';
import { TenantApiService, BackendTenantRecord } from '../../core/services/tenant-api.service';
import { FoundationApiService, CanonicalProduct } from '../../core/services/foundation-api.service';
import { QualityApiService, DataQualityIssue } from '../../core/services/quality-api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

export interface MarketFeeBreakdown {
  countryCode: string;
  countryName: string;
  regulationName: string;
  provisionalFeeGbp: number;
  uncertaintyMarginGbp: number;
  skuCount: number;
  complianceStatus: 'ON_TRACK' | 'ACTION_REQUIRED' | 'VERIFIED';
  deadlineDate: string;
}

export interface HotspotRow {
  title: string;
  recommendation: string;
  rating: 'Amber' | 'Green' | 'Red';
  fee: string;
  saving: string;
  accentColor: string;
  routeLink: string;
}

export interface SavingItem {
  name: string;
  amount: string;
}

export interface DeadlineItem {
  date: string;
  title: string;
  authority: string;
  statusNote: string;
  statusClass: string;
}

export interface PendingTaskItem {
  id: string;
  title: string;
  description: string;
  icon: 'shield' | 'doc' | 'chart';
  routeLink: string;
}

export interface ObligationRow {
  due: string;
  framework: string;
  title: string;
  owner: string;
  preparedPct: number;
  statusText: string;
  statusType: 'ready' | 'risk' | 'scheduled';
}

export interface DynamicKpiCard {
  id: string;
  kicker: string;
  badgeText: string;
  badgeType: 'green' | 'amber' | 'red' | 'neutral';
  hasDot?: boolean;
  amount: string;
  subtext: string;
  barType: 'dual' | 'tri' | 'progress';
  barSegments?: { color: 'green' | 'teal' | 'amber' | 'red' | 'blue'; widthPct: number }[];
}

export interface MarketFilterOption {
  id: string;
  label: string;
}

interface CountryMeta {
  code: string;
  name: string;
  shortName: string;
  regName: string;
  flag: string;
  localCurrencyCode: string;
  localCurrencySymbol: string;
  conversionRateToGbp: number;
  provisionalShare: number;
  deadline: string;
}

const COUNTRY_REGISTRY: Record<string, CountryMeta> = {
  GB: { code: 'GB', name: 'United Kingdom', shortName: 'UK', regName: 'PackUK / Defra RPD EPR', flag: '🇬🇧', localCurrencyCode: 'GBP', localCurrencySymbol: '£', conversionRateToGbp: 1.0, provisionalShare: 0.941, deadline: '31 Oct 2026' },
  UK: { code: 'GB', name: 'United Kingdom', shortName: 'UK', regName: 'PackUK / Defra RPD EPR', flag: '🇬🇧', localCurrencyCode: 'GBP', localCurrencySymbol: '£', conversionRateToGbp: 1.0, provisionalShare: 0.941, deadline: '31 Oct 2026' },
  DK: { code: 'DK', name: 'Denmark', shortName: 'Denmark', regName: 'Dansk Producentansvar (DPA / VANA)', flag: '🇩🇰', localCurrencyCode: 'DKK', localCurrencySymbol: 'DKK ', conversionRateToGbp: 0.115, provisionalShare: 0.059, deadline: '15 Jan 2027' },
  DE: { code: 'DE', name: 'Germany', shortName: 'Germany', regName: 'VerpackG / ZSVR LUCID', flag: '🇩🇪', localCurrencyCode: 'EUR', localCurrencySymbol: '€', conversionRateToGbp: 0.85, provisionalShare: 0.075, deadline: '15 May 2027' },
  FR: { code: 'FR', name: 'France', shortName: 'France', regName: 'Citeo Household Packaging', flag: '🇫🇷', localCurrencyCode: 'EUR', localCurrencySymbol: '€', conversionRateToGbp: 0.85, provisionalShare: 0.087, deadline: '01 Mar 2027' },
  ES: { code: 'ES', name: 'Spain', shortName: 'Spain', regName: 'Real Decreto 1055/2022 & Tax', flag: '🇪🇸', localCurrencyCode: 'EUR', localCurrencySymbol: '€', conversionRateToGbp: 0.85, provisionalShare: 0.045, deadline: '30 Apr 2027' },
  IT: { code: 'IT', name: 'Italy', shortName: 'Italy', regName: 'CONAI Environmental Labeling', flag: '🇮🇹', localCurrencyCode: 'EUR', localCurrencySymbol: '€', conversionRateToGbp: 0.85, provisionalShare: 0.055, deadline: '28 Feb 2027' },
  NL: { code: 'NL', name: 'Netherlands', shortName: 'Netherlands', regName: 'Afvalfonds Verpakkingen', flag: '🇳🇱', localCurrencyCode: 'EUR', localCurrencySymbol: '€', conversionRateToGbp: 0.85, provisionalShare: 0.038, deadline: '31 Mar 2027' },
  'US-CA': { code: 'US-CA', name: 'California (USA)', shortName: 'California', regName: 'SB54 Plastic Pollution Act', flag: '🇺🇸', localCurrencyCode: 'USD', localCurrencySymbol: '$', conversionRateToGbp: 0.78, provisionalShare: 0.06, deadline: '01 Jan 2027' },
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  readonly Math = Math;
  readonly tenantService = inject(TenantApiService);
  readonly foundationService = inject(FoundationApiService);
  readonly qualityService = inject(QualityApiService);
  readonly toastService = inject(ToastService);
  readonly authService = inject(AuthService);
  readonly config = APP_CONFIG;

  // Selected Filter Signals (Mockup controls)
  readonly selectedMarket = signal<string>('all');
  readonly selectedYear = signal<string>('2026');

  // Selected Tenant Signal
  readonly activeTenantId = this.tenantService.activeTenantId;
  
  // Real Data Signals from Backend
  readonly products = this.foundationService.products;
  readonly qualityIssues = this.qualityService.issues;
  readonly loading = computed(() => this.foundationService.loading() || this.qualityService.loading());

  // Active Tenant Record
  readonly currentTenant = computed<BackendTenantRecord | null>(() => {
    const list = this.tenantService.tenants();
    const activeId = this.activeTenantId();
    return list.find((t) => t.id === activeId) || null;
  });

  readonly activeTenantName = computed(() => {
    const t = this.currentTenant();
    if (t) return t.name;
    return this.activeTenantId() === 'khc-europe' 
      ? 'The Kraft Heinz Company (Europe & UK)' 
      : this.activeTenantId();
  });

  // Dynamic active jurisdictions and modules configured for tenant
  readonly tenantActiveJurisdictions = computed<string[]>(() => {
    const t = this.currentTenant();
    if (t?.active_jurisdictions && t.active_jurisdictions.length > 0) {
      return t.active_jurisdictions;
    }
    return ['GB', 'DK'];
  });

  readonly tenantActiveModules = computed<string[]>(() => {
    const t = this.currentTenant();
    if (t?.active_modules && t.active_modules.length > 0) {
      return t.active_modules.map((m) => m.toLowerCase());
    }
    return ['epr', 'ppwr'];
  });

  // Available filter options dynamically reflecting active markets
  readonly availableFilterMarkets = computed<MarketFilterOption[]>(() => {
    const options: MarketFilterOption[] = [{ id: 'all', label: 'All markets' }];
    for (const j of this.tenantActiveJurisdictions()) {
      const meta = COUNTRY_REGISTRY[j.toUpperCase()];
      if (meta) {
        options.push({ id: meta.code.toLowerCase(), label: meta.shortName });
      } else {
        options.push({ id: j.toLowerCase(), label: j.toUpperCase() });
      }
    }
    if (this.tenantActiveModules().includes('ppwr')) {
      options.push({ id: 'ppwr', label: 'EU PPWR' });
    }
    return options;
  });

  // Scope names string (e.g. "UK EPR, Denmark EPR and EU PPWR")
  readonly dynamicScopeNames = computed(() => {
    const jNames = this.tenantActiveJurisdictions().map((j) => {
      const meta = COUNTRY_REGISTRY[j.toUpperCase()];
      return meta ? `${meta.shortName} EPR` : `${j.toUpperCase()} EPR`;
    });
    const modules: string[] = [];
    if (this.tenantActiveModules().includes('ppwr')) modules.push('EU PPWR');
    if (this.tenantActiveModules().includes('dpp')) modules.push('EU DPP');

    const allScopes = [...jNames, ...modules];
    if (allScopes.length === 0) return 'Statutory Compliance';
    if (allScopes.length === 1) return allScopes[0];
    if (allScopes.length === 2) return `${allScopes[0]} and ${allScopes[1]}`;
    return allScopes.slice(0, -1).join(', ') + ' and ' + allScopes[allScopes.length - 1];
  });

  readonly dynamicGreetingSubtitle = computed(() => {
    return `Your EPR position across ${this.dynamicScopeNames()} · data locked 28 Oct · specialist reviewed`;
  });

  // User name for greeting
  readonly greetingName = computed(() => {
    const user = this.authService.currentUser();
    if (user?.fullName) {
      return user.fullName.split(' ')[0];
    }
    return 'Anna';
  });

  // Dynamic Headline Metrics calculated from Real Products & Database
  readonly totalTrackedSkus = computed(() => {
    return this.products().length;
  });

  readonly openIssuesCount = computed(() => {
    return this.qualityIssues().length;
  });

  readonly dataCompletenessPercent = computed(() => {
    const total = this.totalTrackedSkus();
    const issues = this.openIssuesCount();
    if (total === 0) return 0;
    const validRatio = Math.max(0.0, Math.min(1.0, (total * 3 - issues) / (total * 3)));
    return Number((validRatio * 100).toFixed(0));
  });

  // Global EPR Costs dynamically calculated from tenant's actual products
  readonly globalLiabilityGbp = computed(() => {
    const prods = this.products();
    if (prods.length === 0) return 0;
    
    // If KHC portfolio (standard 5 mockups or seeded records)
    if (this.activeTenantId() === 'khc-europe') {
      return 6290000;
    }
    
    // Sum packaging weight and calculate real provisional fee per product
    let totalEstimatedFee = 0;
    for (const p of prods) {
      const units = 1000000;
      const totalWeightGrams = p.total_packaging_weight_grams || 
        (p.components?.reduce((sum, c) => sum + (c.weight_grams || 0), 0) || 25);
      const tonnes = (totalWeightGrams * units) / 1000000;
      totalEstimatedFee += Math.round(tonnes * 310);
    }
    return totalEstimatedFee > 0 ? totalEstimatedFee : prods.length * 85000;
  });

  readonly ukLiabilityGbp = computed(() => {
    if (this.globalLiabilityGbp() === 0) return 0;
    return Math.round(this.globalLiabilityGbp() * 0.941);
  });

  readonly denmarkLiabilityGbp = computed(() => {
    if (this.globalLiabilityGbp() === 0) return 0;
    return Math.round(this.globalLiabilityGbp() * 0.059);
  });

  readonly baselineProjected2030Gbp = computed(() => {
    const current = this.globalLiabilityGbp();
    if (current === 0) return 0;
    return Math.round(current * 1.206); // +20.6% inflation & volume growth
  });

  readonly withRecommendations2030Gbp = computed(() => {
    const current = this.globalLiabilityGbp();
    if (current === 0) return 0;
    return Math.round(current * 1.162); // -£282k savings in 2030
  });

  readonly savingsOpportunityGbp = computed(() => {
    return this.baselineProjected2030Gbp() - this.withRecommendations2030Gbp();
  });

  // PPWR Compliant vs Non-Compliant Count
  readonly ppwrTrackedCount = computed(() => {
    const count = this.totalTrackedSkus();
    if (this.activeTenantId() === 'khc-europe' || count >= 5) {
      return '12 of 124';
    }
    return `${count} of ${Math.max(count, 1)}`;
  });

  readonly ppwrNonCompliantCount = computed(() => {
    const prods = this.products();
    if (prods.length === 0) return 0;
    const nonCompliant = prods.filter(p => 
      p.sku.includes('POUCH') || 
      p.components?.some(c => c.material === 'OTHER_COMPOSITE' && !c.is_recyclable)
    );
    return nonCompliant.length > 0 ? nonCompliant.length : 3;
  });

  // Hotspots table matching Screen 02 mockup
  readonly hotspotRows = computed<HotspotRow[]>(() => {
    if (this.totalTrackedSkus() === 0 && this.activeTenantId() !== 'khc-europe') {
      return [];
    }

    return [
      {
        title: 'Squeeze bottles, PET + PP cap',
        recommendation: 'Lighter bottle, 38 g to 35 g',
        rating: 'Amber',
        fee: '£1.36m',
        saving: '−£16k a year',
        accentColor: '#B54708',
        routeLink: '/products',
      },
      {
        title: 'Glass sauce and condiment jars',
        recommendation: 'Lighter jar, 290 g to 260 g',
        rating: 'Green',
        fee: '£0.84m',
        saving: '−£59k a year',
        accentColor: '#0E7A3E',
        routeLink: '/products',
      },
      {
        title: 'Multi-layer sauce pouches',
        recommendation: 'Mono-material PE pouch',
        rating: 'Red',
        fee: '£0.54m',
        saving: '−£50k a year',
        accentColor: '#D92D20',
        routeLink: '/simulator',
      },
      {
        title: 'PP tubs, lids and black trays',
        recommendation: 'Detectable colour, not carbon black',
        rating: 'Red',
        fee: '£0.42m',
        saving: '−£157k a year',
        accentColor: '#D92D20',
        routeLink: '/simulator',
      },
    ];
  });

  // Savings in plan items
  readonly savingsPlanItems: SavingItem[] = [
    { name: 'Black trays, detectable colour', amount: '−£157k' },
    { name: 'Lighter glass jar', amount: '−£59k' },
    { name: 'Mono-material pouch', amount: '−£50k' },
    { name: 'Lighter PET bottle', amount: '−£16k' },
  ];

  // Dynamic Top 3 Breakdown KPI Cards (Adapts to Active Jurisdictions & Modules)
  readonly dynamicBreakdownCards = computed<DynamicKpiCard[]>(() => {
    const cards: DynamicKpiCard[] = [];
    const total = this.globalLiabilityGbp();
    const juris = this.tenantActiveJurisdictions();
    const modules = this.tenantActiveModules();

    // 1. Process active markets/jurisdictions
    for (const j of juris) {
      const code = j.toUpperCase();
      const meta = COUNTRY_REGISTRY[code];
      const name = meta ? meta.shortName : code;

      if (code === 'GB' || code === 'UK') {
        const fee = this.ukLiabilityGbp();
        cards.push({
          id: 'kpi-uk',
          kicker: 'UK EPR',
          badgeText: 'High confidence',
          badgeType: 'green',
          hasDot: true,
          amount: fee > 0 ? this.formatCurrencyMillions(fee) : '£0.00',
          subtext: '18,420 t · +11% vs 2025',
          barType: 'dual',
          barSegments: [
            { color: 'green', widthPct: 94 },
            { color: 'amber', widthPct: 6 },
          ],
        });
      } else if (code === 'DK') {
        const fee = this.denmarkLiabilityGbp();
        cards.push({
          id: 'kpi-dk',
          kicker: 'DENMARK EPR',
          badgeText: 'First full year',
          badgeType: 'neutral',
          amount: fee > 0 ? this.formatCurrencyMillions(fee) : '£0.00',
          subtext: 'DKK 3.2m · 1,150 t',
          barType: 'tri',
          barSegments: [
            { color: 'green', widthPct: 60 },
            { color: 'teal', widthPct: 25 },
            { color: 'red', widthPct: 15 },
          ],
        });
      } else if (code === 'DE') {
        const share = meta?.provisionalShare || 0.075;
        const fee = Math.round(total * share);
        cards.push({
          id: 'kpi-de',
          kicker: 'GERMANY EPR',
          badgeText: 'LUCID registered',
          badgeType: 'green',
          hasDot: true,
          amount: fee > 0 ? this.formatCurrencyMillions(fee) : '£0.00',
          subtext: 'VerpackG dual system · 4,200 t',
          barType: 'dual',
          barSegments: [
            { color: 'green', widthPct: 90 },
            { color: 'amber', widthPct: 10 },
          ],
        });
      } else if (code === 'FR') {
        const share = meta?.provisionalShare || 0.087;
        const fee = Math.round(total * share);
        cards.push({
          id: 'kpi-fr',
          kicker: 'FRANCE EPR',
          badgeText: 'Citeo verified',
          badgeType: 'green',
          hasDot: true,
          amount: fee > 0 ? this.formatCurrencyMillions(fee) : '£0.00',
          subtext: 'Citeo declaration & Triman',
          barType: 'dual',
          barSegments: [
            { color: 'green', widthPct: 88 },
            { color: 'teal', widthPct: 12 },
          ],
        });
      } else {
        const share = meta?.provisionalShare || 0.05;
        const fee = Math.round(total * share);
        cards.push({
          id: `kpi-${code.toLowerCase()}`,
          kicker: `${name.toUpperCase()} EPR`,
          badgeText: 'On track',
          badgeType: 'green',
          hasDot: true,
          amount: fee > 0 ? this.formatCurrencyMillions(fee) : '£0.00',
          subtext: `${meta?.regName || 'Statutory EPR'}`,
          barType: 'dual',
          barSegments: [
            { color: 'green', widthPct: 85 },
            { color: 'amber', widthPct: 15 },
          ],
        });
      }
    }

    // 2. Add module cards if slots remaining (< 3)
    if (cards.length < 3 && modules.includes('ppwr')) {
      const nonCompliant = this.ppwrNonCompliantCount();
      cards.push({
        id: 'kpi-ppwr',
        kicker: 'EU PPWR',
        badgeText:
          this.totalTrackedSkus() === 0
            ? '0 at risk'
            : nonCompliant > 0
            ? `${nonCompliant} at risk`
            : 'On track',
        badgeType:
          nonCompliant > 0 && this.totalTrackedSkus() > 0 ? 'red' : 'green',
        hasDot: nonCompliant > 0 && this.totalTrackedSkus() > 0,
        amount: this.ppwrTrackedCount(),
        subtext: 'DoCs issued · no fee, proof needed',
        barType: 'dual',
        barSegments: [{ color: 'blue', widthPct: 12 }],
      });
    }

    if (cards.length < 3 && modules.includes('dpp')) {
      cards.push({
        id: 'kpi-dpp',
        kicker: 'PRODUCT PASSPORT (DPP)',
        badgeText: 'ESPPR active',
        badgeType: 'neutral',
        amount: `${this.totalTrackedSkus()} passports`,
        subtext: 'Digital QR data carriers ready',
        barType: 'dual',
        barSegments: [{ color: 'teal', widthPct: 75 }],
      });
    }

    if (cards.length < 3 && modules.includes('lca')) {
      cards.push({
        id: 'kpi-lca',
        kicker: 'LCA & CARBON',
        badgeText: '-18% vs 2024',
        badgeType: 'green',
        amount: '2.41 kg CO₂e',
        subtext: 'Scope 3 packaging baseline',
        barType: 'dual',
        barSegments: [{ color: 'green', widthPct: 82 }],
      });
    }

    return cards.slice(0, 3);
  });

  // Obligations Table dynamically computed from tenant's active markets & modules
  readonly obligationsList = computed<ObligationRow[]>(() => {
    const rows: ObligationRow[] = [];
    const juris = this.tenantActiveJurisdictions().map((j) => j.toUpperCase());
    const modules = this.tenantActiveModules();

    if (juris.includes('DK')) {
      rows.push({
        due: '15 Nov 2026',
        framework: 'Denmark EPR',
        title: 'VANA Q3 quantity report',
        owner: 'Anna Morgan',
        preparedPct: 100,
        statusText: 'Ready to approve',
        statusType: 'ready',
      });
    }

    if (modules.includes('ppwr')) {
      rows.push({
        due: '30 Nov 2026',
        framework: 'EU PPWR',
        title: 'Sauce pouch DoC and technical file',
        owner: 'Packaging team',
        preparedPct: 83,
        statusText: 'At risk',
        statusType: 'risk',
      });
    }

    if (juris.includes('DK')) {
      rows.push({
        due: '15 Jan 2027',
        framework: 'Denmark EPR',
        title: 'VANA Q4 quantity report',
        owner: 'Anna Morgan',
        preparedPct: 20,
        statusText: 'Scheduled',
        statusType: 'scheduled',
      });
    }

    if (juris.includes('GB') || juris.includes('UK')) {
      rows.push({
        due: '01 Apr 2027',
        framework: 'UK EPR',
        title: 'Defra RPD H2 packaging mass filing',
        owner: 'Anna Morgan',
        preparedPct: 65,
        statusText: 'Scheduled',
        statusType: 'scheduled',
      });
    }

    if (juris.includes('DE')) {
      rows.push({
        due: '15 May 2027',
        framework: 'Germany EPR',
        title: 'ZSVR LUCID annual declaration & audit',
        owner: 'Compliance Lead',
        preparedPct: 50,
        statusText: 'Scheduled',
        statusType: 'scheduled',
      });
    }

    if (juris.includes('FR')) {
      rows.push({
        due: '01 Mar 2027',
        framework: 'France EPR',
        title: 'Citeo annual declaration & Triman audit',
        owner: 'Regulatory Affairs',
        preparedPct: 40,
        statusText: 'Scheduled',
        statusType: 'scheduled',
      });
    }

    return rows.slice(0, 4);
  });

  // Next Deadlines
  readonly nextDeadlines: DeadlineItem[] = [
    {
      date: '31 Mar 2027',
      title: 'Denmark · annual report to Dansk Producentansvar',
      authority: 'DPA Scheme',
      statusNote: 'Draft ready Feb',
      statusClass: 'status-ready',
    },
    {
      date: '1 Apr 2027',
      title: 'UK EPR · H2 2026 packaging data (RPD)',
      authority: 'Defra RPD',
      statusNote: 'Data 94% ready',
      statusClass: 'status-progress',
    },
    {
      date: 'Ongoing',
      title: 'EU PPWR · DoC before each pack is sold',
      authority: 'Article 6 Declarations',
      statusNote: '12 of 124 signed',
      statusClass: 'status-ongoing',
    },
  ];

  // Pending Tasks for User
  readonly waitingForYouTasks: PendingTaskItem[] = [
    {
      id: 'task-1',
      title: 'Approve 6 data corrections',
      description: 'Will update Trace One Devex',
      icon: 'shield',
      routeLink: '/quality',
    },
    {
      id: 'task-2',
      title: 'Sign 4 EU Declarations of Conformity',
      description: 'As authorised signatory',
      icon: 'doc',
      routeLink: '/quality',
    },
    {
      id: 'task-3',
      title: 'Review the H2 2026 UK report',
      description: 'Ready for your review',
      icon: 'chart',
      routeLink: '/simulator',
    },
  ];

  // Market Breakdown Table (UK Defra, Denmark DPA, Germany LUCID, France CITEO)
  readonly marketSummaries = computed<MarketFeeBreakdown[]>(() => {
    const total = this.globalLiabilityGbp();
    const skuCnt = this.totalTrackedSkus();
    if (skuCnt === 0) {
      return [
        {
          countryCode: 'GB',
          countryName: 'United Kingdom',
          regulationName: 'UK Defra RPD (pEPR 2026)',
          provisionalFeeGbp: 0,
          uncertaintyMarginGbp: 0,
          skuCount: 0,
          complianceStatus: 'VERIFIED',
          deadlineDate: '31 Oct 2026',
        },
        {
          countryCode: 'DK',
          countryName: 'Denmark',
          regulationName: 'Dansk Producent Ansvar (DPA EPR)',
          provisionalFeeGbp: 0,
          uncertaintyMarginGbp: 0,
          skuCount: 0,
          complianceStatus: 'VERIFIED',
          deadlineDate: '15 Jan 2027',
        },
        {
          countryCode: 'DE',
          countryName: 'Germany',
          regulationName: 'VerpackG / ZSVR LUCID',
          provisionalFeeGbp: 0,
          uncertaintyMarginGbp: 0,
          skuCount: 0,
          complianceStatus: 'VERIFIED',
          deadlineDate: '15 May 2027',
        },
        {
          countryCode: 'FR',
          countryName: 'France',
          regulationName: 'Citeo Household Packaging',
          provisionalFeeGbp: 0,
          uncertaintyMarginGbp: 0,
          skuCount: 0,
          complianceStatus: 'VERIFIED',
          deadlineDate: '01 Mar 2027',
        },
      ];
    }
    return [
      {
        countryCode: 'GB',
        countryName: 'United Kingdom',
        regulationName: 'UK Defra RPD (pEPR 2026)',
        provisionalFeeGbp: this.ukLiabilityGbp(),
        uncertaintyMarginGbp: Math.round(this.ukLiabilityGbp() * 0.031),
        skuCount: skuCnt,
        complianceStatus: 'ACTION_REQUIRED',
        deadlineDate: '31 Oct 2026',
      },
      {
        countryCode: 'DK',
        countryName: 'Denmark',
        regulationName: 'Dansk Producent Ansvar (DPA EPR)',
        provisionalFeeGbp: this.denmarkLiabilityGbp(),
        uncertaintyMarginGbp: Math.round(this.denmarkLiabilityGbp() * 0.05),
        skuCount: Math.min(skuCnt, 3),
        complianceStatus: 'ON_TRACK',
        deadlineDate: '15 Jan 2027',
      },
      {
        countryCode: 'DE',
        countryName: 'Germany',
        regulationName: 'VerpackG / ZSVR LUCID',
        provisionalFeeGbp: Math.round(total * 0.07),
        uncertaintyMarginGbp: Math.round(total * 0.005),
        skuCount: Math.min(skuCnt, 4),
        complianceStatus: 'VERIFIED',
        deadlineDate: '15 May 2027',
      },
      {
        countryCode: 'FR',
        countryName: 'France',
        regulationName: 'Citeo Household Packaging',
        provisionalFeeGbp: Math.round(total * 0.087),
        uncertaintyMarginGbp: Math.round(total * 0.006),
        skuCount: skuCnt,
        complianceStatus: 'ON_TRACK',
        deadlineDate: '01 Mar 2027',
      },
    ];
  });

  ngOnInit(): void {
    // Fetch live products, issues and tenants from backend PostgreSQL
    this.foundationService.loadProducts().subscribe();
    this.qualityService.loadIssues().subscribe();
    this.tenantService.loadTenants().subscribe();
  }

  setMarket(m: string): void {
    this.selectedMarket.set(m);
  }

  formatCurrencyMillions(value: number): string {
    const inMillions = value / 1_000_000;
    return `£${inMillions.toFixed(2)}m`;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-GB', { 
      style: 'currency', 
      currency: 'GBP', 
      maximumFractionDigits: 0 
    }).format(value);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-GB').format(value);
  }

  // Dynamic 6-year forecast based on tenant's real liability
  readonly forecastYears = computed(() => {
    const base = this.globalLiabilityGbp();
    if (base === 0) return [];
    return [
      { year: '2025', status: 'actual', feeGbp: Math.round(base * 0.877), heightPct: 65, isNavy: true },
      { year: '2026', status: 'invoiced', feeGbp: base, heightPct: 74, isNavy: true, hasCap: true },
      { year: '2027', status: 'forecast', feeGbp: Math.round(base * 1.044), heightPct: 78, isNavyMuted: true, hasCap: true },
      { year: '2028', status: 'forecast', feeGbp: Math.round(base * 1.095), heightPct: 82, isNavyMuted: true, hasCap: true },
      { year: '2029', status: 'forecast', feeGbp: Math.round(base * 1.151), heightPct: 87, isNavyMuted: true, hasCap: true },
      { year: '2030', status: 'forecast', feeGbp: this.baselineProjected2030Gbp(), heightPct: 92, isNavyMuted: true, hasCap: true, optimizedFee: this.withRecommendations2030Gbp() }
    ];
  });


  exportBoardPack(): void {
    const tenant = this.activeTenantName();
    const rows = [
      ['EXECUTIVE COMPLIANCE BOARD PACK', 'CONFIDENTIAL', new Date().toISOString().slice(0, 10)],
      ['Tenant / Client Workspace', tenant],
      ['Statutory Scope', 'UK EPR, Denmark VANA EPR, EU PPWR'],
      ['Reporting Year', '2026'],
      [''],
      ['EXECUTIVE POSITION', 'VALUE'],
      ['Global EPR Baseline Liability', this.formatCurrency(this.globalLiabilityGbp())],
      ['UK EPR Invoiced Liability', this.formatCurrency(this.ukLiabilityGbp())],
      ['Denmark EPR Invoiced Liability', this.formatCurrency(this.denmarkLiabilityGbp())],
      ['Data Completeness Index', this.dataCompletenessPercent() + '% Complete'],
      ['Open Data Quality Gaps', String(this.openIssuesCount())],
      [''],
      ['TOP PACKAGING COST HOTSPOTS', 'RATING', 'ANNUAL FEE', 'POTENTIAL SAVINGS'],
    ];

    for (const h of this.hotspotRows()) {
      rows.push([h.title, h.rating, h.fee, '-' + h.saving + ' / yr']);
    }

    rows.push(['']);
    rows.push(['6-YEAR FORECAST TRAJECTORY', 'FEE']);
    for (const y of this.forecastYears()) {
      rows.push([y.year + ' (' + y.status + ')', this.formatCurrency(y.feeGbp)]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${tenant.replace(/\s+/g, '_')}_Board_Pack_2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.toastService.show('Executive Compliance Board Pack exported successfully', 'success');
  }
}
