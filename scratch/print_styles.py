import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('scratch/mockup_styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

print(css[:3000])

