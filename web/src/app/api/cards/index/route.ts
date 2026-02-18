import { NextResponse } from "next/server";
import db from "@/lib/db";

// Minimal card data for client-side search
interface CardIndexEntry {
  i: string;  // unique_id (short key to save bytes)
  n: string;  // name
  t: string;  // type_text
  m: string;  // image_url
}

export async function GET() {
  // Get all cards with in-stock items (only searchable cards)
  const result = await db.execute({
    sql: `SELECT DISTINCT c.unique_id, c.name, c.type_text,
           (SELECT p.image_url FROM printings p 
            WHERE p.card_unique_id = c.unique_id 
            AND p.image_url IS NOT NULL LIMIT 1) as image_url
         FROM cards c
         JOIN printings p ON p.card_unique_id = c.unique_id
         JOIN retailer_products rp ON rp.printing_unique_id = p.unique_id
         WHERE rp.in_stock = 1
         ORDER BY c.name`,
    args: [],
  });

  // Compress to minimal JSON (saves ~60% bandwidth)
  const index: CardIndexEntry[] = result.rows.map((row) => ({
    i: row.unique_id as string,
    n: row.name as string,
    t: (row.type_text as string) || "",
    m: (row.image_url as string) || "",
  }));

  return NextResponse.json(index, {
    headers: {
      // Cache for 1 hour on CDN, stale for 24 hours
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "Vercel-CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
