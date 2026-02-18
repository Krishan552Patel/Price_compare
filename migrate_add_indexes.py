"""
Migration: Add performance indexes for faster queries.

Key optimizations:
1. Composite index on retailer_products for in-stock filtering
2. Index on retailer_products.in_stock for fast stock filtering
3. Composite index for price history lookups
4. Index on cards.name for search (if not exists)
"""

import asyncio
import libsql_client
import os
from dotenv import load_dotenv

load_dotenv()
url = os.getenv('TURSO_DATABASE_URL').replace('libsql://', 'https://')
token = os.getenv('TURSO_AUTH_TOKEN')

INDEXES = [
    # retailer_products: Composite index for the most common query pattern
    # (filtering by printing + in_stock, ordering by price)
    ("idx_rp_printing_stock_price", 
     "CREATE INDEX IF NOT EXISTS idx_rp_printing_stock_price ON retailer_products(printing_unique_id, in_stock, price_cad)"),
    
    # retailer_products: Fast in_stock filtering
    ("idx_rp_in_stock", 
     "CREATE INDEX IF NOT EXISTS idx_rp_in_stock ON retailer_products(in_stock)"),
    
    # printings: Composite for card lookups with foiling/edition
    ("idx_printings_card_foiling", 
     "CREATE INDEX IF NOT EXISTS idx_printings_card_foiling ON printings(card_unique_id, foiling, edition)"),
    
    # printings: For set-based browsing
    ("idx_printings_set_rarity", 
     "CREATE INDEX IF NOT EXISTS idx_printings_set_rarity ON printings(set_id, rarity)"),
    
    # price_history: Composite for history lookups
    ("idx_ph_printing_date", 
     "CREATE INDEX IF NOT EXISTS idx_ph_printing_date ON price_history(printing_unique_id, scraped_date, in_stock)"),
    
    # price_history: For condition filtering
    ("idx_ph_condition", 
     "CREATE INDEX IF NOT EXISTS idx_ph_condition ON price_history(condition)"),
    
    # cards: For search with type filtering
    ("idx_cards_name_type", 
     "CREATE INDEX IF NOT EXISTS idx_cards_name_type ON cards(name, type_text)"),
]


async def main():
    print("=== Adding Performance Indexes ===\n")
    
    async with libsql_client.create_client(url=url, auth_token=token) as client:
        for name, sql in INDEXES:
            try:
                print(f"Creating {name}...")
                await client.execute(sql)
                print(f"  Done!")
            except Exception as e:
                print(f"  Skipped: {e}")
        
        print("\n=== Verifying Indexes ===")
        result = await client.execute(
            "SELECT name FROM sqlite_master WHERE type='index' ORDER BY name"
        )
        print(f"Total indexes: {len(result.rows)}")
        for row in result.rows:
            print(f"  {row[0]}")
        
        print("\n=== Index Creation Complete ===")
        print("\nThese indexes optimize:")
        print("  - Card search queries (name LIKE)")
        print("  - Price lookups by printing + in_stock")
        print("  - Price history queries")
        print("  - Browsing by set/rarity/foiling")


if __name__ == "__main__":
    asyncio.run(main())
