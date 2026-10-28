import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { APP_CONFIG } from '../config/client-theme.config';
import { TenantApiService } from './tenant-api.service';

export interface FeeLineItem {
  sku: string;
  component_id: string;
  material: string;
  weight_grams: number;
  annual_volume_units: number;
  total_tonnage: number;
  base_rate_eur_per_tonne: number;
  base_fee_eur: number;
  eco_modulation_delta_eur: number;
  final_fee_eur: number;
  has_uncertainty_flag: boolean;
}

export interface CalculationRunResponse {
  run_id: string;
  tenant_id: string;
  rule_set_id: string;
  jurisdiction: string;
  reporting_year: number;
  total_fee_eur: number;
  base_fee_eur: number;
  eco_modulation_net_eur: number;
  uncertainty_margin_eur: number;
  total_packaging_tonnage: number;
  sku_count_evaluated: number;
  line_items: FeeLineItem[];
}

export interface ScenarioSimulationResponse {
  scenario_name: string;
  baseline_fee_eur: number;
  projected_fee_eur: number;
  net_savings_eur: number;
  reduction_percentage: number;
  key_drivers: string[];
}

@Injectable({
  providedIn: 'root',
})
export class EprApiService {
  private readonly http = inject(HttpClient);
  private readonly tenantService = inject(TenantApiService);
  private readonly baseUrl = APP_CONFIG.apiBaseUrl;

  readonly calculationResult = signal<CalculationRunResponse | null>(null);
  readonly simulationResult = signal<ScenarioSimulationResponse | null>(null);
  readonly loading = signal<boolean>(false);
  readonly calculating = signal<boolean>(false);

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'X-Tenant-ID': this.tenantService.activeTenantId(),
    });
  }

  runCalculation(ruleSetId = 'FR-CITEO-2025'): Observable<CalculationRunResponse> {
    this.calculating.set(true);
    return this.http
      .post<CalculationRunResponse>(
        `${this.baseUrl}/api/v1/compliance/epr/calculate`,
        {
          tenant_id: this.tenantService.activeTenantId(),
          rule_set_id: ruleSetId,
          reporting_year: 2025,
          apply_eco_modulation: true,
        },
        { headers: this.getHeaders() }
      )
      .pipe(
        tap({
          next: (res) => {
            this.calculationResult.set(res);
            this.calculating.set(false);
          },
          error: () => this.calculating.set(false),
        })
      );
  }

  simulateScenario(
    pcrTargetPct: number,
    eliminateComposites: boolean
  ): Observable<ScenarioSimulationResponse> {
    this.loading.set(true);
    return this.http
      .post<ScenarioSimulationResponse>(
        `${this.baseUrl}/api/v1/compliance/epr/scenarios/simulate`,
        {
          scenario_name: `Target ${pcrTargetPct}% PCR + ${eliminateComposites ? 'Monomaterial' : 'Standard'} BOM`,
          target_pcr_percentage: pcrTargetPct,
          eliminate_composite_malus: eliminateComposites,
          rule_set_id: 'FR-CITEO-2025',
        },
        { headers: this.getHeaders() }
      )
      .pipe(
        tap({
          next: (res) => {
            this.simulationResult.set(res);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        })
      );
  }
}
