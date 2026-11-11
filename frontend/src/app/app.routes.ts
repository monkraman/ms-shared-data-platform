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

import { permissionGuard, sessionGuard } from './core/guards/session.guard';
import { landingGuard } from './core/guards/landing.guard';
import { Route } from '@angular/router';

/** A platform screen under /app: lazy-loaded and guarded by its permission. */
function screen(path: string, permission: string, title: string, loadComponent: Route['loadComponent']): Route {
  return { path, loadComponent, canActivate: [permissionGuard], data: { permission }, title: `${title} — Compliance Hub` };
}



export const routes: Routes = [

  // Default → sign-in

  { path: '', redirectTo: 'sign-in', pathMatch: 'full' },



  // Auth

  { path: 'sign-in', component: SignInComponent, title: 'Sign in — Compliance Hub' },

  {
    path: 'workspace',
    canActivate: [sessionGuard],
    loadComponent: () => import('./features/auth/workspace-picker.component').then((m) => m.WorkspacePickerComponent),
    title: 'Choose a workspace — Compliance Hub',
  },



  // SuperAdmin Console Dedicated Routes (Strictly SuperAdmin)

  { path: 'admin', redirectTo: 'admin/workspaces', pathMatch: 'full' },

  { path: 'admin/workspaces', component: AdminComponent, canActivate: [superAdminGuard], title: 'Client Workspaces — SuperAdmin' },

  { path: 'admin/users', component: AdminComponent, canActivate: [superAdminGuard], title: 'User Directory & IAM — SuperAdmin' },

  { path: 'admin/data-points', component: AdminComponent, canActivate: [superAdminGuard], title: 'Data Points Dictionary — SuperAdmin' },

  { path: 'admin/tariffs', component: AdminComponent, canActivate: [superAdminGuard], title: 'Rule & Tariff Library — SuperAdmin' },

  { path: 'admin/masters', component: AdminComponent, canActivate: [superAdminGuard], title: 'Countries & Sectors — SuperAdmin' },

  { path: 'admin/batches', component: AdminComponent, canActivate: [superAdminGuard], title: 'Ingestion Batches — SuperAdmin' },

  { path: 'onboarding', component: OnboardingComponent, canActivate: [superAdminGuard], title: 'Client Setup — Compliance Hub' },



  // Client Workspace Routes (Restricted strictly to Client users)

  { path: 'dashboard', component: DashboardComponent, canActivate: [clientGuard], title: 'EPR Dashboard — Compliance Hub' },

  { path: 'data-overview', component: DataOverviewComponent, canActivate: [clientGuard], title: 'Data Overview — Compliance Hub' },

  { path: 'data-map', redirectTo: 'data-overview', pathMatch: 'full' },

  { path: 'products', component: ProductsComponent, canActivate: [clientGuard], title: 'Pack Record BOM — Compliance Hub' },

  { path: 'quality', component: QualityComponent, canActivate: [clientGuard], title: 'Data Quality Worklist — Compliance Hub' },

  { path: 'simulator', component: SimulatorComponent, canActivate: [clientGuard], title: 'EPR Fee Simulator — Compliance Hub' },



  // Platform screens (Step 0 onwards): session from the API, navigation from permissions.

  {

    path: 'app',

    canActivate: [sessionGuard],

    loadComponent: () => import('./features/shell/app-shell.component').then((m) => m.AppShellComponent),

    children: [

      { path: '', pathMatch: 'full', canActivate: [landingGuard], loadComponent: () => import('./features/shell/home.component').then((m) => m.HomeComponent), title: 'Compliance Hub' },
      screen('workspaces', 'platform.tenants.read', 'Client workspaces', () => import('./screens/workspaces/workspaces.component').then((m) => m.WorkspacesComponent)),
      screen('data-points', 'platform.datapoints.read', 'Data points', () => import('./screens/data-points/data-points.component').then((m) => m.DataPointsComponent)),
      screen('gap-rules', 'platform.rules.manage', 'Gap rules', () => import('./screens/gap-rules/gap-rules.component').then((m) => m.GapRulesComponent)),
      screen('products', 'products.read', 'Products', () => import('./screens/products/products.component').then((m) => m.ProductsComponent)),
      screen('products/:sku', 'products.read', 'Product', () => import('./screens/products/product-detail.component').then((m) => m.ProductDetailComponent)),
      screen('import', 'imports.manage', 'Import', () => import('./screens/import/import.component').then((m) => m.ImportComponent)),
      screen('gaps', 'gaps.read', 'Gaps', () => import('./screens/gaps/gaps.component').then((m) => m.GapsComponent)),
      screen('data-overview', 'data.read', 'Data overview', () => import('./screens/data-overview/data-overview.component').then((m) => m.DataOverviewComponent)),

    ],

  },

  {

    path: 'no-permission',

    loadComponent: () => import('./features/shell/no-permission.component').then((m) => m.NoPermissionComponent),

    title: 'No access — Compliance Hub',

  },



  { path: '**', redirectTo: 'sign-in' },

];

