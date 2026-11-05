import json

path = 'backend/app/data/persisted_tenants.json'
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

for item in data:
    if item.get('id') == 'khc-europe':
        item['active_modules'] = ['epr', 'ppwr', 'dpp', 'lca']

with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print("Updated khc-europe in persisted_tenants.json with full enterprise modules")

