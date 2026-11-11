import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserRole, UserRow } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { Problem, toProblem } from '../../core/api/problem';
import { load } from '../../core/api/resource';
import { ToastService } from '../../core/services/toast.service';
import {
  ChipTone,
  Column,
  DataTableComponent,
  DialogComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  FormFieldComponent,
  PageHeaderComponent,
  StatusChipComponent,
} from '../../shared/ui';

const ROLES: { id: UserRole; label: string }[] = [
  { id: 'org_admin', label: 'Org admin' },
  { id: 'analyst', label: 'Analyst' },
  { id: 'viewer', label: 'Viewer' },
  { id: 'superadmin', label: 'Platform admin' },
];

/**
 * Users across all client workspaces (platform admins). Adding a user with the email of an
 * invited org admin activates them with the given password until invitation emails exist.
 */
@Component({
  selector: 'app-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    PageHeaderComponent,
    DataTableComponent,
    StatusChipComponent,
    DialogComponent,
    FormFieldComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  template: `
    <app-page-header title="Users">
      <button type="button" class="btn btn-primary" (click)="openAdd()">Add user</button>
    </app-page-header>

    <div class="toolbar">
      <input type="search" placeholder="Search" aria-label="Search users" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      <select aria-label="Workspace" [ngModel]="workspace()" (ngModelChange)="workspace.set($event)">
        <option value="">All workspaces</option>
        @for (w of workspaces.value() ?? []; track w.id) {
          <option [value]="w.slug">{{ w.name }}</option>
        }
      </select>
    </div>

    @if (list.error(); as problem) {
      <app-error-state [problem]="problem" (retry)="list.reload()" />
    } @else if (!list.loading() && !rows().length) {
      <app-empty-state title="No users" />
    } @else {
      <app-data-table [columns]="columns" [rows]="rows()" [loading]="list.loading()" [trackBy]="byKey">
        <ng-template #cell let-row let-key="key" let-value="value">
          @switch (key) {
            @case ('name') {
              <span class="who"><span class="avatar" aria-hidden="true">{{ row.avatar_initials }}</span><b>{{ row.full_name }}</b></span>
            }
            @case ('status') {
              <app-status-chip [tone]="tone(row.status)">{{ row.status === 'invited' ? 'Invited' : row.status === 'disabled' ? 'Disabled' : 'Active' }}</app-status-chip>
            }
            @default { {{ value }} }
          }
        </ng-template>
      </app-data-table>
    }

    <app-dialog [open]="adding()" title="Add user" [width]="520" (closed)="adding.set(false)">
      <div class="form-grid">
        <app-form-field label="Full name" for="u-name" class="wide" [error]="err('full_name')">
          <input id="u-name" [ngModel]="name()" (ngModelChange)="name.set($event)" autocomplete="off" />
        </app-form-field>
        <app-form-field label="Work email" for="u-email" class="wide" [error]="err('email')">
          <input id="u-email" type="email" [ngModel]="email()" (ngModelChange)="email.set($event)" autocomplete="off" />
        </app-form-field>
        <app-form-field label="Role" for="u-role">
          <select id="u-role" [ngModel]="role()" (ngModelChange)="role.set($event)">
            @for (r of roles; track r.id) { <option [value]="r.id">{{ r.label }}</option> }
          </select>
        </app-form-field>
        @if (role() !== 'superadmin') {
          <app-form-field label="Workspace" for="u-ws" [error]="err('tenant_id')">
            <select id="u-ws" [ngModel]="tenant()" (ngModelChange)="tenant.set($event)">
              @for (w of workspaces.value() ?? []; track w.id) { <option [value]="w.slug">{{ w.name }}</option> }
            </select>
          </app-form-field>
        }
        <app-form-field label="Temporary password" for="u-pw" class="wide" [error]="err('password')">
          <input id="u-pw" type="password" [ngModel]="password()" (ngModelChange)="password.set($event)" autocomplete="new-password" />
        </app-form-field>
      </div>
      @if (problem() && !hasFieldErrors()) {
        <p class="error-text" role="alert">{{ problem()!.detail }}</p>
      }
      <ng-container actions>
        <button type="button" class="btn btn-secondary" (click)="adding.set(false)">Cancel</button>
        <button type="button" class="btn btn-primary" [disabled]="saving() || !canSave()" (click)="save()">Add user</button>
      </ng-container>
    </app-dialog>
  `,
  styles: `
    .who {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: var(--bg-input, #eef1f5);
      font-size: 11px;
      font-weight: 600;
    }
  `,
})
export class UsersComponent {
  private readonly api = inject(PlatformApi);
  private readonly toast = inject(ToastService);

  protected readonly list = load(() => this.api.users());
  protected readonly workspaces = load(() => this.api.workspaces());
  protected readonly roles = ROLES;

  protected readonly q = signal('');
  protected readonly workspace = signal('');

  protected readonly rows = computed(() => {
    const q = this.q().toLowerCase();
    return (this.list.value() ?? []).filter(
      (u) =>
        (!q || u.full_name.toLowerCase().includes(q) || u.email.includes(q)) &&
        (!this.workspace() || u.organisation_slug === this.workspace()),
    );
  });

  protected readonly columns: Column<UserRow>[] = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email', value: (u) => u.email },
    { key: 'role', label: 'Role', value: (u) => ROLES.find((r) => r.id === u.role)?.label ?? u.role },
    { key: 'workspace', label: 'Workspace', value: (u) => (u.role === 'superadmin' ? '—' : (u.organisation_name ?? '—')) },
    { key: 'status', label: 'Status' },
  ];

  protected readonly byKey = (u: UserRow) => `${u.id}:${u.organisation_slug ?? ''}`;

  protected readonly adding = signal(false);
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly role = signal<UserRole>('org_admin');
  protected readonly tenant = signal('');
  protected readonly password = signal('');
  protected readonly saving = signal(false);
  protected readonly problem = signal<Problem | null>(null);

  protected readonly canSave = computed(
    () =>
      !!this.name().trim() &&
      /^\S+@\S+\.\S+$/.test(this.email()) &&
      this.password().length >= 8 &&
      (this.role() === 'superadmin' || !!this.tenant()),
  );
  protected readonly hasFieldErrors = computed(() => Object.keys(this.problem()?.fields ?? {}).length > 0);

  protected tone(status: string | undefined): ChipTone {
    return status === 'invited' ? 'neutral' : status === 'disabled' ? 'red' : 'green';
  }

  protected err(field: string): string | undefined {
    return this.problem()?.fields[field];
  }

  protected openAdd(): void {
    this.name.set('');
    this.email.set('');
    this.role.set('org_admin');
    this.tenant.set(this.workspace() || (this.workspaces.value()?.[0]?.slug ?? ''));
    this.password.set('');
    this.problem.set(null);
    this.adding.set(true);
  }

  protected save(): void {
    this.saving.set(true);
    this.problem.set(null);
    const superadmin = this.role() === 'superadmin';
    this.api
      .createUser({
        full_name: this.name().trim(),
        email: this.email().trim(),
        role: this.role(),
        tenant_id: superadmin ? null : this.tenant(),
        password: this.password(),
      })
      .subscribe({
        next: (user) => {
          this.saving.set(false);
          this.adding.set(false);
          this.list.reload();
          this.toast.show(`${user.full_name} added`);
        },
        error: (e: unknown) => {
          this.saving.set(false);
          this.problem.set(toProblem(e));
        },
      });
  }
}
