import { NextRequest, NextResponse } from "next/server";
import { browseCards } from "@/lib/queries";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  
  const query = params.get("q") || undefined;
  const set = params.get("set") || undefined;
  const rarity = params.get("rarity") || undefined;
  const foiling = params.get("foiling") || undefined;
  const color = params.get("color") || undefined;
  const type = params.get("type") || undefined;
  const sort = params.get("sort") || "name_asc";
  const inStock = params.get("inStock") === "true";
  const showPrintings = params.get("showPrintings") === "true";
  const minPrice = params.get("minPrice") ? parseFloat(params.get("minPrice")!) : undefined;
  const maxPrice = params.get("maxPrice") ? parseFloat(params.get("maxPrice")!) : undefined;
  const page = parseInt(params.get("page") || "1", 10);
  const pageSize = parseInt(params.get("pageSize") || "24", 10);

  try {
    const result = await browseCards({
      query,
      set,
      rarity,
      foiling,
      color,
      type,
      sort,
      inStock,
      minPrice,
      maxPrice,
      page,
      pageSize,
      groupByPrinting: !!query || showPrintings || !!foiling,
    });

    return NextResponse.json(result, {
      headers: {
        // Cache for 2 minutes, stale for 10 minutes
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
        "CDN-Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
        "Vercel-CDN-Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
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
