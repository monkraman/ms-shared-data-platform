import os
from dotenv import load_dotenv
import psycopg

load_dotenv('backend/.env')
db_url = os.getenv('DATABASE_URL')
print('Database URL:', db_url[:45] + '...')

try:
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute('SELECT current_database(), current_user, version();')
            db, user, ver = cur.fetchone()
            print(f'Connected successfully! Database: {db}, User: {user}')
            print(f'Postgres version: {ver[:40]}')
            
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
            tables = cur.fetchall()
            print(f'Tables found in public schema ({len(tables)}):', [t[0] for t in tables])
except Exception as e:
    print('Connection error:', type(e), e)
