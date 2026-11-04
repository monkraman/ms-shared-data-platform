import { Routes } from '@angular/router';
import { SignInComponent } from './features/auth/sign-in.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { DataOverviewComponent } from './features/data-overview/data-overview.component';
import { ProductsComponent } from './features/products/products.component';
import { QualityComponent } from './features/quality/quality.component';
import { SimulatorComponent } from './features/simulator/simulator.component';
import { OnboardingComponent } from './features/onboarding/onboarding.component';
import { AdminComponent } from './features/admin/admin.component';
import { superAdminGuard, clientGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Default → sign-in
  { path: '', redirectTo: 'sign-in', pathMatch: 'full' },

  // Auth
  { path: 'sign-in', component: SignInComponent, title: 'Sign In — Compliance Hub' },

  // SuperAdmin Console Dedicated Routes (Strictly SuperAdmin)
  { path: 'admin', redirectTo: 'admin/workspaces', pathMatch: 'full' },
  { path: 'admin/workspaces', component: AdminComponent, canActivate: [superAdminGuard], title: 'Client Workspaces — SuperAdmin' },
  { path: 'admin/users', component: AdminComponent, canActivate: [superAdminGuard], title: 'User Directory & IAM — SuperAdmin' },
  { path: 'admin/tariffs', component: AdminComponent, canActivate: [superAdminGuard], title: 'Rule & Tariff Library — SuperAdmin' },
  { path: 'admin/masters', component: AdminComponent, canActivate: [superAdminGuard], title: 'Master Data Catalog — SuperAdmin' },
  { path: 'admin/batches', component: AdminComponent, canActivate: [superAdminGuard], title: 'Ingestion Batches — SuperAdmin' },
  { path: 'onboarding', component: OnboardingComponent, canActivate: [superAdminGuard], title: 'Client Setup — Compliance Hub' },

  // Client Workspace Routes (Restricted strictly to Client users)
  { path: 'dashboard', component: DashboardComponent, canActivate: [clientGuard], title: 'EPR Dashboard — Compliance Hub' },
  { path: 'data-overview', component: DataOverviewComponent, canActivate: [clientGuard], title: 'Data Overview — Compliance Hub' },
  { path: 'products', component: ProductsComponent, canActivate: [clientGuard], title: 'Pack Record BOM — Compliance Hub' },
  { path: 'quality', component: QualityComponent, canActivate: [clientGuard], title: 'Data Quality Worklist — Compliance Hub' },
  { path: 'simulator', component: SimulatorComponent, canActivate: [clientGuard], title: 'EPR Fee Simulator — Compliance Hub' },

  { path: '**', redirectTo: 'sign-in' },
];
