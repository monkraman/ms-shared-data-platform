import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../config/client-theme.config';

export interface SectorConfig {
  id: string;
  name: string;
  description: string;
  default_categories: string[];
  active: boolean;
}

export interface UserRoleConfig {
  role_key: string;
  name: string;
  description: string;
  is_client_assignable: boolean;
}

export interface TariffRate {
  material_code: string;
  material_name: string;
  jurisdiction: string;
  currency: string;
  base_rate_per_tonne: number;
  unit: string;
  ram_green_discount_pct: number;
  ram_amber_rate_pct: number;
  ram_red_penalty_pct: number;
  effective_year: string;
  source_citation: string;
}

export interface CountryConfig {
  country_code: string;
  country_name: string;
  currency: string;
  is_eu_member: boolean;
  regulations: string[];
  data_points_required_count: number;
  active: boolean;
}

export interface RegulationConfig {
  regulation_code: string;
  name: string;
  country_code: string;
  country_name: string;
  description: string;
  national_report_name: string;
  fee_system_name: string;
  ppwr_applicable: boolean;
  applies_from?: string;
  legal_basis: string;
}

export interface DataPointDefinition {
  id: string;
  name: string;
  description: string;
  comes_from: string;
  system_field_example: string;
  applicable_countries: string[];
  goes_into: string[];
  ppwr_note?: string;
}

export interface ComplianceMatrixResponse {
  applicable_regulations: RegulationConfig[];
  total_data_points_required: number;
  required_data_points: DataPointDefinition[];
  source_systems_needed: string[];
  national_reports: Record<string, string>;
  fee_systems: Record<string, string>;
}

export interface MasterDataResponse {
  sectors: SectorConfig[];
  countries: CountryConfig[];
  regulations: RegulationConfig[];
  tariffs: TariffRate[];
  user_roles: UserRoleConfig[];
  data_points_total: number;
}

@Injectable({ providedIn: 'root' })
export class ConfigApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${APP_CONFIG.apiBaseUrl}/api/v1/config`;

  getMasterData(): Observable<MasterDataResponse> {
    return this.http.get<MasterDataResponse>(`${this.baseUrl}/masters`);
  }

  getTariffs(): Observable<TariffRate[]> {
    return this.http.get<TariffRate[]>(`${this.baseUrl}/tariffs`);
  }

  getUserRoles(): Observable<UserRoleConfig[]> {
    return this.http.get<UserRoleConfig[]>(`${this.baseUrl}/roles`);
  }

  getSectors(): Observable<SectorConfig[]> {
    return this.http.get<SectorConfig[]>(`${this.baseUrl}/sectors`);
  }

  getCountries(): Observable<CountryConfig[]> {
    return this.http.get<CountryConfig[]>(`${this.baseUrl}/countries`);
  }

  getRegulations(countryCode?: string): Observable<RegulationConfig[]> {
    let params = new HttpParams();
    if (countryCode) {
      params = params.set('country_code', countryCode);
    }
    return this.http.get<RegulationConfig[]>(`${this.baseUrl}/regulations`, { params });
  }

  getDataPoints(countries?: string[]): Observable<DataPointDefinition[]> {
    let params = new HttpParams();
    if (countries && countries.length > 0) {
      countries.forEach(c => {
        params = params.append('countries', c);
      });
    }
    return this.http.get<DataPointDefinition[]>(`${this.baseUrl}/data-points`, { params });
  }

  calculateMatrix(sectorIds: string[], countryCodes: string[]): Observable<ComplianceMatrixResponse> {
    return this.http.post<ComplianceMatrixResponse>(`${this.baseUrl}/calculate-matrix`, {
      sector_ids: sectorIds,
      country_codes: countryCodes,
    });
  }
}
