import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('scratch/mockup_styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

import re

keys = ['steps', 'tick', 'btn', 'card', 'row', 'head', 'dpt', 'dpcb', 'dpna', 'cs-', 'tight', 'sample']

for k in keys:
    matches = re.findall(rf'([^{{;}}]*\.{k}[^{{]*\{{[^}}]*\}})', css)
    print(f"=== RULES FOR {k} ===")
    for m in matches[:5]:
        print(m.strip())

