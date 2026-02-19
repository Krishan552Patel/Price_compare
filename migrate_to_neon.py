"""
One-shot migration from Turso (SQLite over libsql) to Neon (PostgreSQL).

Usage (PowerShell):
  # 1) Set secrets as env vars (do NOT paste secrets into commands you share)
  #    Replace {{NEON_DATABASE_URL}} and ensure TURSO_* are already set in .env
  $env:NEON_DATABASE_URL = "{{NEON_DATABASE_URL}}"

  # 2) Install deps
  pip install -r requirements.txt

  # 3) Run migration (reads from TURSO, writes to NEON)
  python migrate_to_neon.py

What it does:
- Creates PostgreSQL schema (tables + indexes)
- Copies data in batches (static tables first, then relational tables)
- Skips existing rows on conflict to allow safe re-runs

Safe to re-run: yes (idempotent-ish)
"""

import os
import math
import asyncio
from typing import Any, List, Tuple

import psycopg
from psycopg.rows import dict_row
import libsql_client
from dotenv import load_dotenv

load_dotenv()

# --------- Config ---------
TURSO_URL = os.getenv("TURSO_DATABASE_URL", "").replace("libsql://", "https://")
TURSO_TOKEN = os.getenv("TURSO_AUTH_TOKEN", "")
NEON_URL = os.getenv("NEON_DATABASE_URL", "")
BATCH = 1000

if not TURSO_URL or not TURSO_TOKEN:
    raise SystemExit("Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in env")
if not NEON_URL:
    raise SystemExit("Missing NEON_DATABASE_URL in env")

# --------- Schema (PostgreSQL) ---------
SCHEMA_SQL = """
-- Core lookup tables
CREATE TABLE IF NOT EXISTS sets (
  set_code text PRIMARY KEY,
  name text
);
CREATE TABLE IF NOT EXISTS rarities (
  unique_id text PRIMARY KEY,
  name text
);
CREATE TABLE IF NOT EXISTS foilings (
  unique_id text PRIMARY KEY,
  name text
);
CREATE TABLE IF NOT EXISTS editions (
  unique_id text PRIMARY KEY,
  name text
);

-- Cards & printings
CREATE TABLE IF NOT EXISTS cards (
  unique_id text PRIMARY KEY,
  name text,
  color text,
  pitch text,
  cost text,
  power text,
  defense text,
  health text,
  intelligence text,
  types text,             -- JSON (as text)
  traits text,            -- JSON (as text)
  card_keywords text,     -- JSON (as text)
  functional_text text,
  functional_text_plain text,
  type_text text,
  blitz_legal integer,
  cc_legal integer,
  commoner_legal integer,
  ll_legal integer
);

CREATE TABLE IF NOT EXISTS printings (
  unique_id text PRIMARY KEY,
  card_unique_id text,
  card_id text,
  set_id text,
  edition text,
  foiling text,
  rarity text,
  image_url text,
  tcgplayer_url text,
  artists text,
  flavor_text text
);

CREATE TABLE IF NOT EXISTS set_printings (
  set_code text,
  printing_unique_id text,
  PRIMARY KEY (set_code, printing_unique_id)
);

-- Retailers & prices
CREATE TABLE IF NOT EXISTS retailers (
  slug text PRIMARY KEY,
  name text,
  base_url text,
  currency text
);

CREATE TABLE IF NOT EXISTS retailer_products (
  retailer_slug text,
  shopify_product_id text,
  shopify_variant_id text,
  product_title text,
  variant_title text,
  price_cad numeric(12,2),
  compare_at_price_cad numeric(12,2),
  in_stock integer,
  sku text,
  product_url text,
  printing_unique_id text,
  raw_tags text,
  condition text,
  updated_at timestamp with time zone,
  PRIMARY KEY (retailer_slug, shopify_variant_id)
);

CREATE TABLE IF NOT EXISTS price_history (
  retailer_slug text,
  shopify_variant_id text,
  product_title text,
  variant_title text,
  price_cad numeric(12,2),
  in_stock integer,
  printing_unique_id text,
  condition text,
  scraped_date date,
  scraped_at timestamp with time zone,
  PRIMARY KEY (retailer_slug, shopify_variant_id, scraped_date)
);

CREATE TABLE IF NOT EXISTS scrape_log (
  retailer_slug text,
  products_scraped integer,
  variants_scraped integer,
  matched_printings integer,
  duration_seconds integer,
  scraped_at timestamp with time zone DEFAULT now()
);

-- Indexes similar to SQLite ones
CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name);
CREATE INDEX IF NOT EXISTS idx_printings_card ON printings(card_unique_id);
CREATE INDEX IF NOT EXISTS idx_printings_card_id ON printings(card_id);
CREATE INDEX IF NOT EXISTS idx_printings_foiling ON printings(foiling);
CREATE INDEX IF NOT EXISTS idx_rp_printing ON retailer_products(printing_unique_id);
CREATE INDEX IF NOT EXISTS idx_rp_retailer ON retailer_products(retailer_slug);
CREATE INDEX IF NOT EXISTS idx_rp_price ON retailer_products(price_cad);
CREATE INDEX IF NOT EXISTS idx_ph_printing ON price_history(printing_unique_id);
CREATE INDEX IF NOT EXISTS idx_ph_date ON price_history(scraped_date);
CREATE INDEX IF NOT EXISTS idx_rp_printing_stock_price ON retailer_products(printing_unique_id, in_stock, price_cad);
CREATE INDEX IF NOT EXISTS idx_ph_printing_date ON price_history(printing_unique_id, scraped_date, in_stock);
"""

