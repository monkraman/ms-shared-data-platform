with open('frontend/src/app/features/data-overview/data-overview.component.ts', 'r', encoding='utf-8') as f:
    code = f.read()

if 'activeView = signal' not in code:
    code = code.replace(
        "readonly config = APP_CONFIG;",
        "readonly config = APP_CONFIG;\n  readonly activeView = signal<'flowchart' | 'table' | 'journey'>('flowchart');"
    )
    with open('frontend/src/app/features/data-overview/data-overview.component.ts', 'w', encoding='utf-8') as f:
        f.write(code)
    print("Added activeView to data-overview.component.ts")
else:
    print("activeView already exists")
