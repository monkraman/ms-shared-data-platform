import base64

with open('reference-docs-teams/EPR-PPWR KHC client demo v1.html', 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

idx = html.lower().find('global dashboard')

src_idx = html.find('src="data:image', idx)
if src_idx != -1:
    quote_end = html.find('"', src_idx + 5)
    data_url = html[src_idx+5:quote_end]
    comma_idx = data_url.find(',')
    b64_str = data_url[comma_idx+1:]
    with open('scratch/screen_02_dashboard.jpg', 'wb') as img_out:
        img_out.write(base64.b64decode(b64_str))
    print("Saved scratch/screen_02_dashboard.jpg! Bytes:", len(b64_str))