TABLES_ORDER = [
    # lookup/static first
    ("sets", "SELECT set_code, name FROM sets ORDER BY set_code", 2),
    ("rarities", "SELECT unique_id, name FROM rarities ORDER BY unique_id", 2),
    ("foilings", "SELECT unique_id, name FROM foilings ORDER BY unique_id", 2),
    ("editions", "SELECT unique_id, name FROM editions ORDER BY unique_id", 2),
    # main entities
    ("cards", "SELECT unique_id, name, color, pitch, cost, power, defense, health, intelligence, types, traits, card_keywords, functional_text, functional_text_plain, type_text, blitz_legal, cc_legal, commoner_legal, ll_legal FROM cards ORDER BY unique_id", 19),
    ("printings", "SELECT unique_id, card_unique_id, card_id, set_id, edition, foiling, rarity, image_url, tcgplayer_url, artists, flavor_text FROM printings ORDER BY unique_id", 11),
    ("set_printings", "SELECT set_code, printing_unique_id FROM set_printings ORDER BY set_code", 2),
    ("retailers", "SELECT slug, name, base_url, currency FROM retailers ORDER BY slug", 4),
    # big tables last
    ("retailer_products", "SELECT retailer_slug, shopify_product_id, shopify_variant_id, product_title, variant_title, price_cad, compare_at_price_cad, in_stock, sku, product_url, printing_unique_id, raw_tags, condition, updated_at FROM retailer_products ORDER BY retailer_slug, shopify_variant_id", 14),
    ("price_history", "SELECT retailer_slug, shopify_variant_id, product_title, variant_title, price_cad, in_stock, printing_unique_id, condition, scraped_date, scraped_at FROM price_history ORDER BY scraped_date, retailer_slug, shopify_variant_id", 10),
    ("scrape_log", "SELECT retailer_slug, products_scraped, variants_scraped, matched_printings, duration_seconds, scraped_at FROM scrape_log ORDER BY scraped_at", 6),
]

