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
      // Cache for 2 minutes, stale-while-revalidate for 10 minutes
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      "CDN-Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      "Vercel-CDN-Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
    },
  });
}
