import os, re
classes = set()
for root, dirs, files in os.walk('frontend/src/app/features'):
    for f in files:
        if f.endswith('.html'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as fp:
                txt = fp.read()
                matches = re.findall(r'class=[\'"]([^\'"]*(?:btn|action)[^\'"]*)[\'"]', txt)
                for m in matches:
                    for cls in m.split():
                        if 'btn' in cls or 'action' in cls:
                            classes.add(cls)
print(sorted(list(classes)))

