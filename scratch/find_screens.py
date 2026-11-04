import re

with open('reference-docs-teams/EPR-PPWR KHC client demo v1.html', 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

print(f"Total HTML size: {len(html)} bytes")

# Find occurrences of screen titles or screens
screen_matches = re.findall(r'id=["\'](screen[^"\']+)["\']', html, re.IGNORECASE)
print(f"Found {len(screen_matches)} screens by id:")
for s in screen_matches[:15]:
    print(" -", s)

# Find sections or comments or titles
titles = re.findall(r'<h[1-3][^>]*>(.*?)</h[1-3]>', html, re.DOTALL)
print(f"\nFound {len(titles)} headings:")
for t in titles[:20]:
    clean_t = re.sub(r'<[^>]+>', '', t).strip()
    if clean_t:
        print(" -", clean_t)
