import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { browseCards } from "@/lib/queries";

// Server-side cache (1hr) per unique filter combo, on top of CDN s-maxage=3600.
// Prevents repeat DB hits for the same query when CDN is cold (new filter combo,
// dev environment, or simultaneous concurrent requests hitting the same params).
const getCachedBrowse = unstable_cache(
  browseCards,
  ["browse-cards"],
  { revalidate: 3600 }
);

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;

  const query = p.get("q") || undefined;
  const sort = p.get("sort") || "name_asc";
  const page = parseInt(p.get("page") || "1", 10);
  const pageSize = parseInt(p.get("pageSize") || "24", 10);

  // Filter params
  const set = p.get("set") || undefined;
  const rarity = p.get("rarity") || undefined;
  const foiling = p.get("foiling") || undefined;
  const edition = p.get("edition") || undefined;
  const color = p.get("color") || undefined;
  const cardClass = p.get("class") || undefined;
  const pitch = p.get("pitch") || undefined;
  const keyword = p.get("keyword") || undefined;
  const subtype = p.get("subtype") || undefined;
  const talent = p.get("talent") || undefined;
  const fusion = p.get("fusion") || undefined;
  const specialization = p.get("specialization") || undefined;
  const artVariation = p.get("artVariation") || undefined;
  const inStockOnly = p.get("inStockOnly") === "1";
  const power = p.get("power") || undefined;
  const health = p.get("health") || undefined;
  const cost = p.get("cost") || undefined;
  const defense = p.get("defense") || undefined;

  try {
    const result = await getCachedBrowse({
      query, sort, page, pageSize,
      set, rarity, foiling, edition,
      color, class: cardClass, pitch,
      keyword, subtype, talent, fusion, specialization, artVariation, inStockOnly,
      power, health, cost, defense,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        "CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        "Vercel-CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Browse cards error:", error);
    return NextResponse.json(
      { cards: [], total: 0, error: "Failed to fetch cards" },
      { status: 500 }
    );
  }
}
