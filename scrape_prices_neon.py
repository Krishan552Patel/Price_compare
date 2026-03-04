"""
Production scraper for Neon PostgreSQL.
Scrapes retailer prices and writes to Neon using batch inserts to minimise
round-trips. One executemany() per retailer instead of one execute() per row.
"""

import re
import sys
import time
import os
import requests
import psycopg
from psycopg.rows import tuple_row
from datetime import datetime, timezone, date as date_type, timedelta
from dotenv import load_dotenv

load_dotenv()

NEON_URL = os.getenv("NEON_DATABASE_URL")

RETAILERS = {
    "invasion": {
        "name": "Invasion Comics",
        "base_url": "https://invasioncnc.ca/collections/flesh-and-blood-singles-all/products.json",
        "site_url": "https://invasioncnc.ca",
    },
    "gobelin": {
        "name": "Gobelin d'Argent",
        "base_url": "https://gobelindargent.ca/collections/all-flesh-and-blood-singles/products.json",
        "site_url": "https://gobelindargent.ca",
    },
    "etb": {
        "name": "Enter the Battlefield",
        "base_url": "https://enterthebattlefield.ca/collections/flesh-and-blood-singles/products.json",
        "site_url": "https://enterthebattlefield.ca",
    },
}

CARD_ID_RE = re.compile(r'([A-Z0-9]{2,6}\d{1,4})')
HEADERS = {"User-Agent": "FABPriceTracker/1.0 (personal price comparison)"}

SKIP_PATTERNS = [
    re.compile(r'art card', re.IGNORECASE),
    re.compile(r'PCG \d', re.IGNORECASE),
    re.compile(r'player slab', re.IGNORECASE),
    re.compile(r'collector slab', re.IGNORECASE),
    re.compile(r'booster box', re.IGNORECASE),
    re.compile(r'booster pack', re.IGNORECASE),
    re.compile(r'blitz deck', re.IGNORECASE),
    re.compile(r'starter deck', re.IGNORECASE),
]

CONDITION_PATTERNS = [
    (re.compile(r'\b(?:damaged|dmg)\b', re.IGNORECASE), 'DMG'),
    (re.compile(r'\b(?:heavily[\s-]?played|hp)\b', re.IGNORECASE), 'HP'),
    (re.compile(r'\b(?:moderately[\s-]?played|mp)\b', re.IGNORECASE), 'MP'),
    (re.compile(r'\b(?:lightly[\s-]?played|lp|slightly[\s-]?played|sp)\b', re.IGNORECASE), 'LP'),
    (re.compile(r'\b(?:near[\s-]?mint|nm|mint)\b', re.IGNORECASE), 'NM'),
]

FOILING_MAP = {
    "Gold Cold Foil": "G",
    "Cold Foil": "C",
    "Rainbow Foil": "R",
    "Normal": "S",
}
EDITION_MAP = {
    "1st Edition": "A",
    "Unlimited": "U",
    "Regular": "N",
}

# Purge history older than this many days.
# DELETE WHERE scraped_date < CURRENT_DATE - 90 days
# → keeps the last 90 days of data (inclusive of today).
# → data from day 0 (Feb 25 2026) is deleted on day 91, Feb 26 on day 92, etc.
# The 90-day trending MV uses scraped_date >= CURRENT_DATE - 90, which matches
# exactly what we keep, so no data is lost from the trending window.
HISTORY_RETENTION_DAYS = 90


def log(msg=""):
    print(msg, file=sys.stderr, flush=True)


def should_skip(title):
    return any(pat.search(title) for pat in SKIP_PATTERNS)


