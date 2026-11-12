import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { SessionService, SignInReason, errorMessage } from '../../core/session/session.service';
import { ThemeService } from '../../core/services/theme.service';

const NOTICES: Record<SignInReason, string> = {
  expired: 'Your session expired. Sign in again.',
  idle: 'You were signed out after 30 minutes of inactivity.',
  'signed-out': 'You signed out.',
};

/**
 * Demo accounts (backend/seeds/bootstrap_users.json) shown as one-click sign-in buttons while
 * `environment.demoSignIn` is on. Turn it off (DEMO_SIGN_IN=false) before real client data.
 */
const DEMO_PASSWORD = 'password123';
const PRESETS = [
  { label: 'Platform admin', email: 'superadmin@monkspaces.com' },
  { label: 'Kraft Heinz · Org admin', email: 'compliance.officer@kraftheinz.com' },
];

@Component({
  selector: 'app-sign-in',
  imports: [ReactiveFormsModule],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css',
})
export class SignInComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionService);
  readonly themeService = inject(ThemeService);

  readonly authenticating = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly presets = environment.demoSignIn ? PRESETS : [];
  readonly demoPassword = DEMO_PASSWORD;

  private readonly reason = this.route.snapshot.queryParamMap.get('reason') as SignInReason | null;
  readonly notice = computed(() => (this.errorMessage() || !this.reason ? null : (NOTICES[this.reason] ?? null)));

  readonly signInForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  /** Fills in a demo account and signs in. */
  signInAs(email: string): void {
    this.errorMessage.set(null);
    this.signInForm.patchValue({ email, password: DEMO_PASSWORD });
    void this.onSubmit();
  }

  fieldError(name: 'email' | 'password'): string | null {
    const control = this.signInForm.controls[name];
    if (!control.touched || control.valid) return null;
    if (control.hasError('required')) return name === 'email' ? 'Enter your work email' : 'Enter your password';
    return 'Enter a valid email';
  }

  async onSubmit(): Promise<void> {
    if (this.signInForm.invalid) {
      this.signInForm.markAllAsTouched();
      return;
    }
    this.errorMessage.set(null);
    this.authenticating.set(true);
    const { email, password } = this.signInForm.getRawValue();
    try {
      await this.session.signIn(email.trim(), password);
      await this.router.navigateByUrl(await this.destination());
    } catch (error) {
      this.errorMessage.set(errorMessage(error));
      this.signInForm.controls.password.reset();
    } finally {
      this.authenticating.set(false);
    }
  }

  /** The page the user came from, the workspace picker, or their home screen. */
  private async destination(): Promise<string> {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (returnUrl && /^\/(?!\/)/.test(returnUrl) && !returnUrl.startsWith('/sign-in')) return returnUrl;
    const me = await this.session.load();
    if ((me?.memberships.length ?? 0) > 1) return '/workspace';
    return this.session.home();
  }
}
