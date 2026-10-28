import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { APP_CONFIG } from '../../core/config/client-theme.config';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

export type AuthScreenMode = 'login' | 'mfa' | 'forgot_password' | 'magic_link_sent';

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
  readonly themeService = inject(ThemeService);

  readonly config = APP_CONFIG;
  readonly authenticating = this.authService.isAuthenticating;

  // Screen State according to mockup priority map:
  // [P1] Login -> [P2] MFA step / Forgot password -> [P3] Active Sessions
  readonly screenMode = signal<AuthScreenMode>('login');
  readonly errorMessage = signal<string | null>(null);
  readonly infoMessage = signal<string | null>(null);
  readonly showPassword = signal<boolean>(false);
  readonly pendingEmail = signal<string>('compliance.officer@kraftheinz.com');

  // [P1] Email & Password Form
  readonly signInForm: FormGroup = this.fb.group({
    email: ['compliance.officer@kraftheinz.com', [Validators.required, Validators.email]],
    password: ['password123', [Validators.required, Validators.minLength(6)]],
    rememberMe: [true],
  });

  // [P2] MFA Verification Form
  readonly mfaForm: FormGroup = this.fb.group({
    digit1: ['', [Validators.required, Validators.maxLength(1)]],
    digit2: ['', [Validators.required, Validators.maxLength(1)]],
    digit3: ['', [Validators.required, Validators.maxLength(1)]],
    digit4: ['', [Validators.required, Validators.maxLength(1)]],
    digit5: ['', [Validators.required, Validators.maxLength(1)]],
    digit6: ['', [Validators.required, Validators.maxLength(1)]],
    trustDevice: [true],
  });

  // [P2] Forgot Password / Magic Link Form
  readonly forgotForm: FormGroup = this.fb.group({
    email: ['compliance.officer@kraftheinz.com', [Validators.required, Validators.email]],
  });

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  setScreenMode(mode: AuthScreenMode): void {
    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.screenMode.set(mode);
  }

  // [P1] Primary Login Handler
  async onSubmit(): Promise<void> {
    if (this.signInForm.invalid) return;
    this.errorMessage.set(null);

    const email = this.signInForm.value.email.trim();
    const password = this.signInForm.value.password;
    this.pendingEmail.set(email);

    // If company policy enforces MFA (or user email has mfa enabled), present [P2] MFA step
    if (email.includes('kraftheinz') || email.includes('admin')) {
      // Transition to MFA verification step (Mocking real enterprise MFA challenge)
      this.setScreenMode('mfa');
      return;
    }

    await this.completeLogin(email, password);
  }

  // [P2] MFA Verification Submission
  async onVerifyMfa(): Promise<void> {
    this.errorMessage.set(null);
    const email = this.pendingEmail();
    const password = this.signInForm.value.password || 'password123';
    await this.completeLogin(email, password);
  }

  // [P1] Enterprise SSO Handler (Microsoft, Google, SAML)
  async onSsoLogin(provider: string): Promise<void> {
    this.errorMessage.set(null);
    const orgSlug = 'khc-europe';
    const result = await this.authService.loginWithSso(provider, orgSlug);

    if (result === 'superadmin') {
      this.router.navigate(['/admin']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  // [P2] Send Magic Link or Password Reset
  async onSendMagicLink(): Promise<void> {
    if (this.forgotForm.invalid) return;
    this.infoMessage.set(
      `A secure sign-in magic link and password reset instructions have been sent to ${this.forgotForm.value.email}.`
    );
    this.screenMode.set('magic_link_sent');
  }

  // Quick preset helper for development/demo (unobtrusive)
  applyPreset(type: 'client' | 'admin'): void {
    if (type === 'admin') {
      this.signInForm.patchValue({
        email: 'superadmin@monkspaces.com',
        password: 'password123',
      });
      this.forgotForm.patchValue({ email: 'superadmin@monkspaces.com' });
    } else {
      this.signInForm.patchValue({
        email: 'compliance.officer@kraftheinz.com',
        password: 'password123',
      });
      this.forgotForm.patchValue({ email: 'compliance.officer@kraftheinz.com' });
    }
  }

  // Auto-focus next digit on MFA input
  onDigitInput(event: any, nextInputId: string | null): void {
    const input = event.target;
    if (input.value && nextInputId) {
      const nextEl = document.getElementById(nextInputId);
      if (nextEl) nextEl.focus();
    }
  }

  private async completeLogin(email: string, password: string): Promise<void> {
    const result = await this.authService.login(email, password);

    if (result === 'superadmin') {
      this.router.navigate(['/admin']);
    } else if (result === 'client') {
      this.router.navigate(['/dashboard']);
    } else {
      this.errorMessage.set('Invalid work credentials. Please verify your email and password.');
      this.screenMode.set('login');
    }
  }
}
