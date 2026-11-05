path_store = 'backend/app/services/store.py'
with open(path_store, 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace('from threading import Lock', 'from threading import RLock')
code = code.replace('self._lock = Lock()', 'self._lock = RLock()')

with open(path_store, 'w', encoding='utf-8') as f:
    f.write(code)

print('Switched Lock to RLock in store.py successfully')

