"""
Add optimized indexes for the trending query.
Run once: python add_trending_indexes.py
"""
import psycopg, os, time
from dotenv import load_dotenv
load_dotenv()

conn = psycopg.connect(os.getenv('NEON_DATABASE_URL'), autocommit=True)
cur = conn.cursor()

indexes = [
    # ── price_history ─────────────────────────────────────────────────────────
    # Partial index: covers all WHERE filters, then the GROUP BY columns.
    # The WHERE clause matches exactly what retailer_earliest and retailer_past
    # filter on, so Postgres can satisfy both CTEs with an index-only scan.
    (
        "idx_ph_trending",
        """
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ph_trending
        ON price_history (scraped_date, retailer_slug, printing_unique_id)
        INCLUDE (price_cad)
        WHERE condition = 'NM' AND in_stock = 1 AND price_cad > 0
        """
    ),
    # ── retailer_products ─────────────────────────────────────────────────────
    # Covers the price_past / price_current join:
    #   WHERE in_stock = 1 AND condition = 'NM'
    #   JOIN ON retailer_slug + printing_unique_id
    #   SELECT MIN(price_cad)
    (
        "idx_rp_trending",
        """
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rp_trending
        ON retailer_products (retailer_slug, printing_unique_id)
        INCLUDE (price_cad)
        WHERE in_stock = 1 AND condition = 'NM'
        """
    ),
]

for name, sql in indexes:
    print(f"Creating {name}...", end=" ", flush=True)
    t = time.time()
    cur.execute(sql)
    elapsed = time.time() - t
    print(f"done ({elapsed:.1f}s)")

# Verify
cur.execute("""
SELECT indexname, indexdef
FROM pg_indexes
WHERE indexname IN ('idx_ph_trending', 'idx_rp_trending')
""")
print("\nCreated indexes:")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1][:80]}...")

# Re-time the query
print("\nRe-timing the trending query...")
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
print(f"  After new indexes: {elapsed*1000:.0f}ms  (was 581ms)")

conn.close()
