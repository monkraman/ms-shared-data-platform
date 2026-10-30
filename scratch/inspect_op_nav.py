import sys

sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:/Users/Raman/.gemini/antigravity/brain/8430355a-2850-4ffc-a247-6940d455de76/.user_uploaded/media_1793345135064_d0509105.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

import re
navs = re.findall(r'<div class=\"nav\">(.*?)</div>\s*<div class=\"main\"', text, re.DOTALL)
if navs:
    print("OPERATOR NAV:")
    print(navs[0])