def fetch_all_products(name, base_url):
    all_products = []
    page = 1
    retries = 0
    max_retries = 3

    while True:
        url = f"{base_url}?limit=250&page={page}"
        log(f"  [{name}] Fetching page {page}...")

        try:
            resp = requests.get(url, timeout=30, headers=HEADERS)
        except requests.exceptions.Timeout:
            retries += 1
            if retries > max_retries:
                log(f"  [{name}] Timed out {max_retries} times, stopping.")
                break
            time.sleep(3)
            continue
        except requests.exceptions.RequestException as e:
            log(f"  [{name}] Request error: {e}")
            break

        if resp.status_code in (429, 503):
            retries += 1
            if retries > max_retries:
                break
            time.sleep(3 * retries)
            continue

        if resp.status_code != 200:
            log(f"  [{name}] HTTP {resp.status_code}, stopping.")
            break

        try:
            products = resp.json().get("products", [])
        except Exception:
            break

        if not products:
            log(f"  [{name}] No more products. Done!")
            break

        all_products.extend(products)
        log(f"  [{name}] Page {page}: +{len(products)} (total: {len(all_products)})")
        retries = 0
        page += 1
        time.sleep(1)

    return all_products


def parse_condition(title, tags, variant_title=""):
    search_text = f"{title} {variant_title} {' '.join(tags)}"
    for pattern, condition in CONDITION_PATTERNS:
        if pattern.search(search_text):
            return condition
    return 'NM'


def parse_shopify_product(product, variant=None):
    title = product.get("title", "")
    tags = product.get("tags", [])
    variants = product.get("variants", [])
    first_sku = variants[0].get("sku", "") if variants else ""
    variant_title = variant.get("title", "") if variant else ""

    info = {
        "card_id": None,
        "foiling": "Normal",
        "edition": "Regular",
        "condition": parse_condition(title, tags, variant_title),
    }

    title_lower = title.lower()
    tags_str = " ".join(t.lower() for t in tags)

    if "gold cold foil" in title_lower or "gold cold foil" in tags_str:
        info["foiling"] = "Gold Cold Foil"
    elif "cold foil" in title_lower or "cold foil" in tags_str:
        info["foiling"] = "Cold Foil"
    elif "rainbow foil" in title_lower or "rainbow foil" in tags_str:
        info["foiling"] = "Rainbow Foil"

    if "1st edition" in title_lower or "1st edition" in tags_str:
        info["edition"] = "1st Edition"
    elif "unlimited" in title_lower or "unlimited" in tags_str:
        info["edition"] = "Unlimited"

    # Extract card_id — most specific patterns first
    bracket_match = re.search(r'\[(?:[A-Z0-9]+-)?([A-Z0-9]{2,6}\d{1,4})(?:-[A-Z])?\]', title)
    if bracket_match:
        info["card_id"] = bracket_match.group(1)

    if not info["card_id"]:
        m = re.search(r'\(([A-Z0-9]{2,6}\d{1,4})\)', title)
        if m:
            info["card_id"] = m.group(1)

    if not info["card_id"]:
        m = re.search(r'-\s*([A-Z0-9]{2,6}\d{1,4})\b', title)
        if m:
            info["card_id"] = m.group(1)

    if not info["card_id"]:
        for tag in tags:
            stripped = tag.replace("U-", "").strip()
            if CARD_ID_RE.fullmatch(stripped):
                info["card_id"] = stripped
                break

    if not info["card_id"] and first_sku:
        m = CARD_ID_RE.search(first_sku.upper())
        if m:
            info["card_id"] = m.group(1)

    return info


def build_card_index(cur):
    """Load all printings into memory: card_index[card_id][foiling_edition_key] = unique_id."""
    cur.execute("""
        SELECT unique_id, card_id, foiling, edition
        FROM printings
        WHERE card_id IS NOT NULL
    """)
    index = {}
    for uid, card_id, foiling, edition in cur.fetchall():
        foiling = foiling or 'S'
        edition = edition or 'N'
        if card_id not in index:
            index[card_id] = {}
        index[card_id][f"{foiling}_{edition}"] = uid
        # Fallback: foiling-only key (first seen wins)
        index[card_id].setdefault(foiling, uid)
    return index


def resolve_printing(card_index, card_id, foiling_key, edition_key):
    if not card_id or card_id not in card_index:
        return None
    variants = card_index[card_id]
    return (
        variants.get(f"{foiling_key}_{edition_key}")
        or variants.get(foiling_key)
        or next(iter(variants.values()), None)
    )


