path = 'frontend/src/app/features/dashboard/dashboard.component.ts'
with open(path, 'r', encoding='utf-8') as f:
    txt = f.read()
target = "import { AuthService } from '../../core/services/auth.service';"
replacement = target + "\nimport { ToastService } from '../../core/services/toast.service';"
txt = txt.replace(target, replacement)
with open(path, 'w', encoding='utf-8') as f:
    f.write(txt)
print('Added ToastService to dashboard.component.ts')

