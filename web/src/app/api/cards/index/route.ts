import { NextResponse } from "next/server";
import db from "@/lib/db";

// Minimal card data for client-side search
interface CardIndexEntry {
  i: string;  // unique_id (short key to save bytes)
  n: string;  // name
  t: string;  // type_text
  m: string;  // image_url
  c: string;  // card_ids (e.g. "WTR001 EVR034") — for card number search
  s: string;  // set_names (e.g. "Welcome to Rathe Everfest") — for set search
}

export async function GET() {
  // Get all cards with in-stock items, aggregating card IDs and set names
  const result = await db.execute({
    sql: `
      SELECT
        c.unique_id,
        c.name,
        c.type_text,
        MIN(p.image_url) FILTER (WHERE p.image_url IS NOT NULL) AS image_url,
        STRING_AGG(DISTINCT p.card_id, ' ')  AS card_ids,
        STRING_AGG(DISTINCT s.name,    ' ')  AS set_names
      FROM cards c
      JOIN printings p        ON p.card_unique_id  = c.unique_id
      LEFT JOIN sets s        ON p.set_id          = s.set_code
      JOIN retailer_products rp ON rp.printing_unique_id = p.unique_id
      WHERE rp.in_stock = 1
      GROUP BY c.unique_id, c.name, c.type_text
      ORDER BY c.name
    `,
    args: [],
  });

  // Compress to minimal JSON (saves ~60% bandwidth)
  const index: CardIndexEntry[] = result.rows.map((row) => ({
    i: row.unique_id as string,
    n: row.name as string,
    t: (row.type_text as string) || "",
    m: (row.image_url as string) || "",
    c: (row.card_ids as string) || "",
    s: (row.set_names as string) || "",
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
