import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

with open('scratch/mockup_styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

for sel in [r'\.cap\b', r'\.page\b', r'body\b', r'\.tight\b']:
    m = re.findall(rf'({sel}[^{{]*\{{[^}}]*\}})', css)
    for rule in m:
        print(rule)
        print('-'*20)

