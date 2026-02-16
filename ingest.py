"""
FAB Cards Database Ingestion Script
====================================
Pulls card data from the-fab-cube/flesh-and-blood-cards GitHub repo
and populates your Turso database.

Usage:
    python ingest.py                 # Sync latest release
    python ingest.py --force         # Re-sync even if already up to date
    python ingest.py --inspect       # Download and show JSON structure (no DB writes)
    python ingest.py --status        # Show current sync status
"""

import os
import sys
import json
import argparse
import requests
from dotenv import load_dotenv
from datetime import datetime

# ============================================================
# CONFIG
# ============================================================

load_dotenv()

TURSO_URL = os.getenv("TURSO_DATABASE_URL", "")
TURSO_TOKEN = os.getenv("TURSO_AUTH_TOKEN", "")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

REPO = "the-fab-cube/flesh-and-blood-cards"
GITHUB_API = f"https://api.github.com/repos/{REPO}"
RAW_BASE = f"https://raw.githubusercontent.com/{REPO}"

JSON_FILES = {
    "card": "json/english/card.json",
    "set": "json/english/set.json",
    "keyword": "json/english/keyword.json",
    "type": "json/english/type.json",
    "rarity": "json/english/rarity.json",
    "foiling": "json/english/foiling.json",
    "edition": "json/english/edition.json",
    "ability": "json/english/ability.json",
    "art_variation": "json/english/art-variation.json",
}


# ============================================================
# TURSO HTTP CLIENT
# ============================================================

