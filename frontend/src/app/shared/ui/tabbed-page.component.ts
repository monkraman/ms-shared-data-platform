import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../../core/session/session.service';

export interface PageTab {
  label: string;
  /** Child route path. */
  path: string;
  permission?: string;
}

/**
 * A page made of existing screens shown as tabs (for example Setup: Data connections, People).
 * The tabs come from the route's `data.tabs`; each is shown only with its permission, and each
 * child route keeps its own permission guard.
 */
@Component({
  selector: 'app-tabbed-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    @if (visible().length > 1) {
      <nav class="segmented page-tabs" aria-label="Sections">
        @for (t of visible(); track t.path) {
          <a [routerLink]="t.path" routerLinkActive="on" [attr.aria-current]="null">{{ t.label }}</a>
        }
      </nav>
    }
    <router-outlet />
  `,
  styles: `
    .page-tabs {
      margin-bottom: 8px;
    }
    .page-tabs a {
      text-decoration: none;
    }
  `,
})
export class TabbedPageComponent {
  private readonly session = inject(SessionService);
  readonly tabs = input<PageTab[]>([]);
  protected readonly visible = computed(() => this.tabs().filter((t) => this.session.can(t.permission)));
}
