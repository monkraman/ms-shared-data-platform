import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

with open('scratch/mockup_styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Let's search for .app, .main, .head, .card, .row, .steps, .tick, .btn, .dpt, .sample
selectors = [r'\.app\b', r'\.main\b', r'\.head\b', r'\.card\b', r'\.row\b', r'\.steps\b', r'\.tick\b', r'\.btn\b', r'\.tight\b', r'\.sample\b']

for s in selectors:
    m = re.findall(rf'({s}[^{{]*\{{[^}}]*\}})', css)
    for rule in m[:3]:
        print(rule[:150])
        print('-'*30)

