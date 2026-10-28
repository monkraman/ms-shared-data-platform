import { Routes } from '@angular/router';
import { SignInComponent } from './features/auth/sign-in.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ProductsComponent } from './features/products/products.component';
import { QualityComponent } from './features/quality/quality.component';
import { SimulatorComponent } from './features/simulator/simulator.component';
import { OnboardingComponent } from './features/onboarding/onboarding.component';
import { AdminComponent } from './features/admin/admin.component';

export const routes: Routes = [
  // Default → sign-in
  { path: '', redirectTo: 'sign-in', pathMatch: 'full' },

  // Auth
  { path: 'sign-in', component: SignInComponent, title: 'Sign In — Compliance Hub' },

  // SuperAdmin Panel (role-guarded in production)
  { path: 'admin', component: AdminComponent, title: 'SuperAdmin Panel — Compliance Hub' },

  // Client Workspace Routes
  { path: 'dashboard', component: DashboardComponent, title: 'EPR Dashboard — Compliance Hub' },
  { path: 'products', component: ProductsComponent, title: 'Product BOM Explorer — Compliance Hub' },
  { path: 'quality', component: QualityComponent, title: 'Data Quality Worklist — Compliance Hub' },
  { path: 'simulator', component: SimulatorComponent, title: 'EPR Fee Simulator — Compliance Hub' },
  { path: 'onboarding', component: OnboardingComponent, title: 'Client Setup — Compliance Hub' },

  { path: '**', redirectTo: 'sign-in' },
];