def build_last_price_index(cur):
    """
    Load the current price snapshot for every (retailer_slug, variant_id).
    Used to decide whether a new history row needs to be written this scrape.

    Reads from retailer_products (always ~170K rows, constant size) instead
    of price_history (grows to millions of rows over time). retailer_products
    already holds the most-recent price/stock/condition for every variant, so
    this is both faster and avoids a full scan of the history table.

    Returns: dict  (retailer_slug, variant_id) -> {price, in_stock, condition}
    """
    cur.execute("""
        SELECT retailer_slug, shopify_variant_id, price_cad, in_stock, condition
        FROM retailer_products
    """)
    index = {}
    for retailer_slug, variant_id, price_cad, in_stock, condition in cur.fetchall():
        index[(retailer_slug, str(variant_id))] = {
            "price":     float(price_cad or 0),
            "in_stock":  int(in_stock or 0),
            "condition": condition or "NM",
        }
    return index


def build_history_variant_set(cur):
    """
    Return the set of (retailer_slug, shopify_variant_id) pairs that already
    have at least one row in price_history.

    Used alongside build_last_price_index so that variants known to
    retailer_products but with NO history yet still receive a baseline entry
    on the next scrape (even when the price hasn't changed).
    """
    cur.execute("""
        SELECT DISTINCT retailer_slug, shopify_variant_id
        FROM price_history
    """)
    return {(row[0], str(row[1])) for row in cur.fetchall()}


def purge_old_history(cur):
    """
    Delete price_history rows older than HISTORY_RETENTION_DAYS.
    Runs after every scrape so the table never grows beyond ~3 months.
    Returns the number of rows deleted.
    """
    cur.execute(
        "DELETE FROM price_history WHERE scraped_date < CURRENT_DATE - INTERVAL '%s days'",
        (HISTORY_RETENTION_DAYS,)
    )
    return cur.rowcount


def process_retailer(slug, info, card_index, today, last_prices, variants_with_history):
    """
    Scrape one retailer and return (product_rows, history_rows, stats).
    All DB writes happen outside this function so they can be batched.

    variants_with_history: set of (retailer_slug, variant_id) that already
    have at least one price_history row. Variants in last_prices (i.e. known
    to retailer_products) but NOT in this set receive a baseline history entry
    even when the price hasn't changed, so chart data is never missing.
    """
    products = fetch_all_products(info["name"], info["base_url"])
    log(f"  Fetched {len(products)} products. Processing...")

    product_rows = []   # rows for retailer_products upsert
    history_rows = []   # rows for price_history — written on first-seen or price change
    history_skipped = 0 # unchanged rows suppressed
    matched = 0
    skipped = 0
    today_date = date_type.fromisoformat(today)
    yesterday   = (today_date - timedelta(days=1)).isoformat()

    for product in products:
        title = product.get("title", "")
        handle = product.get("handle", "")
        tags = product.get("tags", [])

        if should_skip(title):
            skipped += 1
            continue

        parsed = parse_shopify_product(product)
        foiling_key = FOILING_MAP.get(parsed["foiling"], "S")
        edition_key = EDITION_MAP.get(parsed["edition"], "N")
        printing_uid = resolve_printing(card_index, parsed["card_id"], foiling_key, edition_key)
        raw_tags = ",".join(tags) if isinstance(tags, list) else ""
        product_url = f"{info['site_url']}/products/{handle}"

        if printing_uid:
            matched += 1

        for variant in product.get("variants", []):
            variant_id = str(variant.get("id", ""))
            product_id = str(product.get("id", ""))
            variant_title = variant.get("title", "")
            price = variant.get("price")
            compare_price = variant.get("compare_at_price")
            available = 1 if variant.get("available", True) else 0
            sku = variant.get("sku", "")
            condition = parse_condition(title, tags, variant_title)

            try:
                price_cad = float(price) if price else 0.0
            except (ValueError, TypeError):
                price_cad = 0.0

            try:
                compare_cad = float(compare_price) if compare_price else None
            except (ValueError, TypeError):
                compare_cad = None

            product_rows.append((
                slug, product_id, variant_id, title, variant_title,
                price_cad, compare_cad, available, sku, product_url,
                printing_uid, raw_tags, condition,
            ))

            # History strategy:
            #   • First time seen (not in retailer_products)
            #     OR known but no history row yet → write today's row (baseline)
            #   • Price / stock / condition changed → write a "yesterday anchor"
            #     at the OLD price then today's row at the NEW price. The anchor
            #     keeps the pre-change value inside every trending window so
            #     movements are always visible.
            #   • No change AND already has history → skip (no redundant rows)
            last = last_prices.get((slug, variant_id))
            has_history = (slug, variant_id) in variants_with_history
            if last is None or not has_history:
                # Never seen before, or known but missing a baseline history row
                history_rows.append((
                    slug, variant_id, title, variant_title,
                    price_cad, available, printing_uid, condition, today,
                ))
            elif (
                abs(price_cad - last["price"]) > 0.001
                or available != last["in_stock"]
                or condition != last["condition"]
            ):
                # Something changed — anchor the old price as of yesterday so the
                # trending CTEs can find a "past" price even for the 7-day window.
                history_rows.append((
                    slug, variant_id, title, variant_title,
                    last["price"], last["in_stock"], printing_uid, last["condition"], yesterday,
                ))
                history_rows.append((
                    slug, variant_id, title, variant_title,
                    price_cad, available, printing_uid, condition, today,
                ))
            else:
                history_skipped += 1

    stats = {
        "products_scraped":   len(products) - skipped,
        "variants_scraped":   len(product_rows),
        "matched_printings":  matched,
        "history_written":    len(history_rows),
        "history_skipped":    history_skipped,
    }
    return product_rows, history_rows, stats


