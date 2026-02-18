"""Check existing indexes and suggest optimizations."""

import asyncio
import libsql_client
import os
from dotenv import load_dotenv

load_dotenv()
url = os.getenv('TURSO_DATABASE_URL').replace('libsql://', 'https://')
token = os.getenv('TURSO_AUTH_TOKEN')

async def main():
    async with libsql_client.create_client(url=url, auth_token=token) as client:
        # Check existing indexes
        result = await client.execute(
            "SELECT name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY tbl_name, name"
        )
        print('=== EXISTING INDEXES ===')
        for row in result.rows:
            print(f'{row[0]}')
            print(f'  {row[1]}')
            print()

        # Check table sizes
        print('=== TABLE SIZES ===')
        tables = ['cards', 'printings', 'retailer_products', 'price_history', 'sets', 'retailers']
        for table in tables:
            result = await client.execute(f'SELECT COUNT(*) FROM {table}')
            print(f'{table}: {result.rows[0][0]:,} rows')

asyncio.run(main())