class TursoDB:
    """Simple Turso HTTP API client using the pipeline endpoint."""

    def __init__(self, url, token):
        self.base_url = url.replace("libsql://", "https://")
        if not self.base_url.startswith("https://"):
            self.base_url = f"https://{self.base_url}"
        self.pipeline_url = f"{self.base_url}/v2/pipeline"
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    def execute(self, sql, args=None):
        stmt = {"sql": sql}
        if args:
            stmt["args"] = [self._convert_arg(a) for a in args]
        payload = {
            "requests": [
                {"type": "execute", "stmt": stmt},
                {"type": "close"},
            ]
        }
        resp = requests.post(self.pipeline_url, headers=self.headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        if results and results[0].get("type") == "error":
            error = results[0].get("error", {})
            raise Exception(f"SQL Error: {error.get('message', 'Unknown error')}")
        return results

    def execute_batch(self, statements, fk_off=False):
        if not statements:
            return []
        reqs = []
        # Optionally disable FK checks for this batch (same connection/pipeline)
        if fk_off:
            reqs.append({"type": "execute", "stmt": {"sql": "PRAGMA foreign_keys = OFF"}})
        for sql, args in statements:
            stmt = {"sql": sql}
            if args:
                stmt["args"] = [self._convert_arg(a) for a in args]
            reqs.append({"type": "execute", "stmt": stmt})
        reqs.append({"type": "close"})
        payload = {"requests": reqs}
        resp = requests.post(self.pipeline_url, headers=self.headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        for r in data.get("results", []):
            if r.get("type") == "error":
                error = r.get("error", {})
                raise Exception(f"SQL Error: {error.get('message', 'Unknown error')}")
        return data.get("results", [])

    def fetchone(self, sql, args=None):
        results = self.execute(sql, args)
        if results and results[0].get("type") == "ok":
            rows = results[0].get("response", {}).get("result", {}).get("rows", [])
            if rows:
                return [self._extract_value(v) for v in rows[0]]
        return None

    def fetchall(self, sql, args=None):
        results = self.execute(sql, args)
        if results and results[0].get("type") == "ok":
            rows = results[0].get("response", {}).get("result", {}).get("rows", [])
            return [[self._extract_value(v) for v in row] for row in rows]
        return []

    @staticmethod
    def _convert_arg(value):
        if value is None:
            return {"type": "null"}
        elif isinstance(value, int):
            return {"type": "integer", "value": str(value)}
        elif isinstance(value, float):
            return {"type": "float", "value": value}
        else:
            return {"type": "text", "value": str(value)}

    @staticmethod
    def _extract_value(cell):
        if cell.get("type") == "null":
            return None
        return cell.get("value")


# ============================================================
# HELPERS
# ============================================================

def get_headers():
    headers = {"Accept": "application/vnd.github.v3+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"
    return headers


def get_db():
    if not TURSO_URL or not TURSO_TOKEN:
        print("ERROR: Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env")
        sys.exit(1)
    return TursoDB(TURSO_URL, TURSO_TOKEN)


def get_latest_release():
    print("Checking latest release...")
    resp = requests.get(f"{GITHUB_API}/releases/latest", headers=get_headers())
    resp.raise_for_status()
    data = resp.json()
    return data["tag_name"], data.get("target_commitish", ""), data.get("name", "")


def get_last_sync(db):
    try:
        row = db.fetchone("SELECT release_tag, synced_at FROM sync_log ORDER BY id DESC LIMIT 1")
        return row[0] if row else None, row[1] if row else None
    except Exception:
        return None, None


def download_json(tag, file_key):
    path = JSON_FILES[file_key]
    url = f"{RAW_BASE}/{tag}/{path}"
    print(f"  Downloading {path}...")
    resp = requests.get(url, headers=get_headers())
    resp.raise_for_status()
    return resp.json()


def to_json_str(value):
    if value is None:
        return None
    if isinstance(value, (list, dict)):
        return json.dumps(value)
    return str(value)


def extract_names(arr):
    """Extract name strings from an array of objects or strings."""
    if not arr:
        return "[]"
    names = []
    for item in arr:
        if isinstance(item, dict):
            names.append(item.get("name", item.get("unique_id", "")))
        else:
            names.append(str(item))
    return json.dumps(names)


def bool_to_int(value):
    """Convert truthy values to 1/0 for SQLite."""
    if value is None:
        return 0
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, str):
        return 1 if value.lower() in ("true", "yes", "1") else 0
    return 1 if value else 0


# ============================================================
# INGEST FUNCTIONS
# ============================================================

def ingest_lookups(db, tag):
    print("\n--- Ingesting lookup tables ---")

    # Helper: rarity JSON may not have a 'name' field — fall back to shorthand/id
    def rarity_args(item):
        unique_id = item.get("unique_id")
        shorthand = item.get("id", item.get("shorthand", ""))
        name = item.get("name") or item.get("label") or shorthand or "Unknown"
        return [unique_id, shorthand, name]

    lookup_configs = [
        ("keyword", "keywords", "INSERT OR REPLACE INTO keywords (unique_id, name, description) VALUES (?, ?, ?)",
         lambda item: [item.get("unique_id"), item.get("name"), item.get("description")]),
        ("type", "types", "INSERT OR REPLACE INTO types (unique_id, name) VALUES (?, ?)",
         lambda item: [item.get("unique_id"), item.get("name")]),
        ("rarity", "rarities", "INSERT OR REPLACE INTO rarities (unique_id, shorthand, name) VALUES (?, ?, ?)",
         rarity_args),
        ("foiling", "foilings", "INSERT OR REPLACE INTO foilings (unique_id, shorthand, name) VALUES (?, ?, ?)",
         lambda item: [item.get("unique_id"), item.get("id", item.get("shorthand", "")), item.get("name") or item.get("id", "")]),
        ("edition", "editions", "INSERT OR REPLACE INTO editions (unique_id, shorthand, name) VALUES (?, ?, ?)",
         lambda item: [item.get("unique_id"), item.get("id", item.get("shorthand", "")), item.get("name") or item.get("id", "")]),
        ("ability", "abilities", "INSERT OR REPLACE INTO abilities (unique_id, name, description) VALUES (?, ?, ?)",
         lambda item: [item.get("unique_id"), item.get("name"), item.get("description")]),
        ("art_variation", "art_variations", "INSERT OR REPLACE INTO art_variations (unique_id, shorthand, name) VALUES (?, ?, ?)",
         lambda item: [item.get("unique_id"), item.get("id", item.get("shorthand", "")), item.get("name") or item.get("id", "")]),
    ]

    for file_key, table_name, sql, arg_fn in lookup_configs:
        try:
            data = download_json(tag, file_key)
            # Debug: show first item structure for troubleshooting
            if data:
                print(f"    {table_name} sample keys: {list(data[0].keys())}")
            batch = [(sql, arg_fn(item)) for item in data]
            db.execute_batch(batch)
            print(f"    {table_name}: {len(data)} rows")
        except Exception as e:
            print(f"    {table_name}: SKIPPED ({e})")
            if data:
                print(f"      First item: {data[0]}")


def ingest_sets(db, tag):
    print("\n--- Ingesting sets ---")
    data = download_json(tag, "set")

    set_batch = []
    sp_batch = []

    for s in data:
        set_batch.append((
            "INSERT OR REPLACE INTO sets (unique_id, set_code, name) VALUES (?, ?, ?)",
            [s.get("unique_id"), s.get("id"), s.get("name")],
        ))

        for sp in s.get("printings", []):
            sp_batch.append((
                """INSERT OR REPLACE INTO set_printings 
                (unique_id, set_unique_id, edition, start_card_id, end_card_id, 
                 initial_release_date, out_of_print, product_page_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                [
                    sp.get("unique_id"),
                    s.get("unique_id"),
                    sp.get("edition"),
                    sp.get("start_card_id"),
                    sp.get("end_card_id"),
                    sp.get("initial_release_date"),
                    1 if sp.get("out_of_print") else 0,
                    sp.get("product_page"),
                ],
            ))

    db.execute_batch(set_batch)
    db.execute_batch(sp_batch, fk_off=True)

    print(f"    sets: {len(set_batch)} rows")
    print(f"    set_printings: {len(sp_batch)} rows")
    return len(set_batch), len(sp_batch)


def ingest_cards(db, tag):
    print("\n--- Ingesting cards (this is the big one) ---")
    data = download_json(tag, "card")

    CHUNK_SIZE = 150

    # === PASS 1: Insert ALL cards first ===
    print("  Pass 1: Inserting cards...")
    card_count = 0
    card_batch = []

    for c in data:
        card_batch.append((
            """INSERT OR REPLACE INTO cards 
            (unique_id, name, color, pitch, cost, power, defense, health, intelligence, arcane,
             functional_text, functional_text_plain, type_text, played_horizontally,
             types, traits, card_keywords, abilities_and_effects,
             ability_and_effect_keywords, granted_keywords, removed_keywords, interacts_with_keywords,
             blitz_legal, cc_legal, commoner_legal, ll_legal,
             blitz_banned, cc_banned, commoner_banned, ll_banned, upf_banned,
             blitz_suspended, cc_suspended, commoner_suspended,
             blitz_living_legend, cc_living_legend, ll_restricted,
             metadata, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
            [
                c.get("unique_id"),
                c.get("name"),
                c.get("color"),
                str(c["pitch"]) if c.get("pitch") is not None else None,
                str(c["cost"]) if c.get("cost") is not None else None,
                str(c["power"]) if c.get("power") is not None else None,
                str(c["defense"]) if c.get("defense") is not None else None,
                str(c["health"]) if c.get("health") is not None else None,
                str(c["intelligence"]) if c.get("intelligence") is not None else None,
                str(c["arcane"]) if c.get("arcane") is not None else None,
                c.get("functional_text"),
                c.get("functional_text_plain"),
                c.get("type_text"),
                bool_to_int(c.get("played_horizontally")),
                to_json_str(c.get("types", [])),
                to_json_str(c.get("traits", [])),
                extract_names(c.get("card_keywords", [])),
                extract_names(c.get("abilities_and_effects", [])),
                extract_names(c.get("ability_and_effect_keywords", [])),
                extract_names(c.get("granted_keywords", [])),
                extract_names(c.get("removed_keywords", [])),
                extract_names(c.get("interacts_with_keywords", [])),
                bool_to_int(c.get("blitz_legal")),
                bool_to_int(c.get("cc_legal")),
                bool_to_int(c.get("commoner_legal")),
                bool_to_int(c.get("ll_legal")),
                bool_to_int(c.get("blitz_banned")),
                bool_to_int(c.get("cc_banned")),
                bool_to_int(c.get("commoner_banned")),
                bool_to_int(c.get("ll_banned")),
                bool_to_int(c.get("upf_banned")),
                bool_to_int(c.get("blitz_suspended")),
                bool_to_int(c.get("cc_suspended")),
                bool_to_int(c.get("commoner_suspended")),
                bool_to_int(c.get("blitz_living_legend")),
                bool_to_int(c.get("cc_living_legend")),
                bool_to_int(c.get("ll_restricted")),
                "{}",
            ],
        ))
        card_count += 1

        if len(card_batch) >= CHUNK_SIZE:
            db.execute_batch(card_batch)
            card_batch = []
            print(f"    ... {card_count} cards inserted")

    if card_batch:
        db.execute_batch(card_batch)
    print(f"    cards: {card_count} total")

    # === PASS 2: Insert ALL printings (cards already exist) ===
    print("  Pass 2: Inserting printings...")
    printing_count = 0
    printing_batch = []

    for c in data:
        for p in c.get("printings", []):
            artists = p.get("artists", [])
            if artists and isinstance(artists[0], dict):
                artists_json = json.dumps([a.get("name", "") for a in artists])
            else:
                artists_json = json.dumps(artists if artists else [])

            art_vars = p.get("art_variations", [])
            if art_vars and isinstance(art_vars[0], dict):
                art_vars_json = json.dumps([a.get("id", a.get("name", "")) for a in art_vars])
            else:
                art_vars_json = json.dumps(art_vars if art_vars else [])

            printing_batch.append((
                """INSERT OR REPLACE INTO printings 
                (unique_id, card_unique_id, set_printing_unique_id, card_id, set_id,
                 edition, foiling, rarity, expansion_slot, artists, art_variations,
                 flavor_text, flavor_text_plain, image_url, image_rotation_degrees,
                 tcgplayer_product_id, tcgplayer_url, metadata, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
                [
                    p.get("unique_id"),
                    c.get("unique_id"),
                    p.get("set_printing_unique_id"),
                    p.get("id"),
                    p.get("set_id"),
                    p.get("edition"),
                    p.get("foiling"),
                    p.get("rarity"),
                    1 if p.get("expansion_slot") else 0,
                    artists_json,
                    art_vars_json,
                    p.get("flavor_text"),
                    p.get("flavor_text_plain"),
                    p.get("image_url"),
                    p.get("image_rotation_degrees"),
                    p.get("tcgplayer_product_id"),
                    p.get("tcgplayer_url"),
                    "{}",
                ],
            ))
            printing_count += 1

            if len(printing_batch) >= CHUNK_SIZE:
                db.execute_batch(printing_batch, fk_off=True)
                printing_batch = []
                print(f"    ... {printing_count} printings inserted")

    if printing_batch:
        db.execute_batch(printing_batch, fk_off=True)

    print(f"    printings: {printing_count} total")
    return card_count, printing_count


# ============================================================
# COMMANDS
# ============================================================

def cmd_sync(force=False):
    db = get_db()

    tag, commit_sha, release_name = get_latest_release()
    print(f"Latest release: {tag} ({release_name})")

    last_tag, last_date = get_last_sync(db)
    if last_tag:
        print(f"Last sync: {last_tag} on {last_date}")

    if last_tag == tag and not force:
        print("\nAlready up to date! Use --force to re-sync.")
        return

    print(f"\nSyncing {tag}...")
    start_time = datetime.now()

    ingest_lookups(db, tag)
    set_count, sp_count = ingest_sets(db, tag)
    card_count, printing_count = ingest_cards(db, tag)

    db.execute(
        """INSERT INTO sync_log (release_tag, commit_sha, cards_upserted, printings_upserted, notes)
        VALUES (?, ?, ?, ?, ?)""",
        [tag, commit_sha, card_count, printing_count, f"Sets: {set_count}, Set printings: {sp_count}"],
    )

    elapsed = (datetime.now() - start_time).total_seconds()
    print(f"\n{'='*60}")
    print(f"SYNC COMPLETE in {elapsed:.1f}s")
    print(f"  Release: {tag}")
    print(f"  Cards: {card_count}")
    print(f"  Printings: {printing_count}")
    print(f"  Sets: {set_count}")
    print(f"  Set Printings: {sp_count}")
    print(f"{'='*60}")


def cmd_status():
    db = get_db()

    print("Database Status")
    print("=" * 40)

    last_tag, last_date = get_last_sync(db)
    print(f"Last sync: {last_tag or 'Never'} ({last_date or 'N/A'})")

    tables = ["cards", "printings", "sets", "set_printings", "keywords", "types",
              "rarities", "foilings", "editions", "abilities", "art_variations"]
    for table in tables:
        try:
            row = db.fetchone(f"SELECT COUNT(*) FROM {table}")
            count = int(row[0]) if row else 0
            print(f"  {table}: {count:,} rows")
        except Exception:
            print(f"  {table}: ERROR")

    try:
        tag, _, name = get_latest_release()
        if tag != last_tag:
            print(f"\nUpdate available: {tag} ({name})")
        else:
            print(f"\nUp to date with latest release")
    except Exception:
        pass


def cmd_inspect():
    tag, _, _ = get_latest_release()
    print(f"Inspecting {tag}...\n")

    # Show rarity.json structure (was failing)
    rarities = download_json(tag, "rarity")
    print(f"rarity.json: {len(rarities)} rarities")
    if rarities:
        print(f"  Sample: {rarities[0]}")
        print(f"  Keys: {list(rarities[0].keys())}")

    cards = download_json(tag, "card")
    print(f"\ncard.json: {len(cards)} cards")
    if cards:
        sample = cards[0]
        print(f"\nSample card keys: {list(sample.keys())}")
        print(f"  name: {sample.get('name')}")
        print(f"  unique_id: {sample.get('unique_id')}")
        print(f"  pitch: {sample.get('pitch')}")
        print(f"  types: {sample.get('types')}")
        print(f"  printings count: {len(sample.get('printings', []))}")

        if sample.get("printings"):
            p = sample["printings"][0]
            print(f"\n  Sample printing keys: {list(p.keys())}")
            print(f"    unique_id: {p.get('unique_id')}")
            print(f"    id: {p.get('id')}")
            print(f"    set_id: {p.get('set_id')}")
            print(f"    edition: {p.get('edition')}")
            print(f"    foiling: {p.get('foiling')}")
            print(f"    image_url: {p.get('image_url')}")
            print(f"    artists: {p.get('artists')}")

    sets = download_json(tag, "set")
    print(f"\nset.json: {len(sets)} sets")
    if sets:
        sample = sets[0]
        print(f"\nSample set keys: {list(sample.keys())}")
        print(f"  name: {sample.get('name')}")
        print(f"  id: {sample.get('id')}")
        print(f"  printings count: {len(sample.get('printings', []))}")
        if sample.get("printings"):
            sp = sample["printings"][0]
            print(f"\n  Sample set printing keys: {list(sp.keys())}")

    keywords = download_json(tag, "keyword")
    print(f"\nkeyword.json: {len(keywords)} keywords")
    if keywords:
        print(f"  Sample: {keywords[0]}")


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="FAB Cards DB Ingestion")
    parser.add_argument("--force", action="store_true", help="Force re-sync even if up to date")
    parser.add_argument("--inspect", action="store_true", help="Inspect JSON structure (no DB writes)")
    parser.add_argument("--status", action="store_true", help="Show database status")
    args = parser.parse_args()

    if args.inspect:
        cmd_inspect()
    elif args.status:
        cmd_status()
    else:
        cmd_sync(force=args.force)
