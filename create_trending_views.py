"""
create_trending_views.py
Builds four materialized views (7d / 14d / 30d / 90d) that pre-compute the
trending query.  The scraper refreshes them after each run so they're always
fresh.  Querying an MV is a simple table scan (~5ms vs 252ms for the CTE chain).

Run once:  python create_trending_views.py
"""

import os, sys, time
import psycopg
from psycopg.rows import tuple_row

NEON_URL = os.environ.get("NEON_DATABASE_URL", "")
if not NEON_URL:
    # Try loading from .env.local in the web directory
    env_path = os.path.join(os.path.dirname(__file__), "web", ".env.local")
    if os.path.exists(env_path):
        for line in open(env_path, encoding="utf-8", errors="ignore"):
            line = line.strip()
            if line.startswith("NEON_DATABASE_URL="):
                NEON_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

if not NEON_URL:
    print("ERROR: NEON_DATABASE_URL not set")
    sys.exit(1)

WINDOWS = [7, 14, 30, 90]

# ── CTE block (shared across all windows, only INTERVAL changes) ──────────────
def make_mv_sql(days: int) -> str:
    return f"""
    WITH retailer_earliest AS (
      SELECT retailer_slug, printing_unique_id, MIN(scraped_date) AS d
      FROM price_history
      WHERE condition = 'NM'
        AND in_stock = 1
        AND scraped_date >= CURRENT_DATE - INTERVAL '{days} days'
        AND scraped_date < CURRENT_DATE
        AND price_cad > 0
        AND printing_unique_id IS NOT NULL
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
    SELECT
      c.unique_id        AS card_unique_id,
      c.name             AS card_name,
      c.types            AS card_types,
      c.type_text,
      p.unique_id        AS printing_unique_id,
      p.card_id,
      p.set_id,
      s.name             AS set_name,
      p.rarity,
      p.foiling,
      p.edition,
      p.image_url,
      pc.current_price,
      pp.past_price,
      (pc.current_price - pp.past_price)                                              AS price_change,
      ROUND(((pc.current_price - pp.past_price) / pp.past_price * 100)::numeric, 1)  AS percent_change
    FROM price_past pp
    JOIN price_current pc ON pp.printing_unique_id = pc.printing_unique_id
    JOIN printings p      ON pp.printing_unique_id = p.unique_id
    JOIN cards c          ON p.card_unique_id = c.unique_id
    LEFT JOIN sets s      ON p.set_id = s.set_code
    WHERE ((pc.current_price - pp.past_price) / pp.past_price * 100) BETWEEN -99 AND 1000
    """


def main():
    print("Connecting to Neon…")
    with psycopg.connect(NEON_URL, row_factory=tuple_row) as conn:
        conn.autocommit = True          # DDL doesn't need explicit tx
        with conn.cursor() as cur:
            for days in WINDOWS:
                mv = f"trending_mv_{days}d"
                print(f"\n-- {mv} --")

                # Drop + recreate (easier than ALTER MATERIALIZED VIEW)
                t0 = time.time()
                print(f"  Creating MV… ", end="", flush=True)
                cur.execute(f"DROP MATERIALIZED VIEW IF EXISTS {mv}")
                cur.execute(f"CREATE MATERIALIZED VIEW {mv} AS {make_mv_sql(days)}")
                cur.execute(f"SELECT COUNT(*) FROM {mv}")
                n = cur.fetchone()[0]
                print(f"{n} rows  ({round(time.time()-t0, 1)}s)")

                # Unique index → enables CONCURRENT refresh (no table lock)
                print(f"  Adding unique index… ", end="", flush=True)
                cur.execute(
                    f"CREATE UNIQUE INDEX {mv}_pkey ON {mv} (printing_unique_id)"
                )
                print("done")

                # Extra index for ordering by price_change
                print(f"  Adding sort index… ", end="", flush=True)
                cur.execute(
                    f"CREATE INDEX {mv}_change ON {mv} (price_change)"
                )
                print("done")

            # ── Quick timing test ──────────────────────────────────────────
            print("\n-- Timing check --")
            for days in WINDOWS:
                mv = f"trending_mv_{days}d"
                t0 = time.time()
                cur.execute(
                    f"SELECT * FROM {mv} WHERE ABS(price_change) >= 1 "
                    f"ORDER BY ABS(price_change) DESC LIMIT 200"
                )
                rows = cur.fetchall()
                ms = round((time.time() - t0) * 1000)
                print(f"  {mv}: {ms}ms  ({len(rows)} rows)")

    print("\nDone!")


if __name__ == "__main__":
    main()