INSERT_SQL = {
    "sets": "INSERT INTO sets(set_code, name) VALUES (%s, %s) ON CONFLICT (set_code) DO NOTHING",
    "rarities": "INSERT INTO rarities(unique_id, name) VALUES (%s, %s) ON CONFLICT (unique_id) DO NOTHING",
    "foilings": "INSERT INTO foilings(unique_id, name) VALUES (%s, %s) ON CONFLICT (unique_id) DO NOTHING",
    "editions": "INSERT INTO editions(unique_id, name) VALUES (%s, %s) ON CONFLICT (unique_id) DO NOTHING",
    "cards": "INSERT INTO cards VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (unique_id) DO NOTHING",
    "printings": "INSERT INTO printings VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (unique_id) DO NOTHING",
    "set_printings": "INSERT INTO set_printings VALUES (%s,%s) ON CONFLICT (set_code, printing_unique_id) DO NOTHING",
    "retailers": "INSERT INTO retailers VALUES (%s,%s,%s,%s) ON CONFLICT (slug) DO NOTHING",
    "retailer_products": "INSERT INTO retailer_products VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (retailer_slug, shopify_variant_id) DO NOTHING",
    "price_history": "INSERT INTO price_history VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (retailer_slug, shopify_variant_id, scraped_date) DO NOTHING",
    "scrape_log": "INSERT INTO scrape_log VALUES (%s,%s,%s,%s,%s,%s)",
}


async def fetch_count(client, table: str) -> int:
    res = await client.execute(f"SELECT COUNT(*) FROM {table}")
    return int(res.rows[0][0])


async def fetch_batch(client, base_sql: str, offset: int, limit: int, retries: int = 3):
    import asyncio as aio
    sql = f"{base_sql} LIMIT ? OFFSET ?"
    for attempt in range(retries):
        try:
            res = await client.execute(sql, [limit, offset])
            return res.rows
        except Exception as e:
            if attempt < retries - 1:
                wait = 2 ** attempt
                print(f"    Retry {attempt + 1}/{retries} after {wait}s: {e}")
                await aio.sleep(wait)
            else:
                raise


def chunks(total: int, size: int):
    pages = math.ceil(total / size)
    for p in range(pages):
        yield p * size, size


async def main():
    print("Connecting to Turso (source)…")
    async with libsql_client.create_client(url=TURSO_URL, auth_token=TURSO_TOKEN) as src:
        print("Connecting to Neon (target)…")
        with psycopg.connect(NEON_URL, autocommit=True, row_factory=dict_row) as dst:
            with dst.cursor() as cur:
                print("Creating schema in Neon…")
                cur.execute(SCHEMA_SQL)

            # Copy each table in order
            for table, select_sql, ncols in TABLES_ORDER:
                total = await fetch_count(src, table)
                print(f"\nCopying {table}: {total} rows…")
                copied = 0
                with dst.cursor() as cur:
                    # For small tables, fetch all at once (avoids LIMIT/OFFSET bug)
                    if total <= 500:
                        try:
                            res = await src.execute(select_sql)
                            rows_all = res.rows
                        except Exception as e:
                            print(f"  SKIP (error): {e}")
                            continue
                        args: List[Tuple[Any, ...]] = []
                        for r in rows_all:
                            if len(r) != ncols:
                                continue  # skip malformed rows
                            if table in ("rarities", "foilings", "editions"):
                                r = list(r)
                                if r[0] is None or (isinstance(r[0], str) and r[0].strip() == ""):
                                    r[0] = r[1]
                                r = tuple(r)
                            args.append(tuple(r))
                        if args:
                            cur.executemany(INSERT_SQL[table], args)
                            print(f"  +{len(args)} (total {len(args)}/{total})")
                    else:
                        # Large tables: batch with LIMIT/OFFSET
                        for offset, limit in chunks(total, BATCH):
                            rows = await fetch_batch(src, select_sql, offset, limit)
                            if not rows:
                                break
                            args = []
                            for r in rows:
                                if len(r) != ncols:
                                    raise RuntimeError(f"Unexpected column count in {table}: got {len(r)} expected {ncols}")
                                if table in ("rarities", "foilings", "editions"):
                                    r = list(r)
                                    if r[0] is None or (isinstance(r[0], str) and r[0].strip() == ""):
                                        r[0] = r[1]
                                    r = tuple(r)
                                args.append(tuple(r))
                            if args:
                                cur.executemany(INSERT_SQL[table], args)
                                copied += len(rows)
                                print(f"  +{len(rows)} (total {copied}/{total})")
            print("\nMigration complete!")


if __name__ == "__main__":
    asyncio.run(main())