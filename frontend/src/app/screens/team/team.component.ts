import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Member, MemberCreate } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { Problem, toProblem } from '../../core/api/problem';
import { load } from '../../core/api/resource';
import { ToastService } from '../../core/services/toast.service';
import { SessionService } from '../../core/session/session.service';
import {
  Column,
  DataTableComponent,
  DialogComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  FormFieldComponent,
  PageHeaderComponent,
  StatusChipComponent,
  initialsOf,
} from '../../shared/ui';
import { ROLE_LABELS, STATUS } from '../users/roles';

type TeamRole = MemberCreate['role'];

/** Screen 9: an org admin's own team. Consultants are assigned by Monk Spaces. */
@Component({
  selector: 'app-team',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe, PageHeaderComponent, DataTableComponent, StatusChipComponent, DialogComponent, FormFieldComponent, EmptyStateComponent, ErrorStateComponent],
  template: `
    <app-page-header title="People">
      <button type="button" class="btn btn-primary" (click)="openAdd()">Add member</button>
    </app-page-header>

    @if (list.error(); as p) {
      <app-error-state [problem]="p" (retry)="list.reload()" />
    } @else if (!list.loading() && !(list.value() ?? []).length) {
      <app-empty-state title="No members" />
    } @else {
      <app-data-table [columns]="columns" [rows]="list.value() ?? []" [loading]="list.loading()" [trackBy]="byId">
        <ng-template #cell let-row let-key="key">
          @switch (key) {
            @case ('name') {
              <span class="who">
                <span class="avatar" aria-hidden="true">{{ initials(row.full_name) }}</span>
                <span><b>{{ row.full_name }}</b><span class="muted">{{ row.email }}</span></span>
              </span>
            }
            @case ('role') {
              @if (row.role === 'consultant' || row.id === me()) {
                {{ roleLabel(row.role) }}
              } @else {
                <select [attr.aria-label]="'Role of ' + row.full_name" [ngModel]="row.role" (ngModelChange)="setRole(row, $event)">
                  @for (r of roles; track r) { <option [value]="r">{{ roleLabel(r) }}</option> }
                </select>
              }
            }
            @case ('status') { <app-status-chip [tone]="status(row).tone">{{ status(row).label }}</app-status-chip> }
            @case ('last') { <span class="muted">{{ row.last_sign_in_at ? (row.last_sign_in_at | date: 'd MMM, HH:mm') : 'Never' }}</span> }
            @case ('actions') {
              @if (row.role !== 'consultant' && row.id !== me()) {
                <span class="row-actions">
                  @if (!row.other_workspaces) {
                    <button type="button" class="btn btn-ghost" (click)="openPassword(row)">Password</button>
                  }
                  <button type="button" class="btn btn-ghost" (click)="remove(row)">Remove</button>
                </span>
              }
            }
          }
        </ng-template>
      </app-data-table>
    }

    <app-dialog [open]="adding()" title="Add member" [width]="520" (closed)="adding.set(false)">
      <div class="form-grid">
        <app-form-field label="Full name" for="m-name" class="wide" [error]="err('full_name')">
          <input id="m-name" [(ngModel)]="draft.full_name" autocomplete="off" />
        </app-form-field>
        <app-form-field label="Work email" for="m-email" class="wide" [error]="err('email')">
          <input id="m-email" type="email" [(ngModel)]="draft.email" autocomplete="off" />
        </app-form-field>
        <app-form-field label="Role" for="m-role">
          <select id="m-role" [(ngModel)]="draft.role">
            @for (r of roles; track r) { <option [value]="r">{{ roleLabel(r) }}</option> }
          </select>
        </app-form-field>
        <app-form-field label="Temporary password" for="m-pw" [error]="err('password')">
          <input id="m-pw" type="password" [(ngModel)]="draft.password" autocomplete="new-password" placeholder="Leave empty to invite" />
        </app-form-field>
      </div>
      @if (problem() && !hasFieldErrors()) { <p class="error-text" role="alert">{{ problem()!.detail }}</p> }
      <ng-container actions>
        <button type="button" class="btn btn-secondary" (click)="adding.set(false)">Cancel</button>
        <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="add()">Add member</button>
      </ng-container>
    </app-dialog>

    <app-dialog [open]="!!passwordFor()" [title]="'Temporary password for ' + (passwordFor()?.full_name ?? '')" [width]="440" (closed)="passwordFor.set(null)">
      <app-form-field label="Temporary password" for="m-reset" [error]="err('password')">
        <input id="m-reset" type="password" [(ngModel)]="newPassword" autocomplete="new-password" />
      </app-form-field>
      <ng-container actions>
        <button type="button" class="btn btn-secondary" (click)="passwordFor.set(null)">Cancel</button>
        <button type="button" class="btn btn-primary" [disabled]="newPassword.length < 10" (click)="savePassword()">Set password</button>
      </ng-container>
    </app-dialog>
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
    .row-actions {
      display: inline-flex;
      gap: 4px;
    }
  `,
})
export class TeamComponent {
  private readonly api = inject(PlatformApi);
  private readonly toast = inject(ToastService);
  protected readonly session = inject(SessionService);

