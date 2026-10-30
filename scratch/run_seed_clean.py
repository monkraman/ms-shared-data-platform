import os
import psycopg
from dotenv import load_dotenv

load_dotenv('backend/.env')
db_url = os.getenv('DATABASE_URL')

with open('docs/SEED_BENCHMARK_DATA.sql', 'r', encoding='utf-8') as f:
    sql_script = f.read()

# Separate statements by semicolons
statements = [s.strip() for s in sql_script.split(';') if s.strip()]

print(f"Connecting to Neon and executing {len(statements)} seed statements...")
with psycopg.connect(db_url, connect_timeout=15, autocommit=True) as conn:
    with conn.cursor() as cur:
        for i, stmt in enumerate(statements, 1):
            cur.execute(stmt)
            print(f"Executed statement {i}/{len(statements)}")

print("Verifying row counts after seed...")
with psycopg.connect(db_url, connect_timeout=15) as conn:
    with conn.cursor() as cur:
        for tbl in ['companies', 'market_registrations', 'products', 'packaging_components', 'sales_market', 'epr_tariffs']:
            cur.execute(f"SELECT count(*) FROM {tbl};")
            print(f"-> {tbl}: {cur.fetchone()[0]} rows")
print("ALL SEED DATA CONFIRMED IN NEON!")

