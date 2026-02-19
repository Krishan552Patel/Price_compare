"""
Migration: Add art_variations column to printings table in Neon.

Reads art_variations from Turso source and updates printings in Neon.

Usage:
  python migrate_art_variations.py
"""

import os
import asyncio
import math
from dotenv import load_dotenv

import psycopg
import libsql_client

load_dotenv()

TURSO_URL = os.getenv("TURSO_DATABASE_URL", "").replace("libsql://", "https://")
TURSO_TOKEN = os.getenv("TURSO_AUTH_TOKEN", "")
NEON_URL = os.getenv("NEON_DATABASE_URL", "")
BATCH = 1000


async def main():
    print("Connecting to Turso (source)…")
    async with libsql_client.create_client(url=TURSO_URL, auth_token=TURSO_TOKEN) as src:
        print("Connecting to Neon (target)…")
        with psycopg.connect(NEON_URL, autocommit=True) as dst:
            with dst.cursor() as cur:
                # 1. Add the column if it doesn't exist
                print("Adding art_variations column...")
                cur.execute("""
                    ALTER TABLE printings 
                    ADD COLUMN IF NOT EXISTS art_variations text DEFAULT '[]'
                """)
                print("  Column added (or already exists).")

            # 2. Fetch art_variations from Turso
            print("\nFetching art_variations from Turso...")
            count_res = await src.execute("SELECT COUNT(*) FROM printings WHERE art_variations IS NOT NULL AND art_variations != '[]' AND art_variations != ''")
            total = int(count_res.rows[0][0])
            print(f"  {total} printings with art_variations to update")

            if total == 0:
                print("No art_variations data found in Turso. Done.")
                return

            # 3. Batch update
            updated = 0
            pages = math.ceil(total / BATCH)
            for page in range(pages):
                offset = page * BATCH
                res = await src.execute(
                    f"SELECT unique_id, art_variations FROM printings WHERE art_variations IS NOT NULL AND art_variations != '[]' AND art_variations != '' LIMIT ? OFFSET ?",
                    [BATCH, offset]
                )
                if not res.rows:
                    break

                with dst.cursor() as cur:
                    for row in res.rows:
                        uid = row[0]
                        art_vars = row[1]
                        cur.execute(
                            "UPDATE printings SET art_variations = %s WHERE unique_id = %s",
                            (art_vars, uid)
                        )
                updated += len(res.rows)
                print(f"  Updated {updated}/{total}...")

            print(f"\nMigration complete! Updated {updated} printings with art_variations.")


if __name__ == "__main__":
    asyncio.run(main())
