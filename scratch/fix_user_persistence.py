path_store = 'backend/app/services/store.py'
with open(path_store, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add USER_PERSISTENCE_FILE definition
if 'USER_PERSISTENCE_FILE' not in code:
    code = code.replace(
        'PERSISTENCE_FILE = PERSISTENCE_DIR / "persisted_tenants.json"',
        'PERSISTENCE_FILE = PERSISTENCE_DIR / "persisted_tenants.json"\nUSER_PERSISTENCE_FILE = PERSISTENCE_DIR / "persisted_users.json"'
    )

# 2. Add self._load_persisted_users() to __init__
if 'self._load_persisted_users()' not in code:
    code = code.replace(
        'self._load_persisted_tenants()',
        'self._load_persisted_tenants()\n        self._load_persisted_users()'
    )

# 3. Add _load_persisted_users and _save_persisted_user methods
methods = '''
    def _load_persisted_users(self) -> None:
        """Load any custom provisioned users across reboots."""
        if not USER_PERSISTENCE_FILE.exists():
            return
        try:
            with open(USER_PERSISTENCE_FILE, "r", encoding="utf-8") as f:
                records = json.load(f)
                for item in records:
                    email = item.get("email", "").lower().strip()
                    if email:
                        self.users[email] = item
        except Exception as e:
            print(f"[DataStore] Failed loading persisted users: {e}")

    def _save_persisted_user(self, user_data: dict) -> None:
        """Persist user record to disk."""
        try:
            PERSISTENCE_DIR.mkdir(parents=True, exist_ok=True)
            existing = []
            if USER_PERSISTENCE_FILE.exists():
                with open(USER_PERSISTENCE_FILE, "r", encoding="utf-8") as f:
                    try:
                        existing = json.load(f)
                    except Exception:
                        existing = []
            email = user_data["email"].lower().strip()
            existing = [u for u in existing if u.get("email", "").lower().strip() != email]
            existing.append(user_data)
            with open(USER_PERSISTENCE_FILE, "w", encoding="utf-8") as f:
                json.dump(existing, f, indent=2)
        except Exception as e:
            print(f"[DataStore] Failed saving persisted user: {e}")
'''

if '_load_persisted_users' not in code:
    idx = code.find('    def _load_persisted_tenants')
    if idx != -1:
        code = code[:idx] + methods + code[idx:]

# 4. In create_user, call self._save_persisted_user
old_create = """    def create_user(self, user_data: dict) -> dict:
        \"\"\"Register a new user under a specific organization or platform role.\"\"\"
        with self._lock:
            email = user_data["email"].lower().strip()
            self.users[email] = user_data
            return user_data"""

new_create = """    def create_user(self, user_data: dict) -> dict:
        \"\"\"Register a new user under a specific organization or platform role.\"\"\"
        with self._lock:
            email = user_data["email"].lower().strip()
            self.users[email] = user_data
            self._save_persisted_user(user_data)
            return user_data"""

if old_create in code:
    code = code.replace(old_create, new_create)

# 5. In onboard_tenant, persist default admin user if created
old_admin_user = """                self.users[admin_email] = {
                    "id": f"usr-{data.id[:4]}-{uuid4().hex[:4]}",
                    "email": admin_email,
                    "password": data.admin_password or "password123",
                    "full_name": data.admin_name or f"{data.name} Administrator",
                    "role": "org_admin",
                    "tenant_id": data.id,
                    "organisation_name": data.name,
                    "avatar_initials": initials,
                }"""

new_admin_user = """                new_admin = {
                    "id": f"usr-{data.id[:4]}-{uuid4().hex[:4]}",
                    "email": admin_email,
                    "password": data.admin_password or "password123",
                    "full_name": data.admin_name or f"{data.name} Administrator",
                    "role": "org_admin",
                    "tenant_id": data.id,
                    "organisation_name": data.name,
                    "avatar_initials": initials,
                }
                self.users[admin_email] = new_admin
                self._save_persisted_user(new_admin)"""

if old_admin_user in code:
    code = code.replace(old_admin_user, new_admin_user)

with open(path_store, 'w', encoding='utf-8') as f:
    f.write(code)

print('Updated store.py with user persistence successfully')
