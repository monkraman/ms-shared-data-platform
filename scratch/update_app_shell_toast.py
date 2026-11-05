path_app_ts = 'frontend/src/app/app.ts'
with open(path_app_ts, 'r', encoding='utf-8') as f:
    app_ts = f.read()

if 'ToastService' not in app_ts:
    app_ts = app_ts.replace(
        "import { QualityApiService } from './core/services/quality-api.service';",
        "import { QualityApiService } from './core/services/quality-api.service';\nimport { ToastService } from './core/services/toast.service';"
    )
    app_ts = app_ts.replace(
        "readonly qualityService = inject(QualityApiService);",
        "readonly qualityService = inject(QualityApiService);\n  readonly toastService = inject(ToastService);"
    )
    with open(path_app_ts, 'w', encoding='utf-8') as f:
        f.write(app_ts)
    print('app.ts updated with ToastService')

path_app_html = 'frontend/src/app/app.html'
with open(path_app_html, 'r', encoding='utf-8') as f:
    app_html = f.read()

toast_markup = '''
  <!-- Global Enterprise Toast Notification (Client Theme Accent) -->
  @if (toastService.currentToast(); as toast) {
    <div class="global-toast-container" [class]="'toast-' + toast.type" role="alert">
      <div class="toast-accent-bar" [style.background-color]="activeTenantColor()"></div>
      <div class="toast-content">
        <div class="toast-icon" [style.color]="activeTenantColor()">
          @if (toast.type === 'success') {
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          } @else if (toast.type === 'error') {
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          } @else {
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          }
        </div>
        <span class="toast-message">{{ toast.message }}</span>
        <button type="button" class="btn-toast-dismiss" (click)="toastService.dismiss()" aria-label="Dismiss">
          &times;
        </button>
      </div>
    </div>
  }
'''

if 'global-toast-container' not in app_html:
    app_html = app_html.replace('</main>\n\n</div>', '</main>\n' + toast_markup + '\n</div>')
    with open(path_app_html, 'w', encoding='utf-8') as f:
        f.write(app_html)
    print('app.html updated with global toast template')
else:
    print('app.html already has global toast')

