with open('frontend/src/app/features/admin/admin.component.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "id=\"tab-batches\"" in line or "Ingestion History & Source Batches" in line:
        print(f"Match at line {i+1}:")
        for j in range(max(0, i-5), min(len(lines), i+25)):
            try:
                print(f"  {j+1}: {lines[j].rstrip()}")
            except Exception:
                print(f"  {j+1}: [unicode error]")
