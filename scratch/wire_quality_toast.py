path_qual = 'frontend/src/app/features/quality/quality.component.ts'
with open(path_qual, 'r', encoding='utf-8') as f:
    qual = f.read()

if 'ToastService' not in qual:
    qual = qual.replace(
        "import { QualityApiService, DataQualityIssue } from '../../core/services/quality-api.service';",
        "import { QualityApiService, DataQualityIssue } from '../../core/services/quality-api.service';\nimport { ToastService } from '../../core/services/toast.service';"
    )
    qual = qual.replace(
        "readonly qualityService = inject(QualityApiService);",
        "readonly qualityService = inject(QualityApiService);\n  readonly toastService = inject(ToastService);"
    )
    qual = qual.replace(
        "this.dispatchSuccessMessage.set(`[RESOLVED] Gap ${gapId} successfully closed and verified in master database!`);",
        "this.dispatchSuccessMessage.set(`[RESOLVED] Gap ${gapId} successfully closed and verified in master database!`);\n          this.toastService.show(`✓ Gap ${gapId} resolved in source system (Trace One PLM)`, 'success');"
    )
    qual = qual.replace(
        "document.body.removeChild(link);",
        "document.body.removeChild(link);\n        this.toastService.show('Audit gap remediation worklist exported (JSON)', 'success');"
    )
    with open(path_qual, 'w', encoding='utf-8') as f:
        f.write(qual)
    print('quality.component.ts updated with ToastService')