def batch_upsert_products(cur, rows):
    """Single executemany() for all retailer_products rows."""
    cur.executemany("""
        INSERT INTO retailer_products
            (retailer_slug, shopify_product_id, shopify_variant_id,
             product_title, variant_title, price_cad, compare_at_price_cad,
             in_stock, sku, product_url, printing_unique_id, raw_tags, condition, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT(retailer_slug, shopify_variant_id) DO UPDATE SET
            product_title         = EXCLUDED.product_title,
            variant_title         = EXCLUDED.variant_title,
            price_cad             = EXCLUDED.price_cad,
            compare_at_price_cad  = EXCLUDED.compare_at_price_cad,
            in_stock              = EXCLUDED.in_stock,
            sku                   = EXCLUDED.sku,
            product_url           = EXCLUDED.product_url,
            printing_unique_id    = EXCLUDED.printing_unique_id,
            raw_tags              = EXCLUDED.raw_tags,
            condition             = EXCLUDED.condition,
            updated_at            = NOW()
        WHERE
            retailer_products.price_cad             IS DISTINCT FROM EXCLUDED.price_cad OR
            retailer_products.in_stock              IS DISTINCT FROM EXCLUDED.in_stock  OR
            retailer_products.printing_unique_id    IS DISTINCT FROM EXCLUDED.printing_unique_id OR
            retailer_products.condition             IS DISTINCT FROM EXCLUDED.condition
    """, rows)


def batch_upsert_history(cur, rows):
    """Single executemany() for all price_history rows."""
    cur.executemany("""
        INSERT INTO price_history
            (retailer_slug, shopify_variant_id, product_title,
             variant_title, price_cad, in_stock, printing_unique_id,
             condition, scraped_date, scraped_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT(retailer_slug, shopify_variant_id, scraped_date) DO UPDATE SET
            price_cad          = EXCLUDED.price_cad,
            in_stock           = EXCLUDED.in_stock,
            condition          = EXCLUDED.condition,
            scraped_at         = NOW()
        WHERE
            price_history.price_cad IS DISTINCT FROM EXCLUDED.price_cad OR
            price_history.in_stock  IS DISTINCT FROM EXCLUDED.in_stock  OR
            price_history.condition IS DISTINCT FROM EXCLUDED.condition
    """, rows)


