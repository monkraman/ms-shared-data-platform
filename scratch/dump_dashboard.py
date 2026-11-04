import re

with open('reference-docs-teams/EPR-PPWR KHC client demo v1.html', 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

# Let's find "global dashboard"
idx = html.find('global dashboard')
if idx == -1:
    idx = html.lower().find('global dashboard')

print(f"Index: {idx}")
if idx != -1:
    start = max(0, idx - 2000)
    end = min(len(html), idx + 10000)
    with open('scratch/dashboard_section.html', 'w', encoding='utf-8') as out:
        out.write(html[start:end])
    print("Written to scratch/dashboard_section.html")
