import sys

sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:/Users/Raman/.gemini/antigravity/brain/8430355a-2850-4ffc-a247-6940d455de76/.user_uploaded/media_1793345135062_c322e771.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

import re
# Let's see the CSS and styling of the mockups
style_match = re.search(r'<style>(.*?)</style>', text, re.DOTALL)
if style_match:
    with open('scratch/mockup_styles.css', 'w', encoding='utf-8') as sf:
        sf.write(style_match.group(1))
    print("Styles extracted! Length:", len(style_match.group(1)))

