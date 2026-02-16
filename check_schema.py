import asyncio
import libsql_client
import os
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("TURSO_DATABASE_URL")
token = os.getenv("TURSO_AUTH_TOKEN")

# Convert libsql:// to https:// for HTTP mode
http_url = url.replace("libsql://", "https://")

async def main():
    async with libsql_client.create_client(
        url=http_url,
        auth_token=token
    ) as client:
        result = await client.execute("SELECT name FROM sqlite_master WHERE type='table'")
        print("=== TABLES ===")
        for row in result.rows:
            print(row[0])

        print("\n=== FULL SCHEMA ===")
        result = await client.execute("SELECT sql FROM sqlite_master WHERE type='table'")
        for row in result.rows:
            print(row[0])
            print()

asyncio.run(main())