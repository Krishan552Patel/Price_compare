"""
Migration: Add condition column to retailer_products and price_history tables.

Run this once to add the condition column for tracking card conditions
(NM, LP, MP, HP, DMG).
"""

import asyncio
import libsql_client
import os
from dotenv import load_dotenv

load_dotenv()

TURSO_URL = os.getenv("TURSO_DATABASE_URL").replace("libsql://", "https://")
TURSO_TOKEN = os.getenv("TURSO_AUTH_TOKEN")


async def main():
    print("=== Condition Column Migration ===\n")

    async with libsql_client.create_client(url=TURSO_URL, auth_token=TURSO_TOKEN) as client:
        # Check if columns already exist
        print("Checking current schema...")
        
        result = await client.execute(
            "PRAGMA table_info(retailer_products)"
        )
        existing_cols = [row[1] for row in result.rows]
        
        if "condition" in existing_cols:
            print("  retailer_products.condition already exists, skipping.")
        else:
            print("  Adding condition column to retailer_products...")
            await client.execute(
                "ALTER TABLE retailer_products ADD COLUMN condition TEXT DEFAULT 'NM'"
            )
            print("  Done!")

        result = await client.execute(
            "PRAGMA table_info(price_history)"
        )
        existing_cols = [row[1] for row in result.rows]
        
        if "condition" in existing_cols:
            print("  price_history.condition already exists, skipping.")
        else:
            print("  Adding condition column to price_history...")
            await client.execute(
                "ALTER TABLE price_history ADD COLUMN condition TEXT DEFAULT 'NM'"
            )
            print("  Done!")

        print("\n=== Migration Complete ===")
        print("Condition column added with default 'NM' (Near Mint)")
        print("\nCondition codes:")
        print("  NM  = Near Mint")
        print("  LP  = Lightly Played")
        print("  MP  = Moderately Played")
        print("  HP  = Heavily Played")
        print("  DMG = Damaged")


if __name__ == "__main__":
    asyncio.run(main())
