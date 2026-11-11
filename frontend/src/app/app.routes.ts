import { Route, Routes } from '@angular/router';
import { SignInComponent } from './features/auth/sign-in.component';
import { landingGuard } from './core/guards/landing.guard';
import { permissionGuard, sessionGuard } from './core/guards/session.guard';

/** A platform screen under /app: lazy-loaded and guarded by its permission. */
function screen(path: string, permission: string, title: string, loadComponent: Route['loadComponent']): Route {
  return { path, loadComponent, canActivate: [permissionGuard], data: { permission }, title: `${title} — Compliance Hub` };
}

export const routes: Routes = [
  { path: '', redirectTo: 'app', pathMatch: 'full' },
  { path: 'sign-in', component: SignInComponent, title: 'Sign in — Compliance Hub' },
  {
    path: 'workspace',
    canActivate: [sessionGuard],
    loadComponent: () => import('./features/auth/workspace-picker.component').then((m) => m.WorkspacePickerComponent),
    title: 'Choose a workspace — Compliance Hub',
  },
  {
    path: 'app',
    canActivate: [sessionGuard],
    loadComponent: () => import('./features/shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: '', pathMatch: 'full', canActivate: [landingGuard], loadComponent: () => import('./features/shell/home.component').then((m) => m.HomeComponent), title: 'Compliance Hub' },
      screen('workspaces', 'platform.tenants.read', 'Client workspaces', () => import('./screens/workspaces/workspaces.component').then((m) => m.WorkspacesComponent)),
      screen('data-points', 'platform.datapoints.read', 'Data points', () => import('./screens/data-points/data-points.component').then((m) => m.DataPointsComponent)),
      screen('gap-rules', 'platform.rules.manage', 'Gap rules', () => import('./screens/gap-rules/gap-rules.component').then((m) => m.GapRulesComponent)),
      screen('team', 'users.manage', 'Team', () => import('./screens/team/team.component').then((m) => m.TeamComponent)),
      screen('users', 'platform.users.manage', 'Users', () => import('./screens/users/users.component').then((m) => m.UsersComponent)),
      screen('products', 'products.read', 'Products', () => import('./screens/products/products.component').then((m) => m.ProductsComponent)),
      screen('products/:sku', 'products.read', 'Product', () => import('./screens/products/product-detail.component').then((m) => m.ProductDetailComponent)),
      screen('data-sources', 'imports.manage', 'Data sources', () => import('./screens/data-sources/data-sources.component').then((m) => m.DataSourcesComponent)),
      screen('import', 'imports.manage', 'Import', () => import('./screens/import/import.component').then((m) => m.ImportComponent)),
      screen('gaps', 'gaps.read', 'Gaps', () => import('./screens/gaps/gaps.component').then((m) => m.GapsComponent)),
      screen('compliance', 'compliance.read', 'Compliance', () => import('./screens/compliance/compliance.component').then((m) => m.ComplianceComponent)),
      screen('compliance/declarations/:sku', 'module.ppwr', 'Declaration of Conformity', () => import('./screens/compliance/declaration.component').then((m) => m.DeclarationComponent)),
      screen('insights', 'module.epr', 'Hotspots and scenarios', () => import('./screens/insights/insights.component').then((m) => m.InsightsComponent)),
      screen('horizon', 'compliance.read', 'Horizon', () => import('./screens/horizon/horizon.component').then((m) => m.HorizonComponent)),
      screen('actions', 'compliance.read', 'Actions', () => import('./screens/actions/actions.component').then((m) => m.ActionsComponent)),
      screen('data-overview', 'data.read', 'Data overview', () => import('./screens/data-overview/data-overview.component').then((m) => m.DataOverviewComponent)),
    ],
  },
  {
    path: 'no-permission',
    loadComponent: () => import('./features/shell/no-permission.component').then((m) => m.NoPermissionComponent),
    title: 'No access — Compliance Hub',
  },
  { path: '**', redirectTo: 'app' },
];
