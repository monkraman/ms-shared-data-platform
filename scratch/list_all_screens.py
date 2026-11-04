import re

with open('reference-docs-teams/EPR-PPWR KHC client demo v1.html', 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

# Find all screen headings or labels
screens = re.findall(r'<h3[^>]*>(.*?)</h3>', html)
print(f"Total h3: {len(screens)}")
for i, s in enumerate(screens):
    clean = re.sub(r'<[^>]+>', '', s).strip()
    print(f"Screen {i+1}: {clean}")
