import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Membership, SessionService, errorMessage } from '../../core/session/session.service';

/** After sign-in, for users in more than one workspace: pick where to work. */
@Component({
  selector: 'app-workspace-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './sign-in.component.css',
  styles: `
    .workspaces {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .workspace {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-subtle);
      background: var(--bg-secondary);
      color: var(--text-primary);
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      text-align: left;
      cursor: pointer;
    }
    .workspace:hover:not(:disabled),
    .workspace:focus-visible {
      border-color: var(--border-hover);
      background: var(--bg-card-hover);
    }
    .workspace:disabled {
      cursor: progress;
    }
    .current {
      font-size: 12px;
      color: var(--text-muted);
      font-weight: 400;
    }
    .signout {
      margin-top: 20px;
      background: none;
      border: 0;
      padding: 0;
      color: var(--text-secondary);
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }
  `,
  template: `
    <div class="auth-wrapper">
      <main class="auth-card">
        <header class="auth-header">
          <h1 class="auth-headline">Choose a workspace</h1>
        </header>

        @if (error()) {
          <div class="alert-banner alert-error" role="alert">{{ error() }}</div>
        }

        <ul class="workspaces">
          @for (m of session.memberships(); track m.tenant.id) {
            <li>
              <button type="button" class="workspace" [disabled]="busy()" (click)="choose(m)">
                {{ m.tenant.name }}
                @if (m.tenant.id === session.activeTenantId()) {
                  <span class="current">Current</span>
                }
              </button>
            </li>
          }
        </ul>

        <button type="button" class="signout" (click)="signOut()">Sign out</button>
      </main>
    </div>
  `,
})
export class WorkspacePickerComponent {
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  async choose(m: Membership): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    try {
      if (m.tenant.id !== this.session.activeTenantId()) await this.session.switchWorkspace(m.tenant.id);
      await this.router.navigateByUrl(this.session.home());
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async signOut(): Promise<void> {
    await this.session.signOut();
    await this.router.navigate(['/sign-in'], { queryParams: { reason: 'signed-out' } });
  }
}