  protected readonly list = load(() => this.api.team());
  protected readonly me = computed(() => this.session.me()?.user.id ?? '');
  protected readonly roles: TeamRole[] = ['org_admin', 'analyst', 'viewer'];
  protected readonly initials = initialsOf;
  protected readonly columns: Column<Member>[] = [
    { key: 'name', label: 'Member' },
    { key: 'role', label: 'Role' },
    { key: 'status', label: 'Status' },
    { key: 'last', label: 'Last sign-in' },
    { key: 'actions', label: '' },
  ];
  protected readonly byId = (m: Member) => m.id;

  protected readonly adding = signal(false);
  protected readonly saving = signal(false);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly hasFieldErrors = computed(() => Object.keys(this.problem()?.fields ?? {}).length > 0);
  protected draft = { full_name: '', email: '', role: 'viewer' as TeamRole, password: '' };
  protected readonly passwordFor = signal<Member | null>(null);
  protected newPassword = '';

  protected roleLabel(r: string): string {
    return ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r;
  }

  protected status(m: Member) {
    return STATUS[m.status];
  }

  protected err(field: string): string | undefined {
    return this.problem()?.fields[field];
  }

  protected openAdd(): void {
    this.draft = { full_name: '', email: '', role: 'viewer', password: '' };
    this.problem.set(null);
    this.adding.set(true);
  }

  protected add(): void {
    this.saving.set(true);
    this.problem.set(null);
    this.api.addMember({ ...this.draft, password: this.draft.password || null }).subscribe({
      next: (m) => {
        this.saving.set(false);
        this.adding.set(false);
        this.list.set([...(this.list.value() ?? []), m]);
        this.toast.show(`${m.full_name} added`);
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.problem.set(toProblem(e));
      },
    });
  }

  protected setRole(m: Member, role: TeamRole): void {
    this.api.changeRole(m.id, role).subscribe({
      next: (u) => {
        this.list.set((this.list.value() ?? []).map((x) => (x.id === u.id ? u : x)));
        this.toast.show(`${m.full_name} is now ${this.roleLabel(role).toLowerCase()}`);
      },
      error: (e: unknown) => {
        this.toast.show(toProblem(e).detail, 'error');
        this.list.reload();
      },
    });
  }

  protected remove(m: Member): void {
    this.api.removeMember(m.id).subscribe({
      next: () => {
        this.list.set((this.list.value() ?? []).filter((x) => x.id !== m.id));
        this.toast.show(`${m.full_name} removed`);
      },
      error: (e: unknown) => this.toast.show(toProblem(e).detail, 'error'),
    });
  }

  protected openPassword(m: Member): void {
    this.newPassword = '';
    this.problem.set(null);
    this.passwordFor.set(m);
  }

  protected savePassword(): void {
    const m = this.passwordFor();
    if (!m) return;
    this.api.resetMemberPassword(m.id, this.newPassword).subscribe({
      next: () => {
        this.passwordFor.set(null);
        this.toast.show(`Temporary password set for ${m.full_name}`);
      },
      error: (e: unknown) => this.problem.set(toProblem(e)),
    });
  }
}
