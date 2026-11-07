import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService, AuthUser } from '../../core/services/auth.service';
import { TenantApiService, BackendTenantRecord } from '../../core/services/tenant-api.service';
import { ToastService } from '../../core/services/toast.service';
import {
  FoundationApiService,
  SkuImportItem,
  SkuImportPayload,
  SkuImportResponse,
  IngestionBatch,
} from '../../core/services/foundation-api.service';
import {
  ConfigApiService,
  MasterDataResponse,
  TariffRate,
  SectorConfig,
  CountryConfig,
  UserRoleConfig,
  DataPointDefinition,
} from '../../core/services/config-api.service';

type AdminTab = 'organisations' | 'users' | 'datapoints' | 'tariffs' | 'masters' | 'batches';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent implements OnInit {
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);
  readonly tenantService = inject(TenantApiService);
  readonly toastService = inject(ToastService);
  readonly foundationService = inject(FoundationApiService);
  readonly configService = inject(ConfigApiService);

  readonly activeTab = signal<AdminTab>('organisations');
  readonly loading = this.tenantService.loading;
  readonly tenants = this.tenantService.tenants;
  readonly batches = signal<IngestionBatch[]>([]);
  readonly masterData = signal<MasterDataResponse | null>(null);
  readonly tariffs = signal<TariffRate[]>([]);
  readonly dataPoints = signal<DataPointDefinition[]>([]);
  readonly sectors = signal<SectorConfig[]>([]);
  readonly countries = signal<CountryConfig[]>([]);
  readonly userRoles = signal<UserRoleConfig[]>([]);
  readonly dpSearchQuery = signal<string>('');
  readonly dpSourceFilter = signal<string>('ALL');
  readonly tariffSearchQuery = signal<string>('');
  readonly tariffJurisdictionFilter = signal<string>('ALL');

  // Platform Metrics
  readonly totalOrgs = computed(() => this.tenants().length);
  readonly totalProducts = computed(() =>
    this.tenants().reduce((sum, t) => sum + (t.active_products_count || 0), 0)
  );
  readonly totalIssues = computed(() =>
    this.tenants().reduce((sum, t) => sum + (t.open_quality_issues_count || 0), 0)
  );
  readonly orgsWithIssues = computed(
    () => this.tenants().filter((t) => (t.open_quality_issues_count || 0) > 0).length
  );

  // Enterprise User Management & IAM State
  readonly users = signal<AuthUser[]>([]);
  readonly usersLoading = signal<boolean>(false);
  readonly userSearchQuery = signal<string>('');
  readonly userFilterOrg = signal<string>('ALL');
  readonly userFilterRole = signal<string>('ALL');
  readonly selectedUserForCreds = signal<AuthUser | null>(null);
  readonly showCredsModal = signal<boolean>(false);
  readonly showInviteModal = signal<boolean>(false);
  readonly copiedNotice = signal<string | null>(null);
  readonly inviteError = signal<string | null>(null);
  readonly inviteSuccess = signal<string | null>(null);

  // User Provision Form Model
  newUserName = '';
  newUserEmail = '';
  newUserRole = 'org_admin';
  newUserTenantId = '';
  newUserPassword = 'password123';
  readonly isProvisioning = signal<boolean>(false);

  // Filtered Users Computed
  readonly filteredUsers = computed(() => {
    const list = this.users();
    const query = this.userSearchQuery().toLowerCase().trim();
    const org = this.userFilterOrg();
    const role = this.userFilterRole();

    return list.filter((u) => {
      const matchesSearch =
        !query ||
        u.fullName.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        (u.organisationName && u.organisationName.toLowerCase().includes(query));

      const orgLower = org.toLowerCase().trim();
      const matchesOrg =
        org === 'ALL' ||
        (org === 'platform' && !u.organisationId) ||
        u.organisationId === org ||
        (u.organisationSlug && u.organisationSlug.toLowerCase().trim() === orgLower) ||
        (u.organisationName && u.organisationName.toLowerCase().trim() === orgLower);

      const matchesRole = role === 'ALL' || u.role === role;

      return matchesSearch && matchesOrg && matchesRole;
    });
  });

  readonly totalUsersCount = computed(() => this.users().length);
  readonly clientAdminsCount = computed(
    () => this.users().filter((u) => u.role === 'org_admin').length
  );
  readonly analystsCount = computed(
    () => this.users().filter((u) => u.role === 'analyst' || u.role === 'viewer').length
  );

  // Onboarding Modal State
  readonly showOnboardModal = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly onboardError = signal<string | null>(null);
  readonly onboardSuccess = signal<string | null>(null);

  // Onboard Form Model
  newOrgName = '';
  newOrgSlug = '';
  newOrgSector = 'Food & Beverage / FMCG';
  newOrgCurrency = 'EUR';
  newOrgJurisdiction = 'FR';
  newOrgTier = 'enterprise';
  moduleEpr = true;
  modulePpwr = true;
  moduleDpp = false;
  moduleCosting = false;

  // Initial Org Administrator User
  adminFullName = '';
  adminEmail = '';
  adminPassword = 'password123';


  // Module Entitlement & Workspace Branding Modal State
  readonly showModulesModal = signal<boolean>(false);
  readonly selectedOrgForModules = signal<BackendTenantRecord | null>(null);
  readonly isUpdatingModules = signal<boolean>(false);
  readonly moduleSaveSuccess = signal<string | null>(null);
  readonly moduleSaveError = signal<string | null>(null);
  orgNameEdit = '';
  orgThemeColorEdit = '#111827';
  orgLogoUrlEdit = '';
  readonly orgUploadedLogoBase64 = signal<string | null>(null);
  modEpr = true;
  modPpwr = true;
  modDpp = true;
  modLca = true;

  // SKU Import & Mapping Modal State
  readonly showImportModal = signal<boolean>(false);
  readonly showSchemaGuide = signal<boolean>(false);
  readonly selectedTenantForImport = signal<string>('');
  readonly importSourceName = signal<string>('Catalog_SKU_Feed_2025.csv');
  readonly importMode = signal<'sample' | 'paste' | 'file'>('sample');
  readonly csvTextInput = signal<string>('');
  readonly parsedSkus = signal<SkuImportItem[]>([]);
  readonly isImporting = signal<boolean>(false);
  readonly importResult = signal<SkuImportResponse | null>(null);
  readonly importError = signal<string | null>(null);

  // Sample SKU Dataset for 1-Click Verification
  private readonly sampleRows: SkuImportItem[] = [
    {
      sku: 'SKU-CRACKER-200G',
      name: 'Artisan Sea Salt Crackers 200g',
      brand: 'Heritage Kitchen',
      category: 'Biscuits & Crackers',
      material: 'PP (Polypropylene)',
      packaging_weight_grams: 18.5,
      recycled_content_pct: 30.0,
      is_recyclable: true,
      units_sold: 45000,
      jurisdiction: 'FR',
    },
    {
      sku: 'SKU-TOMATO-400G',
      name: 'Organic Crushed Tomatoes 400g Can',
      brand: 'Heritage Kitchen',
      category: 'Canned Goods',
      material: 'Steel / Tinplate',
      packaging_weight_grams: 44.0,
      recycled_content_pct: 0.0,
      is_recyclable: true,
      units_sold: 110000,
      jurisdiction: 'FR',
    },
    {
      sku: 'SKU-TONIC-330ML',
      name: 'Premium Tonic Water 330ml Glass',
      brand: 'Botanical Brews',
      category: 'Beverages',
      material: 'Glass',
      packaging_weight_grams: null, // Deliberate gap: Missing Weight!
      recycled_content_pct: 0.0,
      is_recyclable: true,
      units_sold: 85000,
      jurisdiction: 'FR',
    },
    {
      sku: 'SKU-SNACKBOX-MULTI',
      name: 'On-the-Go Snack Box Multipack',
      brand: 'Heritage Kitchen',
      category: 'Snacks & Confectionery',
      material: '', // Deliberate gap: Missing Material Substrate!
      packaging_weight_grams: 12.0,
      recycled_content_pct: 0.0,
      is_recyclable: true,
      units_sold: 22000,
      jurisdiction: 'FR',
    },
  ];

  ngOnInit(): void {
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
  }

  loadDataPoints(): void {
    this.configService.getDataPoints().subscribe({
      next: (dps) => this.dataPoints.set(dps),
      error: (err) => console.warn('Failed loading data points', err),
    });
  }

  loadTariffs(): void {
    this.configService.getTariffs().subscribe({
      next: (t) => this.tariffs.set(t),
      error: (err) => console.warn('Failed loading tariffs', err),
    });
  }

  loadSectors(): void {
    this.configService.getSectors().subscribe({
      next: (s) => this.sectors.set(s),
      error: (err) => console.warn('Failed loading sectors', err),
    });
  }

  loadCountries(): void {
    this.configService.getCountries().subscribe({
      next: (c) => this.countries.set(c),
      error: (err) => console.warn('Failed loading countries', err),
    });
  }

  loadUserRoles(): void {
    this.configService.getUserRoles().subscribe({
      next: (r) => this.userRoles.set(r),
      error: (err) => console.warn('Failed loading user roles via RBAC', err),
    });
  }

  getFilteredTariffs(): TariffRate[] {
    const q = this.tariffSearchQuery().toLowerCase().trim();
    const jur = this.tariffJurisdictionFilter();
    return this.tariffs().filter((t) => {
      const matchQ =
        !q ||
        t.material_name.toLowerCase().includes(q) ||
        t.material_code.toLowerCase().includes(q) ||
        t.source_citation.toLowerCase().includes(q);
      const matchJur =
        jur === 'ALL' || t.jurisdiction.toUpperCase().includes(jur.toUpperCase());
      return matchQ && matchJur;
    });
  }

  getFilteredDataPoints(): DataPointDefinition[] {
    const list = this.dataPoints();
    const q = this.dpSearchQuery().toLowerCase().trim();
    const src = this.dpSourceFilter();

    return list.filter((dp) => {
      const matchesSearch =
        !q ||
        dp.id.toLowerCase().includes(q) ||
        dp.name.toLowerCase().includes(q) ||
        dp.description.toLowerCase().includes(q) ||
        dp.comes_from.toLowerCase().includes(q);

      const matchesSrc =
        src === 'ALL' ||
        (src === 'ERP' && dp.comes_from.toLowerCase().includes('erp')) ||
        (src === 'PLM' && dp.comes_from.toLowerCase().includes('plm')) ||
        (src === 'SUPPLIER' && dp.comes_from.toLowerCase().includes('supplier')) ||
        (src === 'LAB' && dp.comes_from.toLowerCase().includes('lab'));

      return matchesSearch && matchesSrc;
    });
  }

  loadMasterData(): void {
    this.configService.getMasterData().subscribe({
      next: (data) => {
        this.masterData.set(data);
        this.tariffs.set(data.tariffs);
      },
      error: (err) => console.warn('Failed loading master data catalog', err),
    });
  }

  refreshTenants(): void {
    this.tenantService.loadTenants().subscribe({
      next: (data) => {
        if (data.length > 0 && !this.selectedTenantForImport()) {
          this.selectedTenantForImport.set(data[0].id);
        }
        this.loadBatches();
      },
    });
  }

  loadBatches(): void {
    const tid = this.tenantService.activeTenantId() || (this.tenants()[0]?.id ?? 'khc-europe');
    this.foundationService.getBatches(tid).subscribe({
      next: (batches) => this.batches.set(batches),
      error: () => this.batches.set([]),
    });
  }

  setTab(tab: AdminTab): void {
    this.activeTab.set(tab);
    let subpath = 'workspaces';
    if (tab === 'datapoints') subpath = 'data-points';
    else if (tab !== 'organisations') subpath = tab;

    this.router.navigate(['/admin', subpath]);
    if (tab === 'batches') {
      this.loadBatches();
    } else if (tab === 'tariffs') {
      this.loadTariffs();
    } else if (tab === 'datapoints') {
      this.loadDataPoints();
    } else if (tab === 'masters') {
      this.loadSectors();
      this.loadCountries();
    } else if (tab === 'users') {
      this.loadUsers();
      this.loadUserRoles();
    }
  }
  // ─── User Management & IAM Actions ───
  loadUsers(): void {
    this.usersLoading.set(true);
    this.authService.getUsers().subscribe({
      next: (data) => {
        this.users.set(data);
        this.usersLoading.set(false);
      },
      error: (err) => {
        console.warn('Failed loading user directory', err);
        this.usersLoading.set(false);
      },
    });
  }

  openInviteModal(): void {
    this.newUserName = '';
    this.newUserEmail = '';
    this.newUserRole = 'org_admin';
    this.newUserTenantId = this.tenants()[0]?.id || 'khc-europe';
    this.newUserPassword = 'password123';
    this.inviteError.set(null);
    this.inviteSuccess.set(null);
    this.showInviteModal.set(true);
  }

  closeInviteModal(): void {
    this.showInviteModal.set(false);
  }

  submitProvisionUser(): void {
    if (!this.newUserName.trim() || !this.newUserEmail.trim()) {
      this.inviteError.set('Please provide both full name and valid work email.');
      return;
    }
    const tenant = this.tenants().find((t) => t.id === this.newUserTenantId);
    const orgName = tenant?.name || 'Client Workspace';

    this.isProvisioning.set(true);
    this.inviteError.set(null);

    this.authService
      .provisionUser({
        fullName: this.newUserName.trim(),
        email: this.newUserEmail.trim().toLowerCase(),
        role: this.newUserRole,
        tenantId: this.newUserTenantId,
        organisationName: orgName,
        password: this.newUserPassword || 'password123',
      })
      .subscribe({
        next: (created) => {
          this.isProvisioning.set(false);
          this.inviteSuccess.set(`Successfully provisioned account for ${created.fullName}.`);
          this.userFilterOrg.set('ALL');
          this.userFilterRole.set('ALL');
          this.userSearchQuery.set('');
          this.loadUsers();
          setTimeout(() => {
            this.closeInviteModal();
            this.openCredsModal(created);
          }, 800);
        },
        error: (err) => {
          this.isProvisioning.set(false);
          this.inviteError.set(
            err?.error?.detail || err.message || 'Failed to provision enterprise user.'
          );
        },
      });
  }

  openCredsModal(user: AuthUser): void {
    this.selectedUserForCreds.set(user);
    this.copiedNotice.set(null);
    this.showCredsModal.set(true);
  }

  closeCredsModal(): void {
    this.showCredsModal.set(false);
    this.selectedUserForCreds.set(null);
  }

  copyCredentials(user: AuthUser | null): void {
    if (!user) return;
    const credsText = `Enterprise Compliance Portal Credentials:
User: ${user.fullName} (${user.role.toUpperCase()})
Workspace: ${user.organisationName || 'Platform Admin'}
Email: ${user.email}
Initial Password: password123
Login URL: ${window.location.origin}/sign-in`;

    navigator.clipboard.writeText(credsText).then(() => {
      this.copiedNotice.set('Credentials copied to clipboard!');
      setTimeout(() => this.copiedNotice.set(null), 3000);
    });
  }


  // ─── Company Onboarding ───
  openOnboardModal(): void {
    this.newOrgName = '';
    this.newOrgSlug = '';
    this.newOrgSector = 'Food & Beverage / FMCG';
    this.newOrgCurrency = 'EUR';
    this.newOrgJurisdiction = 'FR';
    this.newOrgTier = 'enterprise';
    this.moduleEpr = true;
    this.modulePpwr = true;
    this.moduleDpp = false;
    this.moduleCosting = false;
    this.adminFullName = '';
    this.adminEmail = '';
    this.adminPassword = 'password123';
    this.onboardError.set(null);
    this.onboardSuccess.set(null);
    this.showOnboardModal.set(true);
  }

  closeOnboardModal(): void {
    this.showOnboardModal.set(false);
  }

  onOrgNameChange(): void {
    if (!this.newOrgSlug || this.newOrgSlug.trim() === '') {
      this.newOrgSlug = this.newOrgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
    if (!this.adminEmail || this.adminEmail.endsWith('.com')) {
      const cleanSlug = this.newOrgSlug || 'company';
      this.adminEmail = `admin@${cleanSlug}.com`;
    }
  }

  submitOnboardOrg(): void {
    if (!this.newOrgName.trim()) {
      this.onboardError.set('Legal company name is required.');
      return;
    }
    if (!this.newOrgSlug.trim()) {
      this.onboardError.set('Organisation code/slug is required.');
      return;
    }

    this.isSubmitting.set(true);
    this.onboardError.set(null);

    const payload = {
      id: this.newOrgSlug.trim().toLowerCase(),
      name: this.newOrgName.trim(),
      sector: this.newOrgSector,
      primaryCurrency: this.newOrgCurrency,
      activeJurisdictions: [this.newOrgJurisdiction],
      tier: this.newOrgTier,
      adminEmail: this.adminEmail.trim() || undefined,
      adminName: this.adminFullName.trim() || `${this.newOrgName.trim()} Admin`,
      adminPassword: this.adminPassword || 'password123',
    };

    this.tenantService.createTenantWorkspace(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        const adminMsg = payload.adminEmail ? ` and admin account "${payload.adminEmail}"` : '';
        this.onboardSuccess.set(`Successfully provisioned workspace "${payload.name}"${adminMsg}.`);
        setTimeout(() => {
          this.closeOnboardModal();
          this.refreshTenants();
          this.loadUsers();
        }, 1200);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.onboardError.set(
          err?.error?.detail || err.message || 'Failed to provision tenant workspace.'
        );
      },
    });
  }

  // ─── SKU Import & Column Mapping ───
  hasModule(org: BackendTenantRecord, key: string): boolean {
    const mods = org.active_modules || ['epr', 'ppwr', 'dpp', 'lca'];
    return mods.includes(key);
  }

  openModulesModal(org: BackendTenantRecord): void {
    this.selectedOrgForModules.set(org);
    this.orgNameEdit = org.name;
    this.orgThemeColorEdit = org.theme_color || '#111827';
    let defaultLogo = org.logo_url || '';
    if (!defaultLogo) {
      if (org.id === 'khc-europe' || org.name.toLowerCase().includes('kraft')) {
        defaultLogo = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Kraft_Heinz_Logo.svg/320px-Kraft_Heinz_Logo.svg.png';
      } else if (org.id === 'nordhavn-spirits' || org.name.toLowerCase().includes('nordhavn')) {
        defaultLogo = 'https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=120&auto=format&fit=crop&q=80';
      }
    }
    this.orgLogoUrlEdit = defaultLogo;
    this.orgUploadedLogoBase64.set(null);
    const mods = org.active_modules || ['epr', 'ppwr', 'dpp', 'lca'];
    this.modEpr = mods.includes('epr');
    this.modPpwr = mods.includes('ppwr');
    this.modDpp = mods.includes('dpp');
    this.modLca = mods.includes('lca');
    this.moduleSaveSuccess.set(null);
    this.moduleSaveError.set(null);
    this.showModulesModal.set(true);
  }

  onOrgLogoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawRes = e.target?.result as string;
        // Compress and resize image using HTML5 Canvas to keep payload ultra-lightweight (<25KB)
        const img = new Image();
        img.onload = () => {
          const maxW = 240;
          const maxH = 100;
          let w = img.width;
          let h = img.height;
          if (w > maxW || h > maxH) {
            const ratio = Math.min(maxW / w, maxH / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const optimized = canvas.toDataURL('image/png', 0.9);
            this.orgUploadedLogoBase64.set(optimized);
            this.orgLogoUrlEdit = optimized;
          } else {
            this.orgUploadedLogoBase64.set(rawRes);
            this.orgLogoUrlEdit = rawRes;
          }
        };
        img.src = rawRes;
      };
      reader.readAsDataURL(file);
    }
  }

  closeModulesModal(): void {
    this.showModulesModal.set(false);
    this.selectedOrgForModules.set(null);
  }

  submitModuleEntitlements(): void {
    const org = this.selectedOrgForModules();
    if (!org) return;
    const activeList: string[] = [];
    if (this.modEpr) activeList.push('epr');
    if (this.modPpwr) activeList.push('ppwr');
    if (this.modDpp) activeList.push('dpp');
    if (this.modLca) activeList.push('lca');
    this.isUpdatingModules.set(true);
    this.moduleSaveError.set(null);

    const updatePayload: Partial<BackendTenantRecord> = {
      name: this.orgNameEdit.trim() || org.name,
      theme_color: this.orgThemeColorEdit,
      logo_url: this.orgUploadedLogoBase64() || this.orgLogoUrlEdit.trim() || undefined,
      active_modules: activeList,
    };

    this.tenantService.updateTenantWorkspace(org.id, updatePayload).subscribe({
      next: (updated) => {
        this.isUpdatingModules.set(false);
        this.moduleSaveSuccess.set(`Workspace "${updated.name}" updated successfully!`);
        this.toastService.show(`✓ Workspace "${updated.name}" theme & configuration updated`, 'success');
        setTimeout(() => {
          this.closeModulesModal();
          this.refreshTenants();
        }, 800);
      },
      error: (err) => {
        this.isUpdatingModules.set(false);
        this.moduleSaveError.set(err.message || 'Failed to update workspace configuration');
      },
    });
  }

  openImportModal(tenantId?: string): void {
    if (tenantId) {
      this.selectedTenantForImport.set(tenantId);
    } else if (this.tenants().length > 0) {
      this.selectedTenantForImport.set(this.tenants()[0].id);
    }
    this.importResult.set(null);
    this.importError.set(null);
    this.loadSampleData();
    this.showImportModal.set(true);
  }

  closeImportModal(): void {
    this.showImportModal.set(false);
    this.importResult.set(null);
    this.importError.set(null);
  }

  setImportMode(mode: 'sample' | 'paste' | 'file'): void {
    this.importMode.set(mode);
    if (mode === 'sample') {
      this.loadSampleData();
    } else if (mode === 'paste') {
      this.generateCsvSampleText();
    }
  }

  loadSampleData(): void {
    this.parsedSkus.set([...this.sampleRows]);
    this.importSourceName.set('Sample_FMCG_Catalog_2025.csv');
  }

  toggleSchemaGuide(): void {
    this.showSchemaGuide.update((v) => !v);
  }

  downloadSampleCsvTemplate(): void {
    const headers = [
      'sku',
      'name',
      'brand',
      'category',
      'material',
      'packaging_weight_grams',
      'recycled_content_pct',
      'units_sold',
      'jurisdiction',
    ];
    const rows = [
      'SKU-CRACKER-200G,"Artisan Sea Salt Crackers 200g","Heritage Kitchen","Biscuits & Crackers","PP (Polypropylene)",18.5,30,45000,FR',
      'SKU-TOMATO-400G,"Organic Crushed Tomatoes 400g Can","Heritage Kitchen","Canned Goods","Steel / Tinplate",44.0,0,110000,FR',
      'SKU-TONIC-330ML,"Premium Tonic Water 330ml Glass","Botanical Brews","Beverages","Glass",220.0,0,85000,UK',
      'SKU-OATMILK-1L,"Organic Barista Oat Drink 1L","Nordic Oats","Dairy Alternatives","Liquid Packaging Board (Tetra Pak / Composite)",32.0,0,60000,DK',
      'SKU-SHAMPOO-250ML,"Daily Hydration Shampoo 250ml","EcoCare","Personal Care","HDPE (Rigid)",28.0,50,92000,DE',
    ];
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'ComplianceHub_Canonical_SKU_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  generateCsvSampleText(): void {
    const header = 'sku,name,brand,category,material,packaging_weight_grams,recycled_content_pct,units_sold,jurisdiction';
    const lines = this.sampleRows.map(
      (r) =>
        `${r.sku},"${r.name}","${r.brand}","${r.category}","${r.material || ''}",${r.packaging_weight_grams ?? ''},${r.recycled_content_pct ?? 0},${r.units_sold ?? 0},${r.jurisdiction}`
    );
    this.csvTextInput.set([header, ...lines].join('\n'));
    this.parseCsvInput();
  }

  onCsvTextChange(text: string): void {
    this.csvTextInput.set(text);
    this.parseCsvInput();
  }

  parseCsvInput(): void {
    const raw = this.csvTextInput().trim();
    if (!raw) {
      this.parsedSkus.set([]);
      return;
    }

    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      this.parsedSkus.set([]);
      return;
    }

    // Basic CSV parser supporting quotes
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));
    const skuIdx = headers.findIndex(
      (h) => h.includes('sku') || h.includes('code') || h.includes('id') || h.includes('matnr') || h.includes('article') || h.includes('item')
    );
    const nameIdx = headers.findIndex(
      (h) => h.includes('name') || h.includes('title') || h.includes('desc') || h.includes('designation') || h.includes('label')
    );
    const brandIdx = headers.findIndex((h) => h.includes('brand') || h.includes('make') || h.includes('mfr') || h.includes('marque'));
    const catIdx = headers.findIndex((h) => h.includes('cat') || h.includes('segment') || h.includes('group') || h.includes('family'));
    const matIdx = headers.findIndex(
      (h) => h.includes('mat') || h.includes('subst') || h.includes('polymer') || h.includes('substrate') || h.includes('pkg')
    );
    const weightIdx = headers.findIndex(
      (h) => h.includes('weight') || h.includes('tare') || h.includes('gram') || h.includes('mass') || h.includes('poids') || h.includes('gew')
    );
    const pcrIdx = headers.findIndex((h) => h.includes('pcr') || h.includes('recycled') || h.includes('recyc'));
    const salesIdx = headers.findIndex(
      (h) => h.includes('sale') || h.includes('unit') || h.includes('volume') || h.includes('qty') || h.includes('menge')
    );
    const jurIdx = headers.findIndex(
      (h) => h.includes('jur') || h.includes('country') || h.includes('market') || h.includes('geo') || h.includes('iso') || h.includes('land')
    );

    const items: SkuImportItem[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      if (cols.length === 0 || !cols[0]) continue;

      const sku = skuIdx >= 0 ? cols[skuIdx] : cols[0];
      const name = nameIdx >= 0 ? cols[nameIdx] : (cols[1] || sku);
      const brand = brandIdx >= 0 ? cols[brandIdx] : 'Standard Brand';
      const category = catIdx >= 0 ? cols[catIdx] : 'General';
      const material = matIdx >= 0 ? cols[matIdx] : '';
      const rawWeight = weightIdx >= 0 ? cols[weightIdx] : '';
      const weight = rawWeight && !isNaN(Number(rawWeight)) ? Number(rawWeight) : null;
      const rawPcr = pcrIdx >= 0 ? cols[pcrIdx] : '0';
      const pcr = rawPcr && !isNaN(Number(rawPcr)) ? Number(rawPcr) : 0;
      const rawSales = salesIdx >= 0 ? cols[salesIdx] : '0';
      const sales = rawSales && !isNaN(Number(rawSales)) ? Number(rawSales) : null;
      const jur = jurIdx >= 0 && cols[jurIdx] ? cols[jurIdx] : 'FR';

      items.push({
        sku,
        name,
        brand,
        category,
        material,
        packaging_weight_grams: weight,
        recycled_content_pct: pcr,
        is_recyclable: true,
        units_sold: sales,
        jurisdiction: jur,
      });
    }

    this.parsedSkus.set(items);
  }

  handleFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.importSourceName.set(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      this.csvTextInput.set(text);
      this.parseCsvInput();
    };
    reader.readAsText(file);
  }

  handleFileDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.csv')) {
        this.importSourceName.set(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = (e.target?.result as string) || '';
          this.csvTextInput.set(text);
          this.parseCsvInput();
        };
        reader.readAsText(file);
      } else {
        this.importError.set('Please upload a valid CSV file (.csv extension).');
      }
    }
  }

  executeImport(): void {
    const targetTenant = this.selectedTenantForImport();
    if (!targetTenant) {
      this.importError.set('Please select an organisation to import data into.');
      return;
    }

    const items = this.parsedSkus();
    if (items.length === 0) {
      this.importError.set('No valid SKU rows parsed. Please check your data format.');
      return;
    }

    this.isImporting.set(true);
    this.importError.set(null);

    const payload: SkuImportPayload = {
      tenant_id: targetTenant,
      source_name: this.importSourceName(),
      items: items,
    };

    this.foundationService.importSkus(payload).subscribe({
      next: (res) => {
        this.isImporting.set(false);
        this.importResult.set(res);
        // Refresh tenants to update live product & quality issue counts
        this.tenantService.loadTenants().subscribe();
      },
      error: (err) => {
        this.isImporting.set(false);
        this.importError.set(
          err?.error?.detail || err.message || 'Failed to import SKU records into database.'
        );
      },
    });
  }

  goToOnboarding(): void {
    this.router.navigate(['/onboarding']);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/sign-in']);
  }
}
