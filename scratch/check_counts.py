import os
import psycopg
from dotenv import load_dotenv

load_dotenv('backend/.env')
db_url = os.getenv('DATABASE_URL')

with psycopg.connect(db_url, connect_timeout=10) as conn:
    with conn.cursor() as cur:
        for tbl in ['companies', 'market_registrations', 'products', 'packaging_components', 'sales_market', 'data_quality_issues', 'epr_tariffs']:
            cur.execute(f"SELECT count(*) FROM {tbl};")
            cnt = cur.fetchone()[0]
            print(f"{tbl}: {cnt} rows")

