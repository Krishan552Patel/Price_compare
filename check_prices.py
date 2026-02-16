import asyncio
import libsql_client
import os
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("TURSO_DATABASE_URL").replace("libsql://", "https://")
token = os.getenv("TURSO_AUTH_TOKEN")

async def main():
    async with libsql_client.create_client(url=url, auth_token=token) as client:

        # 1. Overview — how many prices per store?
        print("=" * 70)
        print("  PRICES PER STORE")
        print("=" * 70)
        r = await client.execute(
            "SELECT retailer_slug, COUNT(*) as total, "
            "SUM(CASE WHEN printing_unique_id IS NOT NULL THEN 1 ELSE 0 END) as matched, "
            "SUM(CASE WHEN in_stock = 1 THEN 1 ELSE 0 END) as in_stock "
            "FROM retailer_products GROUP BY retailer_slug"
        )
        for row in r.rows:
            print(f"  {row[0]}: {row[1]} variants, {row[2]} matched to cards, {row[3]} in stock")

        # 2. Search a specific card across all stores
        print("\n" + "=" * 70)
        print("  PRICE COMPARISON — Example: 'Enlightened Strike'")
        print("=" * 70)
        r = await client.execute(
            "SELECT c.name, p.card_id, p.foiling, p.edition, "
            "rp.retailer_slug, rp.price_cad, rp.in_stock, rp.product_url "
            "FROM retailer_products rp "
            "JOIN printings p ON rp.printing_unique_id = p.unique_id "
            "JOIN cards c ON p.card_unique_id = c.unique_id "
            "WHERE c.name LIKE '%Enlightened Strike%' "
            "ORDER BY rp.price_cad ASC"
        )
        if r.rows:
            for row in r.rows:
                stock = "✓" if row[6] else "✗"
                print(f"  ${row[5]:.2f} [{stock}] {row[4]} | {row[0]} ({row[1]}) {row[2]} {row[3]}")
                print(f"    {row[7]}")
        else:
            print("  No results — try a different card name")

        # 3. Cheapest cards in stock across all stores
        print("\n" + "=" * 70)
        print("  TOP 20 CHEAPEST IN-STOCK CARDS")
        print("=" * 70)
        r = await client.execute(
            "SELECT c.name, p.card_id, rp.retailer_slug, rp.price_cad, rp.product_url "
            "FROM retailer_products rp "
            "JOIN printings p ON rp.printing_unique_id = p.unique_id "
            "JOIN cards c ON p.card_unique_id = c.unique_id "
            "WHERE rp.in_stock = 1 AND rp.price_cad > 0 "
            "ORDER BY rp.price_cad ASC LIMIT 20"
        )
        for row in r.rows:
            print(f"  ${row[3]:.2f} | {row[2]} | {row[0]} ({row[1]})")

        # 4. Most expensive cards in stock
        print("\n" + "=" * 70)
        print("  TOP 20 MOST EXPENSIVE IN-STOCK CARDS")
        print("=" * 70)
        r = await client.execute(
            "SELECT c.name, p.card_id, rp.retailer_slug, rp.price_cad, rp.product_url "
            "FROM retailer_products rp "
            "JOIN printings p ON rp.printing_unique_id = p.unique_id "
            "JOIN cards c ON p.card_unique_id = c.unique_id "
            "WHERE rp.in_stock = 1 "
            "ORDER BY rp.price_cad DESC LIMIT 20"
        )
        for row in r.rows:
            print(f"  ${row[3]:.2f} | {row[2]} | {row[0]} ({row[1]})")

        # 5. Best deals — biggest discount from compare_at_price
        print("\n" + "=" * 70)
        print("  TOP 10 BIGGEST DISCOUNTS (compare_at_price vs price)")
        print("=" * 70)
        r = await client.execute(
            "SELECT c.name, p.card_id, rp.retailer_slug, "
            "rp.compare_at_price_cad, rp.price_cad, "
            "ROUND((1 - rp.price_cad / rp.compare_at_price_cad) * 100, 1) as discount_pct "
            "FROM retailer_products rp "
            "JOIN printings p ON rp.printing_unique_id = p.unique_id "
            "JOIN cards c ON p.card_unique_id = c.unique_id "
            "WHERE rp.in_stock = 1 AND rp.compare_at_price_cad > rp.price_cad "
            "ORDER BY discount_pct DESC LIMIT 10"
        )
        for row in r.rows:
            print(f"  {row[5]}% off | was ${row[3]:.2f} → ${row[4]:.2f} | {row[2]} | {row[0]} ({row[1]})")

        # 6. Search any card you want
        print("\n" + "=" * 70)
        search = input("  Search a card name (or press Enter to skip): ").strip()
        if search:
            print(f"  Results for '{search}':")
            print("-" * 70)
            r = await client.execute(
                "SELECT c.name, p.card_id, p.foiling, p.edition, "
                "rp.retailer_slug, rp.price_cad, rp.in_stock, rp.product_url "
                "FROM retailer_products rp "
                "JOIN printings p ON rp.printing_unique_id = p.unique_id "
                "JOIN cards c ON p.card_unique_id = c.unique_id "
                "WHERE c.name LIKE ? "
                "ORDER BY rp.price_cad ASC",
                [f"%{search}%"]
            )
            if r.rows:
                for row in r.rows:
                    stock = "✓ In Stock" if row[6] else "✗ OOS"
                    print(f"  ${row[5]:.2f} [{stock}] {row[4]} | {row[0]} ({row[1]}) {row[2]} {row[3]}")
                    print(f"    {row[7]}")
            else:
                print("  No results found.")

asyncio.run(main())