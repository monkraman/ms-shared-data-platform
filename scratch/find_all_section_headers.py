with open('frontend/src/app/features/admin/admin.component.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'section-header' in line:
        print(f"section-header at line {i+1}:")
        for j in range(i, min(len(lines), i+12)):
            try:
                print(f"  {lines[j].rstrip()}")
            except Exception:
                pass
        print("-" * 50)
