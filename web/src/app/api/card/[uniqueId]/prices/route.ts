import { NextRequest, NextResponse } from "next/server";
import { getCardPrices } from "@/lib/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uniqueId: string }> }
) {
  const { uniqueId } = await params;
  const inStockOnly = request.nextUrl.searchParams.get("inStock") !== "false";
  const prices = await getCardPrices(uniqueId, inStockOnly);
  
  return NextResponse.json(prices, {
    headers: {
      // Cache for 1 hour, stale for 24 hours (prices only update 2x/day)
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "Vercel-CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
