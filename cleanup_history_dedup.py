"""
cleanup_history_dedup.py  —  ONE-TIME run
==========================================
Removes redundant rows from price_history where the price, in_stock, and
condition are identical to the immediately preceding row for the same
(retailer_slug, shopify_variant_id).

Before: 838 K rows  (every scrape writes a row whether price moved or not)
After:  ~30-50 K rows  (only first appearance + actual price / stock changes)

Safe to run while the site is live — uses a DELETE ... USING CTE which is
atomic, and does NOT affect retailer_products or the trending MVs until we
explicitly REFRESH them at the end.

Run once:  python cleanup_history_dedup.py
"""

import os, sys, time
import psycopg
from psycopg.rows import tuple_row

# ── Connection ────────────────────────────────────────────────────────────────

NEON_URL = os.environ.get("NEON_DATABASE_URL", "")
if not NEON_URL:
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

# ── Helpers ───────────────────────────────────────────────────────────────────

def fmt(n):
    return f"{n:,}"


def main():
    print("Connecting to Neon...")
    with psycopg.connect(NEON_URL, row_factory=tuple_row) as conn:
        with conn.cursor() as cur:

            # ── 1. Snapshot before ────────────────────────────────────────────
            cur.execute("SELECT COUNT(*) FROM price_history")
            before_rows = cur.fetchone()[0]
            cur.execute(
                "SELECT pg_size_pretty(pg_total_relation_size('price_history'))"
            )
            before_size = cur.fetchone()[0]
            print(f"\nBefore: {fmt(before_rows)} rows  /  {before_size}")

            # ── 2. Deduplication DELETE ────────────────────────────────────────
            # Keep a row only if:
            #   a) It is the FIRST ever row for that (retailer, variant)  — rn = 1
            #   b) Its price_cad / in_stock / condition differ from the row
            #      immediately before it (by scraped_date order)
            #
            # All other rows are redundant copies and are deleted.
            # The LAG window runs on the original data so ordering is stable.
            print("\nRunning deduplication (this may take 10-30 s)...")
            t0 = time.time()
            cur.execute("""
                WITH ranked AS (
                    SELECT
                        retailer_slug,
                        shopify_variant_id,
                        scraped_date,
                        price_cad,
                        in_stock,
                        condition,
                        LAG(price_cad) OVER w AS prev_price,
                        LAG(in_stock)  OVER w AS prev_stock,
                        LAG(condition) OVER w AS prev_cond,
                        ROW_NUMBER()   OVER w AS rn
                    FROM price_history
                    WINDOW w AS (
                        PARTITION BY retailer_slug, shopify_variant_id
                        ORDER BY scraped_date
                    )
                ),
                to_delete AS (
                    SELECT retailer_slug, shopify_variant_id, scraped_date
                    FROM ranked
                    WHERE rn > 1                                    -- not first row
                      AND ABS(price_cad - prev_price) <= 0.001     -- price same
                      AND in_stock IS NOT DISTINCT FROM prev_stock  -- stock same
                      AND condition IS NOT DISTINCT FROM prev_cond  -- condition same
                )
                DELETE FROM price_history ph
                USING to_delete d
                WHERE ph.retailer_slug      = d.retailer_slug
                  AND ph.shopify_variant_id = d.shopify_variant_id
                  AND ph.scraped_date       = d.scraped_date
            """)
            deleted = cur.rowcount
            conn.commit()
            elapsed = round(time.time() - t0, 1)
            print(f"  Deleted {fmt(deleted)} redundant rows  ({elapsed}s)")

            # ── 3. Snapshot after ─────────────────────────────────────────────
            cur.execute("SELECT COUNT(*) FROM price_history")
            after_rows = cur.fetchone()[0]

            # Ask Postgres to reclaim freed pages (runs in background on Neon)
            print("\nRunning VACUUM ANALYZE on price_history...")
            conn.autocommit = True
            cur.execute("VACUUM ANALYZE price_history")
            conn.autocommit = False

            cur.execute(
                "SELECT pg_size_pretty(pg_total_relation_size('price_history'))"
            )
            after_size = cur.fetchone()[0]
            print(f"After:  {fmt(after_rows)} rows  /  {after_size}")
            pct = round((1 - after_rows / max(before_rows, 1)) * 100, 1)
            print(f"\nReduction: {pct}% fewer rows")

            # ── 4. Rebuild materialized views ─────────────────────────────────
            print("\nRebuilding trending materialized views with clean data...")
            conn.autocommit = True
            for days in [7, 14, 30, 90]:
                mv = f"trending_mv_{days}d"
                t0 = time.time()
                print(f"  REFRESH {mv}... ", end="", flush=True)
                cur.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {mv}")
                print(f"done ({round(time.time()-t0, 1)}s)")
            conn.autocommit = False

            # ── 5. Total DB size ──────────────────────────────────────────────
            cur.execute(
                "SELECT pg_size_pretty(pg_database_size(current_database()))"
            )
            total = cur.fetchone()[0]
            print(f"\nTotal DB size now: {total}")
            print("\nDone! Run the scraper normally going forward — it will only")
            print("write history rows when prices actually change.")


if __name__ == "__main__":
    main()
