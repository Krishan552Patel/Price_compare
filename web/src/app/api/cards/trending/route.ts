import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getTrendingCards } from "@/lib/queries";

export const dynamic = "force-dynamic";

// Cache DB results server-side for 1 hour per unique param combination.
// This is a secondary cache behind the CDN (s-maxage=3600) — it helps when
// the CDN is cold (new filter combo) or the app is running locally.
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
  });

  return NextResponse.json(cards, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
