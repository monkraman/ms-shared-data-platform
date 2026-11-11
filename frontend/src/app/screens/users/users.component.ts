import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MembershipIn, UserRow, WorkspaceRole } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { Problem, toProblem } from '../../core/api/problem';
import { load } from '../../core/api/resource';
import { ToastService } from '../../core/services/toast.service';
import { SessionService } from '../../core/session/session.service';
import {
  ChipTone,
  Column,
  DataTableComponent,
  DialogComponent,
  DrawerComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  FormFieldComponent,
  PageHeaderComponent,
  StatusChipComponent,
  initialsOf,
} from '../../shared/ui';
import { ROLE_LABELS, STATUS } from './roles';

type Kind = 'client' | 'consultant' | 'platform';

/** Screen 9: every user, their workspaces and roles (platform admins). */
@Component({
  selector: 'app-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    DatePipe,
    PageHeaderComponent,
    DataTableComponent,
    StatusChipComponent,
    DialogComponent,
    DrawerComponent,
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
        <option value="platform">Monk Spaces staff</option>
        @for (w of workspaces.value() ?? []; track w.id) { <option [value]="w.id">{{ w.name }}</option> }
      </select>
      <select aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
        <option value="">Any status</option>
        <option value="active">Active</option>
        <option value="invited">Invited</option>
        <option value="disabled">Disabled</option>
      </select>
    </div>

    @if (list.error(); as p) {
      <app-error-state [problem]="p" (retry)="list.reload()" />
    } @else if (!list.loading() && !rows().length) {
      <app-empty-state title="No users" />
    } @else {
      <app-data-table [columns]="columns" [rows]="rows()" [loading]="list.loading()" [clickable]="true" [trackBy]="byId"
                      (rowClick)="open($event)">
        <ng-template #cell let-row let-key="key">
          @switch (key) {
            @case ('name') {
              <span class="who">
                <span class="avatar" aria-hidden="true">{{ initials(row.full_name) }}</span>
                <span><b>{{ row.full_name }}</b><span class="muted">{{ row.email }}</span></span>
              </span>
            }
            @case ('access') {
              <span class="chips">
                @if (row.is_platform_admin) { <app-status-chip tone="blue">Platform admin</app-status-chip> }
                @for (m of row.memberships; track m.tenant_id) {
                  <span class="access">{{ m.tenant_name }} <span class="muted">· {{ roleLabel(m.role) }}</span></span>
                }
              </span>
            }
            @case ('status') { <app-status-chip [tone]="statusOf(row).tone">{{ statusOf(row).label }}</app-status-chip> }
            @case ('last') { <span class="muted">{{ row.last_sign_in_at ? (row.last_sign_in_at | date: 'd MMM, HH:mm') : 'Never' }}</span> }
          }
        </ng-template>
      </app-data-table>
    }

    <app-dialog [open]="adding()" title="Add user" [width]="560" (closed)="adding.set(false)">
      <div class="form-grid">
        <app-form-field label="Full name" for="u-name" class="wide" [error]="err('full_name')">
          <input id="u-name" [(ngModel)]="draft.full_name" autocomplete="off" />
        </app-form-field>
        <app-form-field label="Work email" for="u-email" class="wide" [error]="err('email')">
          <input id="u-email" type="email" [(ngModel)]="draft.email" autocomplete="off" />
        </app-form-field>
        <app-form-field label="Type" for="u-kind" class="wide">
          <select id="u-kind" [(ngModel)]="draft.kind" (ngModelChange)="draft.role = $event === 'consultant' ? 'consultant' : 'org_admin'">
            <option value="client">Client user</option>
            <option value="consultant">Monk Spaces consultant</option>
            <option value="platform">Platform admin</option>
          </select>
        </app-form-field>
        @if (draft.kind !== 'platform') {
          <app-form-field label="Workspaces" for="u-ws" class="wide" [error]="err('memberships')">
            <div class="picks" id="u-ws">
              @for (w of workspaces.value() ?? []; track w.id) {
                <label class="choice"><input type="checkbox" [(ngModel)]="draft.workspaces[w.id]" />{{ w.name }}</label>
              }
            </div>
          </app-form-field>
          @if (draft.kind === 'client') {
            <app-form-field label="Role" for="u-role">
              <select id="u-role" [(ngModel)]="draft.role">
                @for (r of clientRoles; track r) { <option [value]="r">{{ roleLabel(r) }}</option> }
              </select>
            </app-form-field>
          }
        }
        <app-form-field label="Temporary password" for="u-pw" class="wide" [error]="err('password')">
          <input id="u-pw" type="password" [(ngModel)]="draft.password" autocomplete="new-password" placeholder="Leave empty to invite" />
        </app-form-field>
      </div>
      @if (problem() && !hasFieldErrors()) { <p class="error-text" role="alert">{{ problem()!.detail }}</p> }
      <ng-container actions>
        <button type="button" class="btn btn-secondary" (click)="adding.set(false)">Cancel</button>
        <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="create()">Add user</button>
      </ng-container>
    </app-dialog>

    <app-drawer [open]="!!selected()" [title]="selected()?.full_name ?? ''" (closed)="selected.set(null)">
      @if (selected(); as u) {
        <dl class="facts">
          <dt>Email</dt><dd>{{ u.email }}</dd>
          <dt>Status</dt><dd><app-status-chip [tone]="statusOf(u).tone">{{ statusOf(u).label }}</app-status-chip></dd>
          <dt>Last sign-in</dt><dd>{{ u.last_sign_in_at ? (u.last_sign_in_at | date: 'd MMM y, HH:mm') : 'Never' }}</dd>
          <dt>Added</dt><dd>{{ u.created_at | date: 'd MMM y' }}</dd>
        </dl>

        <div class="section-label">Name</div>
        <div class="inline">
          <input aria-label="Full name" [(ngModel)]="edit.full_name" />
          <button type="button" class="btn btn-secondary" [disabled]="edit.full_name.trim() === u.full_name" (click)="rename(u)">Save</button>
        </div>

        <label class="switch platform-toggle">
          <input type="checkbox" role="switch" [checked]="u.is_platform_admin" [disabled]="u.id === me()" (change)="togglePlatform(u, $any($event.target).checked)" />
          <span class="track" aria-hidden="true"></span>
          Platform admin
        </label>

        <div class="section-label">Workspaces</div>
        @for (m of edit.memberships; track $index; let i = $index) {
          <div class="inline">
            <select aria-label="Workspace" [(ngModel)]="m.tenant_id">
              @for (w of workspaces.value() ?? []; track w.id) { <option [value]="w.id">{{ w.name }}</option> }
            </select>
            <select aria-label="Role" [(ngModel)]="m.role">
              @for (r of allRoles; track r) { <option [value]="r">{{ roleLabel(r) }}</option> }
            </select>
            <button type="button" class="btn btn-ghost" aria-label="Remove workspace" (click)="edit.memberships.splice(i, 1)">×</button>
          </div>
        }
        <div class="inline">
          <button type="button" class="btn btn-ghost" (click)="addWorkspace()">Add workspace</button>
          <button type="button" class="btn btn-secondary" (click)="saveWorkspaces(u)">Save workspaces</button>
        </div>

        <div class="section-label">Temporary password</div>
        <div class="inline">
          <input type="password" aria-label="Temporary password" [(ngModel)]="edit.password" autocomplete="new-password" />
          <button type="button" class="btn btn-secondary" [disabled]="edit.password.length < 10" (click)="password(u)">Set</button>
        </div>
      }
      <ng-container actions>
        @if (selected(); as u) {
          @if (u.status === 'disabled') {
            <button type="button" class="btn btn-primary" (click)="setStatus(u, 'active')">Enable</button>
          } @else if (u.id !== me()) {
            <button type="button" class="btn btn-secondary" (click)="setStatus(u, 'disabled')">Disable</button>
          }
        }
      </ng-container>
    </app-drawer>
  `,
  styles: `
    .who {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .who > span:last-child {
      display: flex;
      flex-direction: column;
    }
    .who .muted {
      font-size: 12px;
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: var(--bg);
      font-size: 11px;
      font-weight: 700;
    }
    .access {
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid var(--border);
      font-size: 12px;
      white-space: nowrap;
    }
    .picks {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 14px;
    }
    .inline {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;
    }
    .inline input,
    .inline select {
      flex: 1;
      min-width: 0;
      padding: 7px 9px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font: inherit;
      background: var(--bg-input, #fff);
      color: var(--ink);
    }
    .platform-toggle {
      margin: 8px 0 4px;
    }
  `,
})
export class UsersComponent {
  private readonly api = inject(PlatformApi);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);

  protected readonly list = load(() => this.api.users());
  protected readonly workspaces = load(() => this.api.workspaces());
  protected readonly me = computed(() => this.session.me()?.user.id ?? '');
  protected readonly clientRoles: WorkspaceRole[] = ['org_admin', 'analyst', 'viewer'];
  protected readonly allRoles: WorkspaceRole[] = ['org_admin', 'consultant', 'analyst', 'viewer'];
  protected readonly initials = initialsOf;

  protected readonly q = signal('');
  protected readonly workspace = signal('');
  protected readonly status = signal('');
  protected readonly rows = computed(() => {
    const q = this.q().toLowerCase();
    const ws = this.workspace();
    return (this.list.value() ?? []).filter(
      (u) =>
        (!q || u.full_name.toLowerCase().includes(q) || u.email.includes(q)) &&
        (!this.status() || u.status === this.status()) &&
        (!ws || (ws === 'platform' ? u.is_platform_admin || u.memberships.some((m) => m.role === 'consultant') : u.memberships.some((m) => m.tenant_id === ws))),
    );
  });

  protected readonly columns: Column<UserRow>[] = [
    { key: 'name', label: 'User' },
    { key: 'access', label: 'Access' },
    { key: 'status', label: 'Status' },
    { key: 'last', label: 'Last sign-in' },
  ];
  protected readonly byId = (u: UserRow) => u.id;

  protected readonly adding = signal(false);
  protected readonly saving = signal(false);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly hasFieldErrors = computed(() => Object.keys(this.problem()?.fields ?? {}).length > 0);
  protected draft = blankDraft();

  protected readonly selected = signal<UserRow | null>(null);
  protected edit = { full_name: '', password: '', memberships: [] as MembershipIn[] };

  protected roleLabel(r: string): string {
    return ROLE_LABELS[r as WorkspaceRole] ?? r;
  }

  protected statusOf(u: UserRow): { label: string; tone: ChipTone } {
    return STATUS[u.status];
  }

  protected err(field: string): string | undefined {
    return this.problem()?.fields[field];
  }

  protected openAdd(): void {
    this.draft = blankDraft();
    this.problem.set(null);
    this.adding.set(true);
  }

  protected create(): void {
    const d = this.draft;
    const ids = Object.keys(d.workspaces).filter((id) => d.workspaces[id]);
    this.saving.set(true);
    this.problem.set(null);
    this.api
      .createUser({
        full_name: d.full_name,
        email: d.email,
        is_platform_admin: d.kind === 'platform',
        memberships: d.kind === 'platform' ? [] : ids.map((tenant_id) => ({ tenant_id, role: d.kind === 'consultant' ? 'consultant' : d.role })),
        password: d.password || null,
      })
      .subscribe({
        next: (u) => {
          this.saving.set(false);
          this.adding.set(false);
          this.list.set([...(this.list.value() ?? []), u]);
          this.toast.show(`${u.full_name} ${u.status === 'invited' ? 'invited' : 'added'}`);
        },
        error: (e: unknown) => {
          this.saving.set(false);
          this.problem.set(toProblem(e));
        },
      });
  }

  protected open(u: UserRow): void {
    this.selected.set(u);
    this.edit = { full_name: u.full_name, password: '', memberships: u.memberships.map((m) => ({ tenant_id: m.tenant_id, role: m.role })) };
  }

  protected addWorkspace(): void {
    const first = (this.workspaces.value() ?? [])[0];
    if (first) this.edit.memberships.push({ tenant_id: first.id, role: 'viewer' });
  }

  private replace(u: UserRow, message: string): void {
    this.list.set((this.list.value() ?? []).map((x) => (x.id === u.id ? u : x)));
    this.open(u);
    this.toast.show(message);
  }

  private fail(e: unknown): void {
    this.toast.show(toProblem(e).detail, 'error');
  }

  protected rename(u: UserRow): void {
    this.api.updateUser(u.id, { full_name: this.edit.full_name }).subscribe({ next: (x) => this.replace(x, 'Name saved'), error: (e) => this.fail(e) });
  }

  protected togglePlatform(u: UserRow, on: boolean): void {
    this.api.updateUser(u.id, { is_platform_admin: on }).subscribe({
      next: (x) => this.replace(x, on ? 'Now a platform admin' : 'Platform access removed'),
      error: (e) => this.fail(e),
    });
  }

  protected setStatus(u: UserRow, status: 'active' | 'disabled'): void {
    this.api.updateUser(u.id, { status }).subscribe({
      next: (x) => this.replace(x, status === 'disabled' ? `${u.full_name} disabled` : `${u.full_name} enabled`),
      error: (e) => this.fail(e),
    });
  }

  protected saveWorkspaces(u: UserRow): void {
    const unique = [...new Map(this.edit.memberships.map((m) => [m.tenant_id, m])).values()];
    this.api.setMemberships(u.id, unique).subscribe({ next: (x) => this.replace(x, 'Workspaces saved'), error: (e) => this.fail(e) });
  }

  protected password(u: UserRow): void {
    this.api.setPassword(u.id, this.edit.password).subscribe({
      next: () => {
        this.edit.password = '';
        this.toast.show('Temporary password set; their sessions were ended');
        this.list.reload();
      },
      error: (e) => this.fail(e),
    });
  }
}

function blankDraft() {
  return {
    full_name: '',
    email: '',
    kind: 'client' as Kind,
    role: 'org_admin' as WorkspaceRole,
    workspaces: {} as Record<string, boolean>,
    password: '',
  };
}
