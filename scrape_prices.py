"""
Production scraper V1.0 - Based on test_scrape.py V2.4
Uses EXACT same parsing logic, but writes to Turso in batches.

Writes to:
  - retailers           (upsert store info)
  - retailer_products   (current prices, linked to printings)
  - price_history       (daily snapshots for tracking over time)
  - scrape_log          (audit trail per scrape)
"""

import asyncio
import re
import sys
import time
import requests
import libsql_client
import os
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

TURSO_URL = os.getenv("TURSO_DATABASE_URL").replace("libsql://", "https://")
TURSO_TOKEN = os.getenv("TURSO_AUTH_TOKEN")

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

BATCH_SIZE = 100


def log(msg=""):
    print(msg, file=sys.stderr, flush=True)


def should_skip(title):
    for pat in SKIP_PATTERNS:
        if pat.search(title):
            return True
    return False


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
                log(f"  [{name}] Timed out {max_retries} times on page {page}, stopping.")
                break
            log(f"  [{name}] Timeout on page {page}, retrying ({retries}/{max_retries})...")
            time.sleep(3)
            continue
        except requests.exceptions.ConnectionError:
            retries += 1
            if retries > max_retries:
                log(f"  [{name}] Connection failed {max_retries} times on page {page}, stopping.")
                break
            log(f"  [{name}] Connection error on page {page}, retrying ({retries}/{max_retries})...")
            time.sleep(3)
            continue
        except requests.exceptions.RequestException as e:
            log(f"  [{name}] Request error: {e}")
            break

        if resp.status_code in (429, 503):
            retries += 1
            if retries > max_retries:
                log(f"  [{name}] HTTP {resp.status_code} x{max_retries} on page {page}, stopping.")
                break
            wait = int(resp.headers.get("Retry-After", 3 * retries))
            log(f"  [{name}] HTTP {resp.status_code} on page {page}, waiting {wait}s ({retries}/{max_retries})...")
            time.sleep(wait)
            continue

        if resp.status_code != 200:
            log(f"  [{name}] HTTP {resp.status_code} on page {page}, stopping.")
            break

        try:
            products = resp.json().get("products", [])
        except Exception:
            log(f"  [{name}] Invalid JSON on page {page}, stopping.")
            break

        if not products:
            log(f"  [{name}] No more products. Done!")
            break

        all_products.extend(products)
        log(f"  [{name}] Page {page}: +{len(products)} products (total: {len(all_products)})")

        retries = 0
        page += 1
        time.sleep(1)

    return all_products


