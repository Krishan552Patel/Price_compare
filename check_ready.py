import asyncio
import libsql_client
import os
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("TURSO_DATABASE_URL").replace("libsql://", "https://")
token = os.getenv("TURSO_AUTH_TOKEN")

async def main():
    async with libsql_client.create_client(url=url, auth_token=token) as client:
        # Check printings count
        r = await client.execute("SELECT COUNT(*) FROM printings")
        print(f"Printings in DB: {r.rows[0][0]}")

        # Check cards count
        r = await client.execute("SELECT COUNT(*) FROM cards")
        print(f"Cards in DB:     {r.rows[0][0]}")

        # Check how many printings have a card_id
        r = await client.execute("SELECT COUNT(*) FROM printings WHERE card_id IS NOT NULL")
        print(f"Printings with card_id: {r.rows[0][0]}")

        # Show a few examples
        r = await client.execute("SELECT card_id, unique_id FROM printings WHERE card_id IS NOT NULL LIMIT 5")
        print("\nExample card_id -> printing_unique_id:")
        for row in r.rows:
            print(f"  {row[0]} -> {row[1]}")

asyncio.run(main())