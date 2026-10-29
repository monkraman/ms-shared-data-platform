import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { APP_CONFIG } from '../config/client-theme.config';
import { TenantApiService } from './tenant-api.service';
import { AuthService } from './auth.service';

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
  components: PackagingComponent[];
  has_quality_issues?: boolean;
  open_issue_count?: number;
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

  loadProducts(): Observable<CanonicalProduct[]> {
    this.loading.set(true);
    return this.http
      .get<CanonicalProduct[]>(`${this.baseUrl}/api/v1/foundation/products`, {
        headers: this.getHeaders(),
      })
      .pipe(
        tap({
          next: (res) => {
            this.products.set(res);
            if (res.length > 0 && !this.selectedProduct()) {
              this.selectedProduct.set(res[0]);
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
    }
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
          },
          error: () => this.syncing.set(false),
        })
      );
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
