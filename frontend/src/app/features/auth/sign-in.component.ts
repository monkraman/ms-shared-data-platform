import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { TenantApiService } from '../../core/services/tenant-api.service';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css',
})
export class SignInComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly tenantService = inject(TenantApiService);
  readonly themeService = inject(ThemeService);

  readonly authenticating = this.authService.isAuthenticating;
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal<boolean>(false);

  // Clean, direct Email & Password Form (SuperAdmin default)
  readonly signInForm: FormGroup = this.fb.group({
    email: ['superadmin@monkspaces.com', [Validators.required, Validators.email]],
    password: ['password123', [Validators.required, Validators.minLength(6)]],
  });

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  // Quick preset helper for development/testing
  applyPreset(type: 'superadmin' | 'khc_admin'): void {
    this.errorMessage.set(null);
    if (type === 'superadmin') {
      this.signInForm.patchValue({
        email: 'superadmin@monkspaces.com',
        password: 'password123',
      });
    } else {
      this.signInForm.patchValue({
        email: 'compliance.officer@kraftheinz.com',
        password: 'password123',
      });
    }
  }

  // Direct Sign-In Handler — No MFA blocking, real backend JWT
  async onSubmit(): Promise<void> {
    if (this.signInForm.invalid) {
      this.errorMessage.set('Please enter a valid work email and password.');
      return;
    }

    this.errorMessage.set(null);
    const email = this.signInForm.value.email.trim();
    const password = this.signInForm.value.password;

    const role = await this.authService.login(email, password);

    if (role === 'superadmin') {
      this.router.navigate(['/admin']);
    } else if (role === 'client') {
      // Set active workspace to client's assigned tenant
      const user = this.authService.currentUser();
      if (user?.organisationSlug) {
        this.tenantService.setActiveTenant(user.organisationSlug);
      }
      this.router.navigate(['/products']);
    } else {
      this.errorMessage.set('Invalid work credentials. Please check your email and password.');
    }
  }
}
