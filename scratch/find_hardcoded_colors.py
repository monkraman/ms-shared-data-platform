import os, re
for root, dirs, files in os.walk('frontend/src/app'):
    for f in files:
        if f.endswith('.css'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as fp:
                txt = fp.read()
                for line in txt.splitlines():
                    if any(c in line for c in ['#09090b', '#111827', '#18181b', '#0f172a']) and ('background' in line or 'border' in line or 'color' in line):
                        if 'btn' in line or 'button' in line or 'active' in line or 'primary' in line:
                            print(f"{f}: {line.strip()}")

