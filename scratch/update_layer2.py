with open('backend/app/services/layer2_quality.py', 'r', encoding='utf-8') as f:
    code = f.read()

target = """            # Update tenant counts
            tenant = data_store.tenants.get(tenant_id)
            if tenant and tenant.open_quality_issues_count > 0:
                tenant.open_quality_issues_count -= 1

            return issue"""

replacement = """            # Update tenant counts
            tenant = data_store.tenants.get(tenant_id)
            if tenant and tenant.open_quality_issues_count > 0:
                tenant.open_quality_issues_count -= 1

            # Check if associated product has other open issues
            prods = data_store.products.get(tenant_id, {})
            for p in prods.values():
                if p.sku == issue.entity_id or any(c.id == issue.entity_id for c in p.components):
                    remaining = [
                        i for i in tenant_issues.values()
                        if (i.entity_id == p.sku or any(c.id == i.entity_id for c in p.components))
                        and i.status not in (IssueStatus.RESOLVED, IssueStatus.RESOLVED_IN_SOURCE)
                    ]
                    if not remaining:
                        p.has_quality_issues = False
                        p.open_issue_count = 0
                    else:
                        p.open_issue_count = len(remaining)

            return issue"""

if target in code:
    code = code.replace(target, replacement)
    with open('backend/app/services/layer2_quality.py', 'w', encoding='utf-8') as f:
        f.write(code)
    print("Successfully updated mark_resolved_in_source in layer2_quality.py")
else:
    print("Target not found in layer2_quality.py")
