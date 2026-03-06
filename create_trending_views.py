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

WINDOWS = [1, 7, 14, 30, 90]

# ── CTE block (shared across all windows, only INTERVAL changes) ──────────────
#
# Key design: compare each shopify_variant_id to ITSELF (past vs current).
# Aggregating by printing_unique_id with MIN() used to compare CF Marvel ($180)
# past price against regular CF ($40) current price — a fake -77% drop.
# Now we join on (retailer_slug, shopify_variant_id) throughout, then use
# DISTINCT ON to pick the cheapest current variant per printing.
def make_mv_sql(days: int) -> str:
    return f"""
    WITH variant_earliest AS (
      -- Earliest date each variant appeared in the history window
      SELECT retailer_slug, shopify_variant_id, printing_unique_id, MIN(scraped_date) AS earliest_date
      FROM price_history
      WHERE condition = 'NM'
        AND in_stock = 1
        AND scraped_date >= CURRENT_DATE - INTERVAL '{days} days'
        AND scraped_date < CURRENT_DATE
        AND price_cad > 0
        AND printing_unique_id IS NOT NULL
        AND shopify_variant_id IS NOT NULL
      GROUP BY retailer_slug, shopify_variant_id, printing_unique_id
    ),
    variant_past AS (
      -- Price for each variant at its earliest date in the window
      SELECT ph.retailer_slug, ph.shopify_variant_id, ph.printing_unique_id,
             MIN(ph.price_cad) AS past_price
      FROM price_history ph
      JOIN variant_earliest ve
        ON ph.retailer_slug    = ve.retailer_slug
       AND ph.shopify_variant_id = ve.shopify_variant_id
       AND ph.scraped_date     = ve.earliest_date
      WHERE ph.condition = 'NM' AND ph.in_stock = 1 AND ph.price_cad > 0
      GROUP BY ph.retailer_slug, ph.shopify_variant_id, ph.printing_unique_id
    ),
    variant_current AS (
      -- Current price for the SAME variant (same retailer + same shopify_variant_id)
      SELECT rp.retailer_slug, rp.shopify_variant_id, rp.price_cad AS current_price
      FROM retailer_products rp
      JOIN variant_past vp
        ON rp.retailer_slug      = vp.retailer_slug
       AND rp.shopify_variant_id = vp.shopify_variant_id
      WHERE rp.in_stock = 1 AND rp.condition = 'NM' AND rp.price_cad > 0
    ),
    variant_changes AS (
      -- Per-variant price change (apples-to-apples: same variant past vs same variant now)
      SELECT
        vp.printing_unique_id,
        vp.past_price,
        vc.current_price
      FROM variant_past vp
      JOIN variant_current vc
        ON vp.retailer_slug      = vc.retailer_slug
       AND vp.shopify_variant_id = vc.shopify_variant_id
    ),
    printing_best AS (
      -- One row per printing: pick the variant with the lowest current price
      SELECT DISTINCT ON (printing_unique_id)
        printing_unique_id,
        past_price,
        current_price
      FROM variant_changes
      ORDER BY printing_unique_id, current_price ASC
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
      pb.current_price,
      pb.past_price,
      (pb.current_price - pb.past_price)                                              AS price_change,
      ROUND(((pb.current_price - pb.past_price) / pb.past_price * 100)::numeric, 1)  AS percent_change
    FROM printing_best pb
    JOIN printings p      ON pb.printing_unique_id = p.unique_id
    JOIN cards c          ON p.card_unique_id = c.unique_id
    LEFT JOIN sets s      ON p.set_id = s.set_code
    WHERE ((pb.current_price - pb.past_price) / pb.past_price * 100) BETWEEN -99 AND 1000
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
