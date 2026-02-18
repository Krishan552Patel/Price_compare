"""Check price history data statistics."""

import asyncio
import libsql_client
import os
from dotenv import load_dotenv

load_dotenv()
url = os.getenv('TURSO_DATABASE_URL').replace('libsql://', 'https://')
token = os.getenv('TURSO_AUTH_TOKEN')

async def main():
    async with libsql_client.create_client(url=url, auth_token=token) as client:
        print("=== Price History Stats ===\n")
        
        result = await client.execute('SELECT COUNT(*) FROM price_history')
        print(f"Total rows: {result.rows[0][0]}")
        
        result = await client.execute('SELECT COUNT(DISTINCT scraped_date) FROM price_history')
        print(f"Unique dates: {result.rows[0][0]}")
        
        result = await client.execute('SELECT MIN(scraped_date), MAX(scraped_date) FROM price_history')
        print(f"Date range: {result.rows[0][0]} to {result.rows[0][1]}")
        
        result = await client.execute('SELECT COUNT(DISTINCT printing_unique_id) FROM price_history WHERE printing_unique_id IS NOT NULL')
        print(f"Unique printings tracked: {result.rows[0][0]}")
        
        result = await client.execute('SELECT DISTINCT condition FROM price_history')
        conditions = [r[0] for r in result.rows]
        print(f"Conditions: {conditions}")
        
        result = await client.execute('SELECT DISTINCT retailer_slug FROM price_history')
        retailers = [r[0] for r in result.rows]
        print(f"Retailers: {retailers}")
        
        print("\n=== Sample Data (latest 5) ===")
        result = await client.execute('''
            SELECT scraped_date, retailer_slug, product_title, price_cad, condition, in_stock
            FROM price_history 
            ORDER BY scraped_date DESC, id DESC 
            LIMIT 5
        ''')
        for row in result.rows:
            print(f"  {row[0]} | {row[1]} | ${row[3]} | {row[4]} | {'In Stock' if row[5] else 'OOS'}")
            print(f"    {row[2][:60]}...")

asyncio.run(main())
