import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, of } from 'rxjs';
import { APP_CONFIG } from '../config/client-theme.config';
import { TenantApiService } from './tenant-api.service';
import { AuthService } from './auth.service';

export interface SourceLineage {
  source_system: string;
  source_record_id: string;
  import_batch_id: string;
  ingested_at?: string;
  is_source_of_truth?: boolean;
}

export interface PackagingComponent {
  id: string;
  name: string;
  level: 'primary' | 'secondary' | 'tertiary';
  material: string;
  weight_grams: number;
  recycled_content_pct: number;
  is_recyclable: boolean;
  recyclability_notes?: string;
  separable_by_consumer: boolean;
  has_disruptor_pigment: boolean;
  source_lineage?: SourceLineage;
}

export interface CanonicalProduct {
  sku: string;
  brand: string;
  name: string;
  category: string;
  unit_volume_ml?: number;
  net_content_grams?: number;
  status: string;
  total_packaging_weight_grams: number;
  primary_material_summary?: string;
  components: PackagingComponent[];
  has_quality_issues?: boolean;
  open_issue_count?: number;
  source_lineage?: SourceLineage;
}

export interface PPWRComponentAssessment {
  component_id: string;
  component_name: string;
  material: string;
  weight_grams: number;
  recycled_content_pct: number;
  is_separable: boolean;
  recyclability_rate_pct: number;
  disruptor_present: boolean;
  compliance_notes: string;
}

export interface PPWRDeclarationOfConformity {
  doc_reference: string;
  sku: string;
  gtin: string;
  product_name: string;
  producer_legal_entity: string;
  jurisdiction: string;
  effective_ppwr_date: string;
  overall_recyclability_pct: number;
  recyclability_grade: string;
  is_compliant_for_eu_market: boolean;
  heavy_metals_compliant: boolean;
  pfas_substance_free: boolean;
  packaging_minimisation_ratio_pct: number;
  reusable_packaging: boolean;
  source_plm_spec: string;
  source_sales_system: string;
  components_assessed: PPWRComponentAssessment[];
  generated_at: string;
}

export interface DigitalProductPassport {
  passport_id: string;
  sku: string;
  gtin: string;
  product_name: string;
  brand: string;
  gs1_digital_link_url: string;
  qr_data_carrier_payload: string;
  total_packaging_weight_grams: number;
  total_recycled_content_pct: number;
  primary_polymer: string;
  recyclability_grade: string;
  disposal_instructions: string[];
  harmonised_sorting_label: string;
  spec_source_system: string;
  spec_reference_id: string;
  verified_by: string;
  issued_at: string;
}

export interface LcaComponentLine {
  component_id: string;
  component_name: string;
  packaging_level: string;
  material: string;
  weight_grams: number;
  emission_factor_kg_co2e_per_kg: number;
  component_co2e_grams: number;
  share_percentage: number;
}

export interface LcaReductionRecommendation {
  action: string;
  estimated_co2e_saving_pct: number;
  annual_scope3_saving_tonnes: number;
  complexity: string;
}

export interface LcaAssessmentResponse {
  sku: string;
  product_name: string;
  brand: string;
  primary_material: string;
  total_packaging_weight_grams: number;
  pack_carbon_footprint_g_co2e: number;
  annual_units_placed: number;
  annual_scope3_tonnes_co2e: number;
  eco_score_grade: string;
  eco_score_points: number;
  recycled_content_reduction_g_co2e: number;
  grid_carbon_intensity_factor: number;
  transport_cradle_to_gate_km: number;
  component_breakdowns: LcaComponentLine[];
  reduction_recommendations: LcaReductionRecommendation[];
  required_additional_data: string[];
}


export interface PPWREnrichmentData {
  recyclass_cert_id?: string | null;
  pcr_cert_id?: string | null;
  pfas_free_declaration: boolean;
  heavy_metals_pass: boolean;
  lab_test_date?: string | null;
  reusable_packaging: boolean;
}

export interface DPPEnrichmentData {
  gtin?: string | null;
  gs1_domain?: string | null;
  brand_landing_url?: string | null;
  disposal_instructions: string[];
  harmonised_label?: string | null;
}

