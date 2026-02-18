"""
Test script V2.4 - Full catalog test with pagination and live progress.
NO database writes.

Categorizes failures:
  SKIP    = art cards, graded slabs, non-playable (ignore these)
  BAD_DATA = store has broken/missing data (their problem)
  PARSE   = parser couldn't extract ID (our problem, needs fixing)
"""

import re
import sys
import requests
import time

RETAILERS = {
    "invasion": {
        "name": "Invasion Comics",
        "base_url": "https://invasioncnc.ca/collections/flesh-and-blood-singles-all/products.json",
    },
    "gobelin": {
        "name": "Gobelin d'Argent",
        "base_url": "https://gobelindargent.ca/collections/all-flesh-and-blood-singles/products.json",
    },
    "etb": {
        "name": "Enter the Battlefield",
        "base_url": "https://enterthebattlefield.ca/collections/flesh-and-blood-singles/products.json",
    },
}

CARD_ID_RE = re.compile(r'([A-Z0-9]{2,6}\d{1,4})')

HEADERS = {"User-Agent": "FABPriceTracker/1.0 (personal price comparison)"}

# Products matching these patterns are not playable cards — skip entirely
SKIP_PATTERNS = [
    re.compile(r'art card', re.IGNORECASE),
    re.compile(r'PCG \d', re.IGNORECASE),          # graded slabs
    re.compile(r'player slab', re.IGNORECASE),
    re.compile(r'collector slab', re.IGNORECASE),
    re.compile(r'booster box', re.IGNORECASE),
    re.compile(r'booster pack', re.IGNORECASE),
    re.compile(r'blitz deck', re.IGNORECASE),
    re.compile(r'starter deck', re.IGNORECASE),
]

# Condition patterns - order matters (most specific first)
CONDITION_PATTERNS = [
    (re.compile(r'\b(?:damaged|dmg)\b', re.IGNORECASE), 'DMG'),
    (re.compile(r'\b(?:heavily[\s-]?played|hp)\b', re.IGNORECASE), 'HP'),
    (re.compile(r'\b(?:moderately[\s-]?played|mp)\b', re.IGNORECASE), 'MP'),
    (re.compile(r'\b(?:lightly[\s-]?played|lp|slightly[\s-]?played|sp)\b', re.IGNORECASE), 'LP'),
    (re.compile(r'\b(?:near[\s-]?mint|nm|mint)\b', re.IGNORECASE), 'NM'),
]


def log(msg=""):
    """Print to stderr so progress is visible even when stdout is piped to a file."""
    print(msg, file=sys.stderr, flush=True)


def should_skip(title):
    """Check if this product is a non-card item that should be skipped."""
    for pat in SKIP_PATTERNS:
        if pat.search(title):
            return True
    return False


def fetch_all_products(name, base_url):
    """Paginate through all products in a Shopify collection."""
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


def parse_condition(title, tags, variant_title=""):
    """Extract card condition from product data. Default to NM if not found."""
    search_text = f"{title} {variant_title} {' '.join(tags)}"
    
    for pattern, condition in CONDITION_PATTERNS:
        if pattern.search(search_text):
            return condition
    
    return 'NM'


def parse_shopify_product(product, variant_title=""):
    title = product.get("title", "")
    tags = product.get("tags", [])
    variants = product.get("variants", [])
    first_sku = variants[0].get("sku", "") if variants else ""

    info = {
        "card_name": None,
        "card_id": None,
        "foiling": None,
        "edition": None,
        "condition": parse_condition(title, tags, variant_title),
    }

    # === FOILING ===
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

    # === EDITION ===
    if "1st edition" in title_lower or "1st edition" in tags_str:
        info["edition"] = "1st Edition"
    elif "unlimited" in title_lower or "unlimited" in tags_str:
        info["edition"] = "Unlimited"
    else:
        info["edition"] = "Regular"

    # === CARD ID ===

    # Source 1: Bracket notation [U-WTR215], [1HP361], [EVR155], [IRA012-P]
    bracket_match = re.search(r'\[(?:[A-Z0-9]+-)?([A-Z0-9]{2,6}\d{1,4})(?:-[A-Z])?\]', title)
    if bracket_match:
        info["card_id"] = bracket_match.group(1)

    # Source 2: Parenthetical (WTR215), (ROSPZL3)
    if not info["card_id"]:
        for m in re.finditer(r'\(([A-Z0-9]{2,6}\d{1,4})\)', title):
            info["card_id"] = m.group(1)
            break

    # Source 3: After a dash
    if not info["card_id"]:
        dash_match = re.search(r'-\s*([A-Z0-9]{2,6}\d{1,4})\b', title)
        if dash_match:
            info["card_id"] = dash_match.group(1)

    # Source 4: From tags
    if not info["card_id"]:
        for tag in tags:
            tag_stripped = tag.replace("U-", "").strip()
            if CARD_ID_RE.fullmatch(tag_stripped):
                info["card_id"] = tag_stripped
                break

    # Source 5: From SKU
    if not info["card_id"] and first_sku:
        sku_match = CARD_ID_RE.search(first_sku.upper())
        if sku_match:
            info["card_id"] = sku_match.group(1)

    # === CARD NAME ===
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


