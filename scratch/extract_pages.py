import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:/Users/Raman/.gemini/antigravity/brain/8430355a-2850-4ffc-a247-6940d455de76/.user_uploaded/media_1793345135062_c322e771.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# Let's find each <section class="page" ...>
pages = re.findall(r'(<section class="page"[^>]*>.*?</section>)', text, re.DOTALL)
print(f"Total pages found: {len(pages)}")

for i, p in enumerate(pages[:6]):
    # find caption or title
    title_match = re.search(r'<span class="t">(.*?)</span>', p)
    title = title_match.group(1) if title_match else f"Page {i+1}"
    print(f"Page {i+1}: {title} (Length: {len(p)})")
    with open(f"scratch/page_{i+1}.html", "w", encoding="utf-8") as pf:
        pf.write(p)

