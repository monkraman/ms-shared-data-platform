import os, re

for f in os.listdir('backend/app/api/v1'):
    if f.endswith('.py') and not f.startswith('__'):
        path = os.path.join('backend/app/api/v1', f)
        with open(path, 'r', encoding='utf-8') as fp:
            txt = fp.read()
            endpoints = re.findall(r'@router\.(post|put|patch|delete)\([\'"]([^\'"]+)[\'"]', txt)
            if endpoints:
                print(f'{f}:')
                for method, ep in endpoints:
                    print(f'  {method.upper()} {ep}')

