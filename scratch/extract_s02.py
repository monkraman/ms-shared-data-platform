import re
import base64

with open('reference-docs-teams/EPR-PPWR KHC client demo v1.html', 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

# Find all screens: <h3 ...> or <div class="screen ...
# Let's search for s02 or the img src near global dashboard
idx = html.lower().find('global dashboard')
print("Index:", idx)
sub = html[idx:idx+500000]

img_match = re.search(r'src="data:image/(jpeg|png);base64,([^"]+)"', sub)
if img_match:
    ext = img_match.group(1)
    b64_data = img_match.group(2)
    with open(f'scratch/screen_02_dashboard.{ext}', 'wb') as img_out:
        img_out.write(base64.b64decode(b64_data))
    print(f"Saved scratch/screen_02_dashboard.{ext}, size: {len(b64_data)} b64 bytes")
else:
    print("No img found near global dashboard")
