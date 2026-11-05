path_sim = 'frontend/src/app/features/simulator/simulator.component.ts'
with open(path_sim, 'r', encoding='utf-8') as f:
    sim = f.read()

if 'ToastService' not in sim:
    sim = sim.replace(
        "import { FoundationApiService } from '../../core/services/foundation-api.service';",
        "import { FoundationApiService } from '../../core/services/foundation-api.service';\nimport { ToastService } from '../../core/services/toast.service';"
    )
    sim = sim.replace(
        "readonly foundationService = inject(FoundationApiService);",
        "readonly foundationService = inject(FoundationApiService);\n  readonly toastService = inject(ToastService);"
    )
    sim = sim.replace(
        "document.body.removeChild(link);",
        "document.body.removeChild(link);\n    this.toastService.show('Official UK Defra RPD CSV exported successfully', 'success');"
    )
    with open(path_sim, 'w', encoding='utf-8') as f:
        f.write(sim)
    print('simulator.component.ts updated with ToastService')

