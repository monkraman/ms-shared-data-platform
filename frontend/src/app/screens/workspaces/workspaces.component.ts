import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Workspace, WorkspaceStatus } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { toProblem } from '../../core/api/problem';
import { load } from '../../core/api/resource';
import { ToastService } from '../../core/services/toast.service';
import {
  ChipTone,
  Column,
  DataTableComponent,
  DrawerComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  PageHeaderComponent,
  StatusChipComponent,
} from '../../shared/ui';
import { WorkspaceWizardComponent } from './workspace-wizard.component';

/** Screen 2: SuperAdmin manages client workspaces. */
@Component({
  selector: 'app-workspaces',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    DatePipe,
    PageHeaderComponent,
    DataTableComponent,
    StatusChipComponent,
    DrawerComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    WorkspaceWizardComponent,
  ],
  template: `
    <app-page-header title="Client workspaces">
      <button type="button" class="btn btn-primary" (click)="wizardOpen.set(true)">New workspace</button>
    </app-page-header>

    <div class="toolbar">
      <input type="search" placeholder="Search" aria-label="Search workspaces" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      <select aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="draft">Draft</option>
        <option value="suspended">Suspended</option>
      </select>
    </div>

    @if (list.error(); as problem) {
      <app-error-state [problem]="problem" (retry)="list.reload()" />
    } @else if (!list.loading() && !rows().length) {
      <app-empty-state title="No workspaces">
        <button type="button" class="btn btn-primary" (click)="wizardOpen.set(true)">New workspace</button>
      </app-empty-state>
    } @else {
      <app-data-table [columns]="columns" [rows]="rows()" [loading]="list.loading()" [clickable]="true"
                      [trackBy]="byId" (rowClick)="selected.set($event)">
        <ng-template #cell let-row let-key="key" let-value="value">
          @switch (key) {
            @case ('name') {
              <span class="ws">
                @if (row.logo_url) {
                  <img class="logo" [src]="row.logo_url" alt="" />
                } @else {
                  <span class="dot" [style.background]="row.brand_color"></span>
                }
                <b>{{ row.name }}</b>
              </span>
            }
            @case ('status') {
              <app-status-chip [tone]="tone(row.status)">{{ label(row.status) }}</app-status-chip>
            }
            @case ('modules') {
              <span class="chips">
                @for (m of row.modules; track m) { <app-status-chip tone="blue">{{ m }}</app-status-chip> }
              </span>
            }
            @case ('last') {
              <span class="muted">{{ row.last_activity_at ? (row.last_activity_at | date: 'd MMM') : '—' }}</span>
            }
            @default { {{ value }} }
          }
        </ng-template>
      </app-data-table>
    }

    <app-drawer [open]="!!selected()" [title]="selected()?.name ?? ''" (closed)="selected.set(null)">
      @if (selected(); as ws) {
        @if (ws.logo_url) {
          <img class="logo-large" [src]="ws.logo_url" [alt]="ws.name + ' logo'" />
        }
        <dl class="facts">
          <dt>Status</dt>
          <dd><app-status-chip [tone]="tone(ws.status)">{{ label(ws.status) }}</app-status-chip></dd>
          <dt>Slug</dt>
          <dd class="mono">{{ ws.slug }}</dd>
          <dt>Sector</dt>
          <dd>{{ ws.sector }}</dd>
          <dt>Brand colour</dt>
          <dd><span class="ws"><span class="dot" [style.background]="ws.brand_color"></span><span class="mono">{{ ws.brand_color }}</span></span></dd>
          <dt>Countries</dt>
          <dd>{{ ws.countries.join(', ') || '—' }}</dd>
          <dt>Modules</dt>
          <dd>{{ ws.modules.join(', ') || '—' }}</dd>
          <dt>Users</dt>
          <dd>{{ ws.user_count }}</dd>
          <dt>Created</dt>
          <dd>{{ ws.created_at | date: 'd MMM y' }}</dd>
        </dl>
        <div class="section-label">Legal entities</div>
        @for (le of ws.legal_entities; track le.name) {
          <div class="entity"><b>{{ le.name }}</b><span class="muted">{{ le.country }} · {{ le.registration_number }}</span></div>
        } @empty {
          <p class="muted">None</p>
        }
      }
      <ng-container actions>
        @if (selected(); as ws) {
          <button type="button" class="btn btn-secondary" (click)="editing.set(ws)">Edit</button>
          @if (ws.status === 'suspended') {
            <button type="button" class="btn btn-primary" (click)="setStatus(ws, 'active')">Reactivate</button>
          } @else if (ws.status === 'active') {
            <button type="button" class="btn btn-secondary" (click)="setStatus(ws, 'suspended')">Suspend</button>
          }
        }
      </ng-container>
    </app-drawer>

    <app-workspace-wizard [open]="wizardOpen()" (closed)="wizardOpen.set(false)" (created)="created($event)" />
    <app-workspace-wizard [open]="!!editing()" [workspace]="editing()" (closed)="editing.set(null)" (updated)="updated($event)" />
  `,
  styles: `
    .ws {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 3px;
    }
    .logo {
      width: 22px;
      height: 22px;
      object-fit: contain;
      border-radius: 5px;
      background: #fff;
    }
    .logo-large {
      display: block;
      max-width: 160px;
      max-height: 56px;
      object-fit: contain;
      margin-bottom: 16px;
    }
    .entity {
      display: flex;
      flex-direction: column;
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
    }
  `,
})
export class WorkspacesComponent {
  private readonly api = inject(PlatformApi);
  private readonly toast = inject(ToastService);

