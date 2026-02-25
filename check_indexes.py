import psycopg, os, time
from dotenv import load_dotenv
load_dotenv()
conn = psycopg.connect(os.getenv('NEON_DATABASE_URL'))
cur = conn.cursor()

# Check existing indexes on relevant tables
cur.execute("""
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('price_history', 'retailer_products', 'printings', 'cards')
ORDER BY tablename, indexname
""")
print("=== Existing Indexes ===")
for row in cur.fetchall():
    print(f"  [{row[0]}] {row[1]}")
    print(f"    {row[2]}")

# Time the full trending query
print("\n=== Query Timing ===")
t = time.time()
cur.execute("""
WITH retailer_earliest AS (
    SELECT retailer_slug, printing_unique_id, MIN(scraped_date) AS d
    FROM price_history
    WHERE condition = 'NM' AND in_stock = 1
      AND scraped_date >= CURRENT_DATE - INTERVAL '7 days'
      AND scraped_date < CURRENT_DATE
      AND price_cad > 0 AND printing_unique_id IS NOT NULL
    GROUP BY retailer_slug, printing_unique_id
),
retailer_past AS (
    SELECT ph.retailer_slug, ph.printing_unique_id, MIN(ph.price_cad) AS past_price
    FROM price_history ph
    JOIN retailer_earliest re
      ON ph.retailer_slug = re.retailer_slug
     AND ph.printing_unique_id = re.printing_unique_id
     AND ph.scraped_date = re.d
    WHERE ph.condition = 'NM' AND ph.in_stock = 1 AND ph.price_cad > 0
    GROUP BY ph.retailer_slug, ph.printing_unique_id
),
price_past AS (
    SELECT rp.printing_unique_id, MIN(rp.past_price) AS past_price
    FROM retailer_past rp
    JOIN retailer_products rc
      ON rp.retailer_slug = rc.retailer_slug
     AND rp.printing_unique_id = rc.printing_unique_id
    WHERE rc.in_stock = 1 AND rc.condition = 'NM'
    GROUP BY rp.printing_unique_id
),
price_current AS (
    SELECT rc.printing_unique_id, MIN(rc.price_cad) AS current_price
    FROM retailer_products rc
    JOIN retailer_past rp
      ON rc.retailer_slug = rp.retailer_slug
     AND rc.printing_unique_id = rp.printing_unique_id
    WHERE rc.in_stock = 1 AND rc.condition = 'NM' AND rc.printing_unique_id IS NOT NULL
    GROUP BY rc.printing_unique_id
)
SELECT COUNT(*) FROM price_past pp
JOIN price_current pc ON pp.printing_unique_id = pc.printing_unique_id
WHERE ABS(pc.current_price - pp.past_price) >= 1
  AND ((pc.current_price - pp.past_price) / pp.past_price * 100) BETWEEN -99 AND 1000
""")
elapsed = time.time() - t
print(f"  Full trending query: {elapsed*1000:.0f}ms  (result: {cur.fetchone()[0]} rows)")

# EXPLAIN the most expensive CTE
print("\n=== EXPLAIN ANALYZE: retailer_earliest scan ===")
cur.execute("""
EXPLAIN (ANALYZE, FORMAT TEXT)
SELECT retailer_slug, printing_unique_id, MIN(scraped_date) AS d
FROM price_history
WHERE condition = 'NM' AND in_stock = 1
  AND scraped_date >= CURRENT_DATE - INTERVAL '7 days'
  AND scraped_date < CURRENT_DATE
  AND price_cad > 0 AND printing_unique_id IS NOT NULL
GROUP BY retailer_slug, printing_unique_id
""")
for row in cur.fetchall()[:25]:
    print(f"  {row[0]}")

conn.close()
