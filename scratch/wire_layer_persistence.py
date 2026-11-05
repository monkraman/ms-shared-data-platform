# 1. Update layer1_foundation.py
path_l1 = 'backend/app/services/layer1_foundation.py'
with open(path_l1, 'r', encoding='utf-8') as f:
    l1 = f.read()

target_l1 = 'return SkuImportResponse('
replacement_l1 = '''data_store.save_persisted_products(tenant_id)
            data_store.save_persisted_issues(tenant_id)
            data_store.save_persisted_batches(tenant_id)
            return SkuImportResponse('''

if target_l1 in l1 and 'save_persisted_products' not in l1:
    l1 = l1.replace(target_l1, replacement_l1, 1)

target_sync = 'return batch'
replacement_sync = '''data_store.save_persisted_batches(tenant_id)
            return batch'''

if 'simulate_trace_one_sync' in l1 and 'save_persisted_batches' not in l1:
    l1 = l1.replace(target_sync, replacement_sync, 1)

with open(path_l1, 'w', encoding='utf-8') as f:
    f.write(l1)
print('Updated layer1_foundation.py with persistence triggers')

# 2. Update layer2_quality.py
path_l2 = 'backend/app/services/layer2_quality.py'
with open(path_l2, 'r', encoding='utf-8') as f:
    l2 = f.read()

target_res = 'return issue'
replacement_res = '''data_store.save_persisted_issues(tenant_id)
            data_store.save_persisted_products(tenant_id)
            return issue'''

if 'mark_resolved_in_source' in l2 and 'save_persisted_issues' not in l2:
    # Replace in mark_resolved_in_source
    idx = l2.find('def mark_resolved_in_source')
    if idx != -1:
        sub = l2[idx:]
        sub = sub.replace('return issue', replacement_res, 1)
        l2 = l2[:idx] + sub

with open(path_l2, 'w', encoding='utf-8') as f:
    f.write(l2)
print('Updated layer2_quality.py with persistence triggers')

