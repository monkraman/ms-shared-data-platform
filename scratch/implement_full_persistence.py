path_store = 'backend/app/services/store.py'
with open(path_store, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Definitions of persistence paths
target_defs = 'USER_PERSISTENCE_FILE = PERSISTENCE_DIR / "persisted_users.json"'
new_defs = '''USER_PERSISTENCE_FILE = PERSISTENCE_DIR / "persisted_users.json"
PRODUCT_PERSISTENCE_FILE = PERSISTENCE_DIR / "persisted_products.json"
ISSUE_PERSISTENCE_FILE = PERSISTENCE_DIR / "persisted_issues.json"
BATCH_PERSISTENCE_FILE = PERSISTENCE_DIR / "persisted_batches.json"'''

if 'PRODUCT_PERSISTENCE_FILE' not in code:
    code = code.replace(target_defs, new_defs)

# 2. Add loading to __init__
init_target = 'self._load_persisted_users()'
init_new = '''self._load_persisted_users()
        self._load_persisted_products()
        self._load_persisted_issues()
        self._load_persisted_batches()'''

if 'self._load_persisted_products()' not in code:
    code = code.replace(init_target, init_new)

# 3. Add persistence methods
persistence_methods = '''
    def _load_persisted_products(self) -> None:
        """Load any custom or newly imported products across reboots."""
        if not PRODUCT_PERSISTENCE_FILE.exists():
            return
        try:
            with open(PRODUCT_PERSISTENCE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                for tid, prods in data.items():
                    if tid not in self.products:
                        self.products[tid] = {}
                    for sku, p_dict in prods.items():
                        self.products[tid][sku] = ProductResponse(**p_dict)
        except Exception as e:
            print(f"[DataStore] Failed loading persisted products: {e}")

    def save_persisted_products(self, tenant_id: Optional[str] = None) -> None:
        """Persist products to disk."""
        try:
            PERSISTENCE_DIR.mkdir(parents=True, exist_ok=True)
            existing = {}
            if PRODUCT_PERSISTENCE_FILE.exists():
                with open(PRODUCT_PERSISTENCE_FILE, "r", encoding="utf-8") as f:
                    try:
                        existing = json.load(f)
                    except Exception:
                        existing = {}
            with self._lock:
                targets = [tenant_id] if tenant_id else list(self.products.keys())
                for tid in targets:
                    existing[tid] = {
                        sku: prod.model_dump(mode="json")
                        for sku, prod in self.products.get(tid, {}).items()
                    }
            with open(PRODUCT_PERSISTENCE_FILE, "w", encoding="utf-8") as f:
                json.dump(existing, f, indent=2)
        except Exception as e:
            print(f"[DataStore] Failed saving persisted products: {e}")

    def _load_persisted_issues(self) -> None:
        """Load any custom or remediated quality issues across reboots."""
        if not ISSUE_PERSISTENCE_FILE.exists():
            return
        try:
            with open(ISSUE_PERSISTENCE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                for tid, issues in data.items():
                    if tid not in self.quality_issues:
                        self.quality_issues[tid] = {}
                    for iid, i_dict in issues.items():
                        self.quality_issues[tid][iid] = DataQualityIssue(**i_dict)
        except Exception as e:
            print(f"[DataStore] Failed loading persisted issues: {e}")

    def save_persisted_issues(self, tenant_id: Optional[str] = None) -> None:
        """Persist quality issues to disk."""
        try:
            PERSISTENCE_DIR.mkdir(parents=True, exist_ok=True)
            existing = {}
            if ISSUE_PERSISTENCE_FILE.exists():
                with open(ISSUE_PERSISTENCE_FILE, "r", encoding="utf-8") as f:
                    try:
                        existing = json.load(f)
                    except Exception:
                        existing = {}
            with self._lock:
                targets = [tenant_id] if tenant_id else list(self.quality_issues.keys())
                for tid in targets:
                    existing[tid] = {
                        iid: issue.model_dump(mode="json")
                        for iid, issue in self.quality_issues.get(tid, {}).items()
                    }
            with open(ISSUE_PERSISTENCE_FILE, "w", encoding="utf-8") as f:
                json.dump(existing, f, indent=2)
        except Exception as e:
            print(f"[DataStore] Failed saving persisted issues: {e}")

    def _load_persisted_batches(self) -> None:
        """Load any custom ingestion batches across reboots."""
        if not BATCH_PERSISTENCE_FILE.exists():
            return
        try:
            with open(BATCH_PERSISTENCE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                for tid, b_list in data.items():
                    if tid not in self.batches:
                        self.batches[tid] = []
                    for b_dict in b_list:
                        # Avoid duplicates
                        existing_ids = {b.id for b in self.batches[tid]}
                        if b_dict.get("id") not in existing_ids:
                            self.batches[tid].append(IngestionBatch(**b_dict))
        except Exception as e:
            print(f"[DataStore] Failed loading persisted batches: {e}")

    def save_persisted_batches(self, tenant_id: Optional[str] = None) -> None:
        """Persist ingestion batches to disk."""
        try:
            PERSISTENCE_DIR.mkdir(parents=True, exist_ok=True)
            existing = {}
            if BATCH_PERSISTENCE_FILE.exists():
                with open(BATCH_PERSISTENCE_FILE, "r", encoding="utf-8") as f:
                    try:
                        existing = json.load(f)
                    except Exception:
                        existing = {}
            with self._lock:
                targets = [tenant_id] if tenant_id else list(self.batches.keys())
                for tid in targets:
                    existing[tid] = [
                        b.model_dump(mode="json")
                        for b in self.batches.get(tid, [])
                    ]
            with open(BATCH_PERSISTENCE_FILE, "w", encoding="utf-8") as f:
                json.dump(existing, f, indent=2)
        except Exception as e:
            print(f"[DataStore] Failed saving persisted batches: {e}")
'''

if 'def save_persisted_products' not in code:
    insert_point = '    def _save_persisted_user'
    idx = code.find(insert_point)
    if idx != -1:
        code = code[:idx] + persistence_methods + '\n' + code[idx:]

with open(path_store, 'w', encoding='utf-8') as f:
    f.write(code)

print('Updated store.py with full product, issue, and batch persistence!')

