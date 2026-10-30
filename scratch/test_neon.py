import os
from dotenv import load_dotenv
import psycopg

load_dotenv('backend/.env')
db_url = os.getenv('DATABASE_URL')
print('Testing Neon connection...')

try:
    with psycopg.connect(db_url, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
            tables = [r[0] for r in cur.fetchall()]
            print('Tables found in Neon public schema:', tables)
except Exception as e:
    print('Connection error:', type(e), e)