def parse_shopify_product(product):
    title = product.get("title", "")
    tags = product.get("tags", [])
    variants = product.get("variants", [])
    first_sku = variants[0].get("sku", "") if variants else ""

    info = {
        "card_name": None,
        "card_id": None,
        "foiling": None,
        "edition": None,
    }

    title_lower = title.lower()
    tags_lower = [t.lower() for t in tags]
    tags_str = " ".join(tags_lower)

    if "gold cold foil" in title_lower or "gold cold foil" in tags_str:
        info["foiling"] = "Gold Cold Foil"
    elif "cold foil" in title_lower or "cold foil" in tags_str:
        info["foiling"] = "Cold Foil"
    elif "rainbow foil" in title_lower or "rainbow foil" in tags_str:
        info["foiling"] = "Rainbow Foil"
    else:
        info["foiling"] = "Normal"

    if "1st edition" in title_lower or "1st edition" in tags_str:
        info["edition"] = "1st Edition"
    elif "unlimited" in title_lower or "unlimited" in tags_str:
        info["edition"] = "Unlimited"
    else:
        info["edition"] = "Regular"

    bracket_match = re.search(r'\[(?:[A-Z0-9]+-)?([A-Z0-9]{2,6}\d{1,4})(?:-[A-Z])?\]', title)
    if bracket_match:
        info["card_id"] = bracket_match.group(1)

    if not info["card_id"]:
        for m in re.finditer(r'\(([A-Z0-9]{2,6}\d{1,4})\)', title):
            info["card_id"] = m.group(1)
            break

    if not info["card_id"]:
        dash_match = re.search(r'-\s*([A-Z0-9]{2,6}\d{1,4})\b', title)
        if dash_match:
            info["card_id"] = dash_match.group(1)

    if not info["card_id"]:
        for tag in tags:
            tag_stripped = tag.replace("U-", "").strip()
            if CARD_ID_RE.fullmatch(tag_stripped):
                info["card_id"] = tag_stripped
                break

    if not info["card_id"] and first_sku:
        sku_match = CARD_ID_RE.search(first_sku.upper())
        if sku_match:
            info["card_id"] = sku_match.group(1)

    name = title
    name = re.sub(r'\s*\[.*?\]', '', name)
    name = re.sub(r'\s*\([A-Z0-9]{2,6}\d{1,4}\)', '', name)
    name = re.sub(r'\s*\((?:Unlimited Edition|1st Edition|Edition)\)', '', name, flags=re.IGNORECASE)

    color_words = {'red', 'yellow', 'blue'}
    name = re.sub(
        r'\s*\(([^)]+)\)',
        lambda m: m.group(0) if m.group(1).strip().lower() in color_words else '',
        name
    )

    name = re.sub(r'\s+-\s+[A-Z].*', '', name)
    name = re.sub(r'\s+(?:Unlimited|1st Edition|Normal|Cold Foil|Rainbow Foil|Gold Cold Foil)\b', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s+', ' ', name).strip()
    info["card_name"] = name if name else title

    return info


async def flush_batch(client, batch, label=""):
    """Send a batch of statements to Turso in one request."""
    if not batch:
        return
    try:
        await client.batch(batch)
    except Exception as e:
        log(f"  ERROR flushing batch {label}: {e}")
        # Try one-by-one as fallback
        log(f"  Retrying batch one-by-one...")
        for stmt in batch:
            try:
                await client.execute(stmt.sql, stmt.args)
            except Exception as e2:
                log(f"    SKIP: {e2}")


async def main():
    log("=" * 60)
    log("  FAB Price Scraper — PRODUCTION (writing to Turso)")
    log("=" * 60)

    async with libsql_client.create_client(url=TURSO_URL, auth_token=TURSO_TOKEN) as client:

        # --- Step 1: Upsert retailers ---
        log("\n[1/4] Upserting retailers...")
        for slug, info in RETAILERS.items():
            await client.execute(
                "INSERT INTO retailers (slug, name, base_url, currency) "
                "VALUES (?, ?, ?, 'CAD') "
                "ON CONFLICT(slug) DO UPDATE SET name=excluded.name, base_url=excluded.base_url",
                [slug, info["name"], info["base_url"]]
            )
            log(f"  ✓ {slug}")

        # --- Step 2: Load card index ---
        log("\n[2/4] Loading card index from Turso...")
        result = await client.execute(
            "SELECT p.unique_id, p.card_id "
            "FROM printings p "
            "WHERE p.card_id IS NOT NULL"
        )

        card_index = {}
        for row in result.rows:
            printing_uid, card_id = row[0], row[1]
            if card_id not in card_index:
                card_index[card_id] = []
            card_index[card_id].append(printing_uid)

        log(f"  Loaded {len(card_index)} unique card_ids ({sum(len(v) for v in card_index.values())} printings)")

        if len(card_index) == 0:
            log("\n  ERROR: Card index is empty! Run ingest.py first.")
            return

        # --- Step 3: Scrape each retailer ---
        log("\n[3/4] Scraping retailers...")
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        grand_variants = 0
        grand_matched = 0

        for slug, info in RETAILERS.items():
            log(f"\n--- {info['name']} ---")
            start_time = time.time()

            products = fetch_all_products(info["name"], info["base_url"])
            log(f"  Fetched {len(products)} products. Parsing & batching...")

            variants_scraped = 0
            matched = 0
            skipped = 0
            unmatched = 0
            batch = []

            for product in products:
                title = product.get("title", "")
                handle = product.get("handle", "")

                if should_skip(title):
                    skipped += 1
                    continue

                parsed = parse_shopify_product(product)
                card_id = parsed["card_id"]

                printing_uid = None
                if card_id and card_id in card_index:
                    printing_uid = card_index[card_id][0]
                    matched += 1
                elif card_id:
                    unmatched += 1

                product_url = f"{info['site_url']}/products/{handle}"
                raw_tags = ",".join(product.get("tags", [])) if isinstance(product.get("tags"), list) else ""

                for variant in product.get("variants", []):
                    variant_id = str(variant.get("id", ""))
                    product_id = str(product.get("id", ""))
                    variant_title = variant.get("title", "")
                    price = variant.get("price")
                    compare_price = variant.get("compare_at_price")
                    available = 1 if variant.get("available", True) else 0
                    sku = variant.get("sku", "")

                    try:
                        price_cad = float(price) if price else 0.0
                    except (ValueError, TypeError):
                        price_cad = 0.0

                    try:
                        compare_cad = float(compare_price) if compare_price else None
                    except (ValueError, TypeError):
                        compare_cad = None

                    batch.append(libsql_client.Statement(
                        "INSERT INTO retailer_products "
                        "(retailer_slug, shopify_product_id, shopify_variant_id, "
                        "product_title, variant_title, price_cad, compare_at_price_cad, "
                        "in_stock, sku, product_url, printing_unique_id, raw_tags, updated_at) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')) "
                        "ON CONFLICT(retailer_slug, shopify_variant_id) DO UPDATE SET "
                        "product_title=excluded.product_title, "
                        "variant_title=excluded.variant_title, "
                        "price_cad=excluded.price_cad, "
                        "compare_at_price_cad=excluded.compare_at_price_cad, "
                        "in_stock=excluded.in_stock, "
                        "sku=excluded.sku, "
                        "product_url=excluded.product_url, "
                        "printing_unique_id=excluded.printing_unique_id, "
                        "raw_tags=excluded.raw_tags, "
                        "updated_at=datetime('now')",
                        [slug, product_id, variant_id, title, variant_title,
                         price_cad, compare_cad, available, sku, product_url,
                         printing_uid, raw_tags]
                    ))

                    batch.append(libsql_client.Statement(
                        "INSERT INTO price_history "
                        "(retailer_slug, shopify_variant_id, product_title, "
                        "variant_title, price_cad, in_stock, printing_unique_id, "
                        "scraped_date, scraped_at) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now')) "
                        "ON CONFLICT(retailer_slug, shopify_variant_id, scraped_date) "
                        "DO UPDATE SET "
                        "price_cad=excluded.price_cad, "
                        "in_stock=excluded.in_stock, "
                        "scraped_at=datetime('now')",
                        [slug, variant_id, title, variant_title,
                         price_cad, available, printing_uid, today]
                    ))

                    variants_scraped += 1

                    # Flush every BATCH_SIZE variants
                    if len(batch) >= BATCH_SIZE * 2:
                        await flush_batch(client, batch, f"{slug}:{variants_scraped}")
                        log(f"    ✓ {variants_scraped} variants written...")
                        batch = []

            # Flush remaining
            await flush_batch(client, batch, f"{slug}:final")

            duration = round(time.time() - start_time, 1)

            await client.execute(
                "INSERT INTO scrape_log "
                "(retailer_slug, products_scraped, variants_scraped, "
                "matched_printings, duration_seconds) "
                "VALUES (?, ?, ?, ?, ?)",
                [slug, len(products) - skipped, variants_scraped, matched, duration]
            )

            log(f"  ✓ {variants_scraped} variants written")
            log(f"  ✓ {matched} matched to printings in DB")
            log(f"  ✓ {unmatched} had card_id but no matching printing")
            log(f"  ✓ {skipped} skipped (non-cards)")
            log(f"  ✓ {duration}s elapsed")

            grand_variants += variants_scraped
            grand_matched += matched
            time.sleep(2)

        # --- Step 4: Summary ---
        log(f"\n{'='*60}")
        log(f"  DONE — FINAL SUMMARY")
        log(f"{'='*60}")

        result = await client.execute("SELECT COUNT(*) FROM retailer_products")
        log(f"  retailer_products rows: {result.rows[0][0]}")

        result = await client.execute(
            "SELECT COUNT(*) FROM retailer_products WHERE printing_unique_id IS NOT NULL"
        )
        log(f"  Linked to a printing:   {result.rows[0][0]}")

        result = await client.execute("SELECT COUNT(*) FROM price_history")
        log(f"  price_history rows:     {result.rows[0][0]}")

        result = await client.execute(
            "SELECT retailer_slug, products_scraped, variants_scraped, "
            "matched_printings, duration_seconds, scraped_at "
            "FROM scrape_log ORDER BY scraped_at DESC LIMIT 3"
        )
        log(f"\n  Latest scrape_log entries:")
        for row in result.rows:
            log(f"    {row[0]}: {row[1]} products, {row[2]} variants, "
                f"{row[3]} matched, {row[4]}s @ {row[5]}")


if __name__ == "__main__":
    asyncio.run(main())