  protected readonly q = signal('');
  protected readonly status = signal('');
  protected readonly list = load(() => this.api.workspaces());
  protected readonly selected = signal<Workspace | null>(null);
  protected readonly wizardOpen = signal(false);
  protected readonly editing = signal<Workspace | null>(null);

  protected readonly rows = computed(() => {
    const q = this.q().toLowerCase();
    return (this.list.value() ?? []).filter(
      (w) => (!q || w.name.toLowerCase().includes(q) || w.slug.includes(q)) && (!this.status() || w.status === this.status()),
    );
  });

  protected readonly columns: Column<Workspace>[] = [
    { key: 'name', label: 'Workspace' },
    { key: 'status', label: 'Status' },
    { key: 'countries', label: 'Countries', value: (w) => w.countries.join(', ') || '—' },
    { key: 'modules', label: 'Modules' },
    { key: 'users', label: 'Users', value: (w) => w.user_count, align: 'end' },
    { key: 'last', label: 'Last activity' },
  ];

  protected readonly byId = (w: Workspace) => w.id;

  protected tone(status: WorkspaceStatus): ChipTone {
    return status === 'active' ? 'green' : status === 'suspended' ? 'red' : 'neutral';
  }

  protected label(status: WorkspaceStatus): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  protected setStatus(ws: Workspace, status: WorkspaceStatus): void {
    this.api.updateWorkspace(ws.id, { status }).subscribe({
      next: (updated) => {
        this.replace(updated);
        this.toast.show(status === 'suspended' ? `${ws.name} suspended` : `${ws.name} reactivated`);
      },
      error: (e: unknown) => this.toast.show(toProblem(e).detail, 'error'),
    });
  }

  protected updated(ws: Workspace): void {
    this.editing.set(null);
    this.replace(ws);
    this.toast.show(`${ws.name} saved`);
  }

  private replace(ws: Workspace): void {
    this.selected.set(ws);
    this.list.set((this.list.value() ?? []).map((w) => (w.id === ws.id ? ws : w)));
  }

  protected created(ws: Workspace): void {
    this.wizardOpen.set(false);
    this.list.set([ws, ...(this.list.value() ?? [])]);
    this.toast.show(`${ws.name} created`);
  }
}
