import { inject } from '@angular/core';
import { Route, Routes } from '@angular/router';
import { SignInComponent } from './features/auth/sign-in.component';
import { landingGuard } from './core/guards/landing.guard';
import { permissionGuard, sessionGuard } from './core/guards/session.guard';
import { SessionService } from './core/session/session.service';
import { PageTab } from './shared/ui/tabbed-page.component';

/** A platform screen under /app: lazy-loaded and guarded by its permission. */
function screen(path: string, permission: string, title: string, loadComponent: Route['loadComponent']): Route {
  return { path, loadComponent, canActivate: [permissionGuard], data: { permission }, title: `${title} — Compliance Hub` };
}

/** A page whose sections are existing screens shown as tabs; it opens on the first tab the user may see. */
function tabbedPage(path: string, tabs: (PageTab & { title: string; load: Route['loadComponent'] })[]): Route {
  return {
    path,
    loadComponent: () => import('./shared/ui/tabbed-page.component').then((m) => m.TabbedPageComponent),
    data: { tabs: tabs.map(({ label, path: p, permission }) => ({ label, path: p, permission })) },
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: () => {
          const session = inject(SessionService);
          return (tabs.find((t) => session.can(t.permission)) ?? tabs[0]).path;
        },
      },
      ...tabs.map((t) => screen(t.path, t.permission ?? '', t.title, t.load)),
    ],
  };
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
      // Platform (Monk Spaces)
      screen('workspaces', 'platform.tenants.read', 'Client workspaces', () => import('./screens/workspaces/workspaces.component').then((m) => m.WorkspacesComponent)),
      screen('users', 'platform.users.manage', 'Users', () => import('./screens/users/users.component').then((m) => m.UsersComponent)),
      screen('data-points', 'platform.datapoints.read', 'Data points', () => import('./screens/data-points/data-points.component').then((m) => m.DataPointsComponent)),
      screen('data-explorer', 'platform.datapoints.read', 'Data explorer', () => import('./screens/data-explorer/data-explorer.component').then((m) => m.DataExplorerComponent)),
      screen('gap-rules', 'platform.rules.manage', 'Gap rules', () => import('./screens/gap-rules/gap-rules.component').then((m) => m.GapRulesComponent)),
      // Overview
      tabbedPage('setup', [
        { label: 'Data connections', path: 'connections', permission: 'imports.manage', title: 'Data connections', load: () => import('./screens/data-sources/data-sources.component').then((m) => m.DataSourcesComponent) },
        { label: 'People', path: 'people', permission: 'users.manage', title: 'People', load: () => import('./screens/team/team.component').then((m) => m.TeamComponent) },
      ]),
      // Data
      tabbedPage('data', [
        { label: 'Overview', path: 'overview', permission: 'data.read', title: 'Data collection', load: () => import('./screens/data-overview/data-overview.component').then((m) => m.DataOverviewComponent) },
        { label: 'Import', path: 'import', permission: 'imports.manage', title: 'Import', load: () => import('./screens/import/import.component').then((m) => m.ImportComponent) },
      ]),
      screen('gaps', 'gaps.read', 'Data gaps', () => import('./screens/gaps/gaps.component').then((m) => m.GapsComponent)),
      screen('validation', 'products.read', 'Data validation', () => import('./screens/validation/validation.component').then((m) => m.ValidationComponent)),
      screen('products', 'products.read', 'SKU library', () => import('./screens/products/products.component').then((m) => m.ProductsComponent)),
      screen('products/:sku', 'products.read', 'SKU', () => import('./screens/products/product-detail.component').then((m) => m.ProductDetailComponent)),
      // Comply
      screen('compliance', 'compliance.read', 'Compliance', () => import('./screens/compliance/compliance.component').then((m) => m.ComplianceComponent)),
      screen('compliance/declarations/:sku', 'module.ppwr', 'Declaration of Conformity', () => import('./screens/compliance/declaration.component').then((m) => m.DeclarationComponent)),
      // Insights
      { ...screen('insights', 'module.epr', 'Hotspots', () => import('./screens/insights/insights.component').then((m) => m.InsightsComponent)), data: { permission: 'module.epr', view: 'hotspots' } },
      { ...screen('scenarios', 'module.epr', 'Scenarios', () => import('./screens/insights/insights.component').then((m) => m.InsightsComponent)), data: { permission: 'module.epr', view: 'scenarios' } },
      screen('horizon', 'compliance.read', 'Horizon scanning', () => import('./screens/horizon/horizon.component').then((m) => m.HorizonComponent)),
      screen('actions', 'compliance.read', 'Actions', () => import('./screens/actions/actions.component').then((m) => m.ActionsComponent)),
      // Earlier addresses
      { path: 'team', redirectTo: 'setup/people' },
      { path: 'data-sources', redirectTo: 'setup/connections' },
      { path: 'import', redirectTo: 'data/import' },
      { path: 'data-overview', redirectTo: 'data/overview' },
    ],
  },
  {
    path: 'no-permission',
    loadComponent: () => import('./features/shell/no-permission.component').then((m) => m.NoPermissionComponent),
    title: 'No access — Compliance Hub',
  },
  { path: '**', redirectTo: 'app' },
];
