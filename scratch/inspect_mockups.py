import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:/Users/Raman/.gemini/antigravity/brain/8430355a-2850-4ffc-a247-6940d455de76/.user_uploaded/media_1793345135062_c322e771.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

sections = ["Company & entities", "Which data points do you have?", "Connect your systems"]

for s in sections:
    pos = text.find(s)
    if pos != -1:
        print("="*60)
        print(f"SECTION: {s}")
        print("="*60)
        snippet = text[max(0, pos-200):min(len(text), pos+2000)]
        print(snippet[:1800])
