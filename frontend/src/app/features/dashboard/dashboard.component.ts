import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { APP_CONFIG } from '../../core/config/client-theme.config';
import { TenantApiService } from '../../core/services/tenant-api.service';

interface MarketFeeSummary {
  countryCode: string;
  countryName: string;
  flagEmoji: string;
  regulationName: string;
  provisionalFee: number;
  uncertaintyMargin: number;
  skuCount: number;
  complianceStatus: 'ON_TRACK' | 'ACTION_REQUIRED' | 'VERIFIED';
  deadlineDate: string;
}

interface SourceCorrectionTicket {
  id: string;
  skuCode: string;
  productName: string;
  sourceSystem: string;
  missingDataPoint: string;
  assignedTo: string;
  status: 'DISPATCHED_TO_PLM' | 'PENDING_REIMPORT' | 'RESOLVED';
  impactMargin: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  readonly tenantService = inject(TenantApiService);
  readonly config = APP_CONFIG;

  // Selected Tenant Signal
  readonly activeTenantId = this.tenantService.activeTenantId;
  readonly activeTenantName = signal<string>('The Kraft Heinz Company Europe');

  // KPI Metrics
  readonly totalEstimatedFee = signal<number>(2418920);
  readonly totalUncertaintyMargin = signal<number>(184300);
  readonly dataCompletenessPercent = signal<number>(92.4);
  readonly totalTrackedSkus = signal<number>(1420);
  readonly unverifiedSkus = signal<number>(18);

  // Market Breakdown
  readonly marketSummaries = signal<MarketFeeSummary[]>([
    {
      countryCode: 'GB',
      countryName: 'United Kingdom',
      flagEmoji: '',
      regulationName: 'UK Defra RPD (EPR)',
      provisionalFee: 980450,
      uncertaintyMargin: 64200,
      skuCount: 680,
      complianceStatus: 'ACTION_REQUIRED',
      deadlineDate: '31 Oct 2026',
    },
    {
      countryCode: 'FR',
      countryName: 'France',
      flagEmoji: '',
      regulationName: 'Citeo / Adelphe EPR',
      provisionalFee: 640120,
      uncertaintyMargin: 42000,
      skuCount: 540,
      complianceStatus: 'ON_TRACK',
      deadlineDate: '01 Mar 2027',
    },
    {
      countryCode: 'DE',
      countryName: 'Germany',
      flagEmoji: '',
      regulationName: 'VerpackG (LUCID)',
      provisionalFee: 512300,
      uncertaintyMargin: 38100,
      skuCount: 610,
      complianceStatus: 'VERIFIED',
      deadlineDate: '15 May 2027',
    },
    {
      countryCode: 'ES',
      countryName: 'Spain',
      flagEmoji: '',
      regulationName: 'Real Decreto 1055/2022',
      provisionalFee: 286050,
      uncertaintyMargin: 40000,
      skuCount: 390,
      complianceStatus: 'ON_TRACK',
      deadlineDate: '30 Jun 2027',
    },
  ]);

  // Source System Correction Tickets (Demonstrating read-only PLM governance)
  readonly sourceTickets = signal<SourceCorrectionTicket[]>([
    {
      id: 'TCK-2026-081',
      skuCode: 'SKU-00192',
      productName: 'Heinz Tomato Ketchup Top-Down 500g',
      sourceSystem: 'Trace One PLM',
      missingDataPoint: 'DP18: Post-Consumer Recycled (PCR) % unverified',
      assignedTo: 'Packaging Spec Team (KHC)',
      status: 'DISPATCHED_TO_PLM',
      impactMargin: '±€14,200 fee delta in France',
    },
    {
      id: 'TCK-2026-088',
      skuCode: 'SKU-00412',
      productName: 'HP Brown Sauce Glass Bottle 285g',
      sourceSystem: 'Snowflake Data Cloud',
      missingDataPoint: 'DP08: Component weight discrepancy (Tare vs Gross)',
      assignedTo: 'Supply Chain Operations',
      status: 'PENDING_REIMPORT',
      impactMargin: '±€8,600 Defra tonnage impact',
    },
    {
      id: 'TCK-2026-094',
      skuCode: 'SKU-00831',
      productName: 'Heinz Baked Beanz 4-Pack Shrink Wrap',
      sourceSystem: 'Trace One PLM',
      missingDataPoint: 'DP22: Secondary LDPE film thickness (<50 micron)',
      assignedTo: 'Procurement Specialist',
      status: 'DISPATCHED_TO_PLM',
      impactMargin: '±€19,500 plastic tax modulation',
    },
  ]);

  // System Connector Status
  readonly connectors = signal([
    { name: 'Trace One PLM', type: 'PLM Specifications', status: 'Healthy', lastSync: '18 mins ago', icon: '' },
    { name: 'Snowflake Cloud DW', type: 'Sales & Distribution', status: 'Healthy', lastSync: '1 hour ago', icon: '' },
    { name: 'Excel / CSV Importer', type: 'Legacy Manual Specs', status: 'Idle', lastSync: 'Yesterday', icon: '' },
  ]);

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
  }
}
