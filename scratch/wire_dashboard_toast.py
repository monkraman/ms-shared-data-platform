path_dash = 'frontend/src/app/features/dashboard/dashboard.component.ts'
with open(path_dash, 'r', encoding='utf-8') as f:
    dash = f.read()

if 'ToastService' not in dash:
    dash = dash.replace(
        "import { QualityApiService } from '../../core/services/quality-api.service';",
        "import { QualityApiService } from '../../core/services/quality-api.service';\nimport { ToastService } from '../../core/services/toast.service';"
    )
    dash = dash.replace(
        "readonly qualityService = inject(QualityApiService);",
        "readonly qualityService = inject(QualityApiService);\n  readonly toastService = inject(ToastService);"
    )
    dash = dash.replace(
        "document.body.removeChild(link);",
        "document.body.removeChild(link);\n    this.toastService.show('Executive Compliance Board Pack exported successfully', 'success');"
    )
    with open(path_dash, 'w', encoding='utf-8') as f:
        f.write(dash)
    print('dashboard.component.ts updated with ToastService')

