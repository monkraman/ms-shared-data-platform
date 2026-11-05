# 1. Fix IssueStatus in layer2_quality.py
with open('backend/app/services/layer2_quality.py', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    "and i.status not in (IssueStatus.RESOLVED, IssueStatus.RESOLVED_IN_SOURCE)",
    "and i.status != IssueStatus.RESOLVED_IN_SOURCE"
)

with open('backend/app/services/layer2_quality.py', 'w', encoding='utf-8') as f:
    f.write(text)
print("Fixed layer2_quality.py IssueStatus")

# 2. Check store.py khc-europe active modules
with open('backend/app/services/store.py', 'r', encoding='utf-8') as f:
    store_text = f.read()

# Make sure khc-europe has dpp and lca in active_modules
if '"khc-europe"' in store_text:
    import re
    # check active_modules for khc-europe
    idx = store_text.find('"khc-europe"')
    sub = store_text[idx:idx+1500]
    print("KHC snippet in store.py:")
    print(sub[:400])

