import sys
import psycopg

db_url = "postgresql://neondb_owner:npg_uzClgGiQ7b1E@ep-muddy-bird-b47a9kq9-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require"

try:
    print("Connecting to Neon...")
    conn = psycopg.connect(db_url)
    with conn.cursor() as cur:
        cur.execute("SELECT current_database(), current_user, version();")
        print("Connected successfully:", cur.fetchone())
        cur.execute("""
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog');
        """)
        tables = cur.fetchall()
        print("Existing tables in this DB:", tables)
    conn.close()
except Exception as e:
    print("Connection error:", e)

