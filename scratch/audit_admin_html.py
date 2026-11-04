with open('frontend/src/app/features/admin/admin.component.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "activeTab() === 'batches'" in line:
        print(f"Line {i+1}: {line.strip()}")
        # print surrounding 30 lines
        start = max(0, i-5)
        end = min(len(lines), i+35)
        for j in range(start, end):
            print(f"  {j+1}: {lines[j].rstrip()}")
        print("="*60)
