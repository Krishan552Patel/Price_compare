import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getTrendingCards } from "@/lib/queries";

// Run on Vercel's Edge network — eliminates Node.js cold start (~100-200ms)
// and runs in a region close to the Neon DB for lower latency.
// Neon's @neondatabase/serverless uses HTTP fetch, which is Edge-compatible.
export const runtime = "edge";
export const dynamic = "force-dynamic";

// Server-side cache (1hr) per unique filter combo, on top of the CDN cache.
// Helps for: CDN cold misses, development, and concurrent identical requests.
const getCachedTrending = unstable_cache(
  getTrendingCards,
  ["trending-cards"],
  { revalidate: 3600 }
);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const days = Number(sp.get("days") ?? "7");
  const direction = (sp.get("direction") ?? "both") as "up" | "down" | "both";
  const minMove = Number(sp.get("minMove") ?? "1");
  const minPrice = Number(sp.get("minPrice") ?? "0");
  const maxPrice = Number(sp.get("maxPrice") ?? "999999");
  const rarity = sp.get("rarity") || undefined;
  const foiling = sp.get("foiling") || undefined;
  const set = sp.get("set") || undefined;
  const edition = sp.get("edition") || undefined;
  const cardClass = sp.get("class") || undefined;
  const sortBy = (sp.get("sortBy") === "percent" ? "percent" : "dollar") as "dollar" | "percent";

  const cards = await getCachedTrending({
    days,
    direction,
    minMove,
    minPrice,
    maxPrice,
    rarity,
    foiling,
    set,
    edition,
    class: cardClass,
    sortBy,
  });

  return NextResponse.json(cards, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
