import os

# 1. Update TenantApiService with caching
path_tenant = 'frontend/src/app/core/services/tenant-api.service.ts'
with open(path_tenant, 'r', encoding='utf-8') as f:
    t_code = f.read()

if 'of(' not in t_code:
    t_code = t_code.replace("import { Observable, tap } from 'rxjs';", "import { Observable, tap, of } from 'rxjs';")
    old_load = """  loadTenants(): Observable<BackendTenantRecord[]> {
    this.loading.set(true);
    this.error.set(null);
    return this.http.get<BackendTenantRecord[]>(`${this.baseUrl}/api/v1/tenants`).pipe("""
    
    new_load = """  loadTenants(force = false): Observable<BackendTenantRecord[]> {
    if (!force && this.tenants().length > 0) {
      return of(this.tenants());
    }
    this.loading.set(true);
    this.error.set(null);
    return this.http.get<BackendTenantRecord[]>(`${this.baseUrl}/api/v1/tenants`).pipe("""
    
    t_code = t_code.replace(old_load, new_load)
    with open(path_tenant, 'w', encoding='utf-8') as f:
        f.write(t_code)
    print('Updated TenantApiService with caching')

# 2. Update QualityApiService with caching
path_quality = 'frontend/src/app/core/services/quality-api.service.ts'
with open(path_quality, 'r', encoding='utf-8') as f:
    q_code = f.read()

if 'of(' not in q_code:
    q_code = q_code.replace("import { Observable, tap } from 'rxjs';", "import { Observable, tap, of } from 'rxjs';")
    old_q_load = """  loadIssues(): Observable<DataQualityIssue[]> {
    this.loading.set(true);
    return this.http
      .get<DataQualityIssue[]>(`${this.baseUrl}/api/v1/quality/issues`,"""
    new_q_load = """  loadIssues(force = false): Observable<DataQualityIssue[]> {
    if (!force && this.issues().length > 0) {
      return of(this.issues());
    }
    this.loading.set(true);
    return this.http
      .get<DataQualityIssue[]>(`${this.baseUrl}/api/v1/quality/issues`,"""
    q_code = q_code.replace(old_q_load, new_q_load)
    with open(path_quality, 'w', encoding='utf-8') as f:
        f.write(q_code)
    print('Updated QualityApiService with caching')

# 3. Update FoundationApiService with caching
path_found = 'frontend/src/app/core/services/foundation-api.service.ts'
with open(path_found, 'r', encoding='utf-8') as f:
    f_code = f.read()

if 'of(' not in f_code:
    f_code = f_code.replace("import { Observable, tap } from 'rxjs';", "import { Observable, tap, of } from 'rxjs';")
    old_f_load = """  loadProducts(): Observable<CanonicalProduct[]> {
    this.loading.set(true);
    return this.http
      .get<CanonicalProduct[]>(`${this.baseUrl}/api/v1/foundation/products`,"""
    new_f_load = """  loadProducts(force = false): Observable<CanonicalProduct[]> {
    if (!force && this.products().length > 0) {
      return of(this.products());
    }
    this.loading.set(true);
    return this.http
      .get<CanonicalProduct[]>(`${this.baseUrl}/api/v1/foundation/products`,"""
    f_code = f_code.replace(old_f_load, new_f_load)
    with open(path_found, 'w', encoding='utf-8') as f:
        f.write(f_code)
    print('Updated FoundationApiService with caching')

# 4. Update AdminComponent to strictly lazy load per tab
path_admin = 'frontend/src/app/features/admin/admin.component.ts'
with open(path_admin, 'r', encoding='utf-8') as f:
    a_code = f.read()

old_init = """  ngOnInit(): void {
    this.refreshTenants();
    this.loadMasterData();
    this.loadUsers();
    this.syncTabFromUrl(this.router.url);

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.syncTabFromUrl(event.urlAfterRedirects || event.url);
      });
  }

  syncTabFromUrl(url: string): void {
    if (url.includes('/admin/users')) {
      this.activeTab.set('users');
      this.loadUsers();
      this.loadUserRoles();
    } else if (url.includes('/admin/data-points')) {
      this.activeTab.set('datapoints');
      this.loadDataPoints();
    } else if (url.includes('/admin/tariffs')) {
      this.activeTab.set('tariffs');
      this.loadTariffs();
    } else if (url.includes('/admin/masters')) {
      this.activeTab.set('masters');
      this.loadSectors();
      this.loadCountries();
    } else if (url.includes('/admin/batches')) {
      this.activeTab.set('batches');
      this.loadBatches();
    } else {
      this.activeTab.set('organisations');
    }
  }"""

new_init = """  ngOnInit(): void {
    this.syncTabFromUrl(this.router.url);

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.syncTabFromUrl(event.urlAfterRedirects || event.url);
      });
  }

  syncTabFromUrl(url: string): void {
    if (url.includes('/admin/users')) {
      this.activeTab.set('users');
      if (this.users().length === 0) {
        this.loadUsers();
        this.loadUserRoles();
      }
    } else if (url.includes('/admin/data-points')) {
      this.activeTab.set('datapoints');
      if (this.dataPoints().length === 0) {
        this.loadDataPoints();
      }
    } else if (url.includes('/admin/tariffs')) {
      this.activeTab.set('tariffs');
      if (this.tariffs().length === 0) {
        this.loadTariffs();
      }
    } else if (url.includes('/admin/masters')) {
      this.activeTab.set('masters');
      if (this.sectors().length === 0) {
        this.loadSectors();
        this.loadCountries();
      }
    } else if (url.includes('/admin/batches')) {
      this.activeTab.set('batches');
      if (this.batches().length === 0) {
        this.loadBatches();
      }
    } else {
      this.activeTab.set('organisations');
      if (this.tenants().length === 0) {
        this.refreshTenants();
      }
    }
  }"""

if old_init in a_code:
    a_code = a_code.replace(old_init, new_init)
    with open(path_admin, 'w', encoding='utf-8') as f:
        f.write(a_code)
    print('Updated AdminComponent with strict lazy-loaded tabs and deduplication')
else:
    print('AdminComponent ngOnInit pattern not matched or already updated')