def main():
    log("=" * 60)
    log("  FAB Price Scraper - Neon PostgreSQL (batch mode)")
    log("=" * 60)

    if not NEON_URL:
        log("ERROR: NEON_DATABASE_URL not set.")
        sys.exit(1)

    with psycopg.connect(NEON_URL, row_factory=tuple_row) as conn:
        with conn.cursor() as cur:

            # 1. Upsert retailers (tiny, fine to do individually)
            log("\n[1/4] Upserting retailers...")
            for slug, info in RETAILERS.items():
                cur.execute("""
                    INSERT INTO retailers (slug, name, base_url, currency)
                    VALUES (%s, %s, %s, 'CAD')
                    ON CONFLICT(slug) DO UPDATE SET
                        name     = EXCLUDED.name,
                        base_url = EXCLUDED.base_url
                """, (slug, info["name"], info["base_url"]))
            conn.commit()
            log("  Done")

            # 2. Load card index into memory (1 query, reused for all retailers)
            log("\n[2/5] Loading card index...")
            card_index = build_card_index(cur)
            log(f"  Loaded {len(card_index)} unique card_ids")

            if not card_index:
                log("\n  ERROR: Card index is empty! Aborting.")
                sys.exit(1)

            # 3. Load last-known price snapshot + existing history coverage
            log("\n[3/5] Loading last price index...")
            last_prices = build_last_price_index(cur)
            log(f"  Loaded {len(last_prices):,} known variants")

            log("\n[3b/5] Loading history variant set (baseline detection)...")
            variants_with_history = build_history_variant_set(cur)
            log(f"  {len(variants_with_history):,} variants already have history")

            # 4. Scrape + batch write each retailer
            log("\n[4/5] Scraping retailers...")
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

            for slug, info in RETAILERS.items():
                log(f"\n--- {info['name']} ---")
                start_time = time.time()

                product_rows, history_rows, stats = process_retailer(
                    slug, info, card_index, today, last_prices, variants_with_history
                )

                log(f"  Writing {len(product_rows)} product rows (batch)...")
                batch_upsert_products(cur, product_rows)

                log(f"  Writing {len(history_rows)} history rows "
                    f"({stats['history_skipped']:,} unchanged, skipped)...")
                batch_upsert_history(cur, history_rows)

                conn.commit()
                duration = round(time.time() - start_time, 1)

                cur.execute("""
                    INSERT INTO scrape_log
                        (retailer_slug, products_scraped, variants_scraped,
                         matched_printings, duration_seconds)
                    VALUES (%s, %s, %s, %s, %s)
                """, (slug, stats["products_scraped"], stats["variants_scraped"],
                      stats["matched_printings"], duration))
                conn.commit()

                log(f"  Done: {stats['variants_scraped']} variants, "
                    f"{stats['matched_printings']} matched, "
                    f"{stats['history_written']} history rows written, {duration}s")

            # 5. Refresh trending materialized views (concurrent — no table lock)
            log(f"\n[5/5] Refreshing trending materialized views...")
            for days in [7, 14, 30, 90]:
                mv = f"trending_mv_{days}d"
                log(f"  Refreshing {mv}...")
                cur.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {mv}")
                conn.commit()
            log("  Done")

            # 6. Purge history older than HISTORY_RETENTION_DAYS
            log(f"\n[+] Purging price_history older than {HISTORY_RETENTION_DAYS} days...")
            deleted = purge_old_history(cur)
            conn.commit()
            log(f"  Deleted {deleted:,} rows")

            # 7. Summary
            log(f"\n{'='*60}")
            log("  DONE - SUMMARY")
            log(f"{'='*60}")
            cur.execute("SELECT COUNT(*) FROM retailer_products")
            log(f"  Total retailer_products: {cur.fetchone()[0]:,}")
            cur.execute("SELECT COUNT(*) FROM retailer_products WHERE in_stock = 1")
            log(f"  In-stock products:       {cur.fetchone()[0]:,}")
            cur.execute("SELECT COUNT(*) FROM price_history")
            log(f"  price_history rows:      {cur.fetchone()[0]:,}")


if __name__ == "__main__":
    main()
