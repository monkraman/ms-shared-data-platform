path_admin = 'frontend/src/app/features/admin/admin.component.ts'
with open(path_admin, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Improve matchesOrg in filteredUsers
old_matches_org = """      const matchesOrg =
        org === 'ALL' ||
        (org === 'platform' && !u.organisationId) ||
        u.organisationId === org;"""

new_matches_org = """      const orgLower = org.toLowerCase().trim();
      const matchesOrg =
        org === 'ALL' ||
        (org === 'platform' && !u.organisationId) ||
        u.organisationId === org ||
        (u.organisationSlug && u.organisationSlug.toLowerCase().trim() === orgLower) ||
        (u.organisationName && u.organisationName.toLowerCase().trim() === orgLower);"""

if old_matches_org in code:
    code = code.replace(old_matches_org, new_matches_org)

# 2. Reset filters on provision user so user is immediately visible
old_prov_next = """        next: (created) => {
          this.isProvisioning.set(false);
          this.inviteSuccess.set(`Successfully provisioned account for ${created.fullName}.`);
          this.loadUsers();"""

new_prov_next = """        next: (created) => {
          this.isProvisioning.set(false);
          this.inviteSuccess.set(`Successfully provisioned account for ${created.fullName}.`);
          this.userFilterOrg.set('ALL');
          this.userFilterRole.set('ALL');
          this.userSearchQuery.set('');
          this.loadUsers();"""

if old_prov_next in code:
    code = code.replace(old_prov_next, new_prov_next)

# 3. Call loadUsers on onboard org as well
old_onboard_next = """        setTimeout(() => {
          this.closeOnboardModal();
          this.refreshTenants();
        }, 1200);"""

new_onboard_next = """        setTimeout(() => {
          this.closeOnboardModal();
          this.refreshTenants();
          this.loadUsers();
        }, 1200);"""

if old_onboard_next in code:
    code = code.replace(old_onboard_next, new_onboard_next)

with open(path_admin, 'w', encoding='utf-8') as f:
    f.write(code)

print('Updated admin.component.ts with robust user filtering and refresh')