def classify_failure(title, sku):
    """Classify why a product failed to parse."""
    if should_skip(title):
        return "SKIP"

    # No SKU and no recognizable ID anywhere = bad store data
    sku_str = sku or ""
    has_undefined = "UNDEFINED" in sku_str.upper()
    has_empty_sku = not sku_str or sku_str == "None"
    has_broken_sku = "--" in sku_str  # e.g. HS--N-1

    if has_undefined or has_broken_sku:
        return "BAD_DATA"

    if has_empty_sku and not re.search(r'[A-Z]{2,6}\d{1,4}', title):
        return "BAD_DATA"

    # If there's an ID-like thing we couldn't catch, it's a parser issue
    return "PARSE"


def test_retailer(slug, cfg):
    name = cfg["name"]
    print(f"\n{'='*70}")
    print(f"  {name}")
    print(f"{'='*70}")

    log(f"\n--- Starting {name} ---")
    products = fetch_all_products(name, cfg["base_url"])

    skipped = 0
    parsed_ok = 0
    failures = {"SKIP": [], "BAD_DATA": [], "PARSE": []}

    log(f"  [{name}] Parsing {len(products)} products...")

    for i, product in enumerate(products):
        title = product.get("title", "???")
        variants = product.get("variants", [])
        first_sku = variants[0].get("sku", "") if variants else ""

        # Skip non-card products
        if should_skip(title):
            skipped += 1
            continue

        parsed = parse_shopify_product(product)

        if parsed["card_id"]:
            parsed_ok += 1
        else:
            category = classify_failure(title, first_sku)
            failures[category].append((i + 1, title, first_sku))

    cards_attempted = len(products) - skipped
    fail_count = len(failures["BAD_DATA"]) + len(failures["PARSE"])
    pct = (parsed_ok / cards_attempted * 100) if cards_attempted else 0

    print(f"  Total products: {len(products)}")
    print(f"  Skipped (non-cards): {skipped}")
    print(f"  Cards attempted: {cards_attempted}")
    print(f"  Parsed OK: {parsed_ok} ({pct:.2f}%)")
    print()

    if failures["BAD_DATA"]:
        print(f"  BAD STORE DATA ({len(failures['BAD_DATA'])}):")
        for num, raw, sku in failures["BAD_DATA"]:
            print(f"    #{num}: {raw}")
            print(f"           SKU: {sku}")
        print()

    if failures["PARSE"]:
        print(f"  PARSER FAILURES ({len(failures['PARSE'])}):")
        for num, raw, sku in failures["PARSE"]:
            print(f"    #{num}: {raw}")
            print(f"           SKU: {sku}")
        print()

    if not failures["BAD_DATA"] and not failures["PARSE"]:
        print(f"  No failures!")
        print()

    log(f"  [{name}] Done! {parsed_ok}/{cards_attempted} cards parsed ({pct:.1f}%), "
        f"{skipped} skipped, {len(failures['BAD_DATA'])} bad data, {len(failures['PARSE'])} parse errors")

    return {
        "total": len(products),
        "skipped": skipped,
        "parsed_ok": parsed_ok,
        "bad_data": failures["BAD_DATA"],
        "parse_errors": failures["PARSE"],
    }


if __name__ == "__main__":
    print("FAB Price Scraper - FULL CATALOG TEST (no DB writes)")
    print("Paginating through all products per retailer...\n")
    log("Starting full catalog test...\n")

    grand = {"total": 0, "skipped": 0, "parsed_ok": 0, "bad_data": [], "parse_errors": []}

    for slug, cfg in RETAILERS.items():
        result = test_retailer(slug, cfg)
        grand["total"] += result["total"]
        grand["skipped"] += result["skipped"]
        grand["parsed_ok"] += result["parsed_ok"]
        grand["bad_data"].extend([(cfg["name"], *f) for f in result["bad_data"]])
        grand["parse_errors"].extend([(cfg["name"], *f) for f in result["parse_errors"]])
        time.sleep(2)

    cards_attempted = grand["total"] - grand["skipped"]
    pct = (grand["parsed_ok"] / cards_attempted * 100) if cards_attempted else 0

    print(f"{'='*70}")
    print(f"  GRAND TOTAL")
    print(f"  Products:    {grand['total']}")
    print(f"  Skipped:     {grand['skipped']} (art cards, slabs, etc.)")
    print(f"  Cards:       {cards_attempted}")
    print(f"  Parsed OK:   {grand['parsed_ok']} ({pct:.2f}%)")
    print(f"  Bad data:    {len(grand['bad_data'])} (store's fault)")
    print(f"  Parse error: {len(grand['parse_errors'])} (our fault)")

    if grand["bad_data"]:
        print(f"\n  ALL BAD STORE DATA:")
        for store, num, raw, sku in grand["bad_data"]:
            print(f"    [{store}] #{num}: {raw}")
            print(f"      SKU: {sku}")

    if grand["parse_errors"]:
        print(f"\n  ALL PARSER FAILURES (need fixing):")
        for store, num, raw, sku in grand["parse_errors"]:
            print(f"    [{store}] #{num}: {raw}")
            print(f"      SKU: {sku}")

    print(f"{'='*70}")

    log(f"\nDone! {grand['parsed_ok']}/{cards_attempted} cards ({pct:.1f}%)")
    if grand["bad_data"]:
        log(f"  {len(grand['bad_data'])} bad store data (not our problem)")
    if grand["parse_errors"]:
        log(f"  {len(grand['parse_errors'])} parse errors (NEEDS FIXING)")
    else:
        log(f"  0 parse errors!")