export interface LCAEnrichmentData {
  renewable_energy_pct: number;
  transport_distance_km: number;
  epd_registration_id?: string | null;
  grid_intensity_override?: number | null;
}

export interface EPREnrichmentData {
  activity_type?: string | null;
  organisation_size?: string | null;
  reuse_system_active: boolean;
}

export interface ModuleEntitlementResponse {
  tenant_id: string;
  tenant_name: string;
  active_modules: string[];
}

export interface IngestionBatch {
  id: string;
  tenant_id: string;
  source_reference: string;
  source_batch_reference?: string;
  source_type?: string;
  status: string;
  records_received?: number;
  records_normalized: number;
  records_ingested?: number;
  quality_issues_detected: number;
  created_at: string;
  message?: string;
}

export interface SkuImportItem {
  sku: string;
  name: string;
  brand?: string;
  category?: string;
  material?: string;
  packaging_weight_grams?: number | null;
  recycled_content_pct?: number;
  is_recyclable?: boolean;
  units_sold?: number | null;
  jurisdiction?: string;
}

export interface SkuImportPayload {
  tenant_id: string;
  source_name: string;
  items: SkuImportItem[];
}

export interface SkuImportResponse {
  tenant_id: string;
  batch_id: string;
  records_received: number;
  records_imported: number;
  quality_issues_detected: number;
  issues_summary: string[];
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class FoundationApiService {
  private readonly http = inject(HttpClient);
  private readonly tenantService = inject(TenantApiService);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = APP_CONFIG.apiBaseUrl;

  readonly products = signal<CanonicalProduct[]>([]);
  readonly selectedProduct = signal<CanonicalProduct | null>(null);
  readonly ppwrDoc = signal<PPWRDeclarationOfConformity | null>(null);
  readonly dppPassport = signal<DigitalProductPassport | null>(null);
  readonly lcaAssessment = signal<LcaAssessmentResponse | null>(null);
  readonly moduleEntitlement = signal<ModuleEntitlementResponse | null>(null);
  readonly loading = signal<boolean>(false);
  readonly syncing = signal<boolean>(false);
  readonly lastSyncBatch = signal<IngestionBatch | null>(null);

  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'X-Tenant-ID': this.tenantService.activeTenantId(),
    });
    const token = this.authService.getToken();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  loadProducts(force = false): Observable<CanonicalProduct[]> {
    if (!force && this.products().length > 0) {
      return of(this.products());
    }
    this.loading.set(true);
    return this.http
      .get<CanonicalProduct[]>(`${this.baseUrl}/api/v1/foundation/products`, {
        headers: this.getHeaders(),
      })
      .pipe(
        tap({
          next: (res) => {
            this.products.set(res);
            if (res.length > 0) {
              const current = this.selectedProduct();
              const toSelect = current ? res.find(p => p.sku === current.sku) || res[0] : res[0];
              this.selectProduct(toSelect.sku);
            }
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        })
      );
  }

  selectProduct(sku: string): void {
    const prod = this.products().find((p) => p.sku === sku);
    if (prod) {
      this.selectedProduct.set(prod);
      this.loadPpwrDoc(sku).subscribe();
      this.loadDpp(sku).subscribe();
      this.loadLca(sku).subscribe();
    }
  }

  loadModuleEntitlement(): Observable<ModuleEntitlementResponse> {
    return this.http
      .get<ModuleEntitlementResponse>(`${this.baseUrl}/api/v1/compliance/modules/entitlement`, {
        headers: this.getHeaders(),
      })
      .pipe(
        tap({
          next: (ent) => this.moduleEntitlement.set(ent),
          error: () => this.moduleEntitlement.set(null),
        })
      );
  }

  createProduct(product: any): Observable<CanonicalProduct> {
    return this.http
      .post<CanonicalProduct>(`${this.baseUrl}/api/v1/foundation/products`, product, {
        headers: this.getHeaders(),
      })
      .pipe(
        tap({
          next: (created) => {
            this.products.update((list) => [created, ...list.filter((p) => p.sku !== created.sku)]);
            this.selectedProduct.set(created);
          },
        })
      );
  }

  loadPpwrDoc(sku: string): Observable<PPWRDeclarationOfConformity> {
    return this.http
      .get<PPWRDeclarationOfConformity>(`${this.baseUrl}/api/v1/compliance/modules/ppwr/${sku}`, {
        headers: this.getHeaders(),
      })
      .pipe(
        tap({
          next: (doc) => this.ppwrDoc.set(doc),
          error: () => this.ppwrDoc.set(null),
        })
      );
  }

  loadDpp(sku: string): Observable<DigitalProductPassport> {
    return this.http
      .get<DigitalProductPassport>(`${this.baseUrl}/api/v1/compliance/modules/dpp/${sku}`, {
        headers: this.getHeaders(),
      })
      .pipe(
        tap({
          next: (passport) => this.dppPassport.set(passport),
          error: () => this.dppPassport.set(null),
        })
      );
  }

  loadLca(sku: string): Observable<LcaAssessmentResponse> {
    return this.http
      .get<LcaAssessmentResponse>(`${this.baseUrl}/api/v1/compliance/modules/lca/${sku}`, {
        headers: this.getHeaders(),
      })
      .pipe(
        tap({
          next: (lca) => this.lcaAssessment.set(lca),
          error: () => this.lcaAssessment.set(null),
        })
      );
  }

  triggerTraceOneSync(specId = 'DEV-8821'): Observable<IngestionBatch> {
    this.syncing.set(true);
    return this.http
      .post<IngestionBatch>(
        `${this.baseUrl}/api/v1/foundation/sync/traceone?spec_id=${specId}`,
        {},
        { headers: this.getHeaders() }
      )
      .pipe(
        tap({
          next: (batch) => {
            this.lastSyncBatch.set(batch);
            this.syncing.set(false);
            this.loadProducts().subscribe();
            this.getBatches().subscribe();
          },
          error: () => this.syncing.set(false),
        })
      );
  }

  triggerSnowflakeSync(queryId = 'QRY-SNOW-9921'): Observable<IngestionBatch> {
    this.syncing.set(true);
    return this.http
      .post<IngestionBatch>(
        `${this.baseUrl}/api/v1/foundation/sync/snowflake?query_id=${queryId}`,
        {},
        { headers: this.getHeaders() }
      )
      .pipe(
        tap({
          next: (batch) => {
            this.lastSyncBatch.set(batch);
            this.syncing.set(false);
            this.loadProducts().subscribe();
            this.getBatches().subscribe();
          },
          error: () => this.syncing.set(false),
        })
      );
  }

  savePpwrEnrichment(sku: string, payload: PPWREnrichmentData): Observable<PPWRDeclarationOfConformity> {
    return this.http
      .post<PPWRDeclarationOfConformity>(
        `${this.baseUrl}/api/v1/compliance/modules/enrichment/${sku}/ppwr`,
        payload,
        { headers: this.getHeaders() }
      )
      .pipe(tap((doc) => this.ppwrDoc.set(doc)));
  }

  saveLcaEnrichment(sku: string, payload: LCAEnrichmentData): Observable<LcaAssessmentResponse> {
    return this.http
      .post<LcaAssessmentResponse>(
        `${this.baseUrl}/api/v1/compliance/modules/enrichment/${sku}/lca`,
        payload,
        { headers: this.getHeaders() }
      )
      .pipe(tap((lca) => this.lcaAssessment.set(lca)));
  }

  saveDppEnrichment(sku: string, payload: DPPEnrichmentData): Observable<DigitalProductPassport> {
    return this.http
      .post<DigitalProductPassport>(
        `${this.baseUrl}/api/v1/compliance/modules/enrichment/${sku}/dpp`,
        payload,
        { headers: this.getHeaders() }
      )
      .pipe(tap((dpp) => this.dppPassport.set(dpp)));
  }

  importSkus(payload: SkuImportPayload): Observable<SkuImportResponse> {
    return this.http.post<SkuImportResponse>(`${this.baseUrl}/api/v1/foundation/import`, payload);
  }

  getBatches(tenantId?: string): Observable<IngestionBatch[]> {
    const tid = tenantId || this.tenantService.activeTenantId();
    return this.http.get<IngestionBatch[]>(`${this.baseUrl}/api/v1/foundation/batches`, {
      headers: new HttpHeaders({ 'X-Tenant-ID': tid }),
    });
  }
}
