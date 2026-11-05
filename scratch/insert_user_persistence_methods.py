path_store = 'backend/app/services/store.py'
with open(path_store, 'r', encoding='utf-8') as f:
    code = f.read()

target = 'print(f"[DataStore] Failed saving persisted tenant: {e}")'

methods = '''print(f"[DataStore] Failed saving persisted tenant: {e}")

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
            print(f"[DataStore] Failed saving persisted user: {e}")'''

if 'def _load_persisted_users(self)' not in code:
    code = code.replace(target, methods, 1)
    with open(path_store, 'w', encoding='utf-8') as f:
        f.write(code)
    print('Inserted _load_persisted_users and _save_persisted_user methods successfully!')
else:
    print('Methods already present')

