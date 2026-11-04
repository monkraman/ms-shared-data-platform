with open('scratch/dashboard_section.html', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.splitlines()
print(f"Total lines: {len(lines)}")
for i, line in enumerate(lines[:100]):
    print(f"{i+1}: {line[:120]}")
