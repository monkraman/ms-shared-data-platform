import os
from pathlib import Path
import psycopg
from dotenv import load_dotenv

load_dotenv()

raw_url = os.environ.get("DATABASE_URL", "")
clean_url = raw_url.replace("&channel_binding=require", "").replace("channel_binding=require", "")
if "?" in clean_url:
    clean_url += "&connect_timeout=15"
else:
    clean_url += "?connect_timeout=15"

sql_path = Path(__file__).resolve().parent / "init_schema.sql"
print("Reading DDL from:", sql_path)

with open(sql_path, "r", encoding="utf-8") as f:
    ddl_sql = f.read()

print("Applying schema to Neon PostgreSQL...")
try:
    with psycopg.connect(clean_url) as conn:
        with conn.cursor() as cur:
            cur.execute(ddl_sql)
            conn.commit()
            print("[OK] All tables and schemas created in PostgreSQL successfully!")

            # Check created tables
            cur.execute("""
                SELECT table_schema, table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'platform' 
                ORDER BY table_name;
            """)
            tables = cur.fetchall()
            print(f"[OK] Found {len(tables)} tables in 'platform' schema:")
            for t in tables:
                print(f"  - {t[0]}.{t[1]}")
except Exception as e:
    print("[ERROR] Failed applying schema:", e)
