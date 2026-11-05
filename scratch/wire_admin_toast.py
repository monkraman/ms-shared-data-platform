path_admin = 'frontend/src/app/features/admin/admin.component.ts'
with open(path_admin, 'r', encoding='utf-8') as f:
    adm = f.read()

if 'ToastService' not in adm:
    adm = adm.replace(
        "import { TenantApiService, BackendTenantRecord } from '../../core/services/tenant-api.service';",
        "import { TenantApiService, BackendTenantRecord } from '../../core/services/tenant-api.service';\nimport { ToastService } from '../../core/services/toast.service';"
    )
    adm = adm.replace(
        "readonly tenantService = inject(TenantApiService);",
        "readonly tenantService = inject(TenantApiService);\n  readonly toastService = inject(ToastService);"
    )
    adm = adm.replace(
        "this.moduleSaveSuccess.set(`Workspace \"${updated.name}\" updated successfully!`);",
        "this.moduleSaveSuccess.set(`Workspace \"${updated.name}\" updated successfully!`);\n        this.toastService.show(`✓ Workspace \"${updated.name}\" theme & configuration updated`, 'success');"
    )
    with open(path_admin, 'w', encoding='utf-8') as f:
        f.write(adm)
    print('admin.component.ts updated with ToastService')